import { DiagnosticBag } from "./diagnostics";
import { DEFAULT_OPTIONS, withDefaults, type ZigshapeOptions } from "./options";
import { observeSamples, ROOT_PATH, type Observation, type ObservationMap, type ValueKind } from "./observe";
import { shapesEqual, type EnumVariant, type FieldShape, type Shape, type UnionVariant } from "./shape";
import { sanitizeFieldName, sanitizeStructName } from "./zig/identifier";
import type { ZObject, ZValue } from "./value";

const TAG_FIELD_PREFERENCES = ["type", "kind", "_type", "_tag", "__typename"];

export type InferenceResult = {
  root: Shape;
  diagnostics: DiagnosticBag;
};

/** Back-compat: old call sites pass `{ mapMinKeys }` only.  New code passes the
 *  full options bundle. */
export type InferOptions = Partial<ZigshapeOptions>;

export function infer(observations: ObservationMap, opts: InferOptions = {}): InferenceResult {
  const options = withDefaults(opts);
  const diag = new DiagnosticBag();
  const root = inferAt(ROOT_PATH, observations, options, diag);
  return { root, diagnostics: diag };
}

function inferAt(
  path: string,
  obs: ObservationMap,
  opts: ZigshapeOptions,
  diag: DiagnosticBag,
): Shape {
  const o = obs.get(path);
  if (!o || o.total === 0) {
    return { kind: "unknown", reason: "no-observations" };
  }

  const kindsObserved = activeKinds(o);
  const nonNull = kindsObserved.filter((k) => k !== "null");

  if (nonNull.length === 0) {
    diag.warn("infer.only_null", `Only null observed at ${path}; defaulting to unknown`, { path });
    return { kind: "unknown", reason: "only-null" };
  }

  if (nonNull.length === 1) {
    return inferSingleKind(nonNull[0]!, path, o, obs, opts, diag);
  }

  if (nonNull.length === 2 && nonNull.includes("int") && nonNull.includes("float")) {
    diag.warn(
      "infer.int_float_mix",
      `Both int and float observed at ${path}; promoting to f64`,
      { path },
    );
    return { kind: "float" };
  }

  diag.warn(
    "infer.heterogeneous",
    `Heterogeneous values at ${path} (${nonNull.join(", ")}); falling back to std.json.Value`,
    { path },
  );
  return { kind: "unknown", reason: "mixed-scalars" };
}

function inferSingleKind(
  kind: ValueKind,
  path: string,
  o: Observation,
  obs: ObservationMap,
  opts: ZigshapeOptions,
  diag: DiagnosticBag,
): Shape {
  switch (kind) {
    case "bool":
      return { kind: "bool" };
    case "string":
      return inferString(path, o, opts, diag);
    case "float":
      return { kind: "float" };
    case "int": {
      const min = o.intMin ?? 0n;
      const max = o.intMax ?? 0n;
      return { kind: "int", signed: min < 0n, min, max };
    }
    case "array": {
      const elementPath = path + "[*]";
      const elementObs = obs.get(elementPath);
      // Try tagged-union detection at the element position.
      if (
        opts.unions === "tagged" &&
        elementObs &&
        !elementObs.objectItemsOverflowed &&
        elementObs.objectItems &&
        elementObs.objectItems.length >= 2
      ) {
        const union = inferUnion(elementPath, elementObs.objectItems, opts, diag);
        if (union) return { kind: "array", element: union };
      }
      const element = inferAt(elementPath, obs, opts, diag);
      return { kind: "array", element };
    }
    case "object":
      return inferObject(path, o, obs, opts, diag);
    case "null":
      return { kind: "null" };
  }
}

function inferString(
  path: string,
  o: Observation,
  opts: ZigshapeOptions,
  diag: DiagnosticBag,
): Shape {
  if (opts.enums === "off") return { kind: "string" };
  const samples = o.stringSamples;
  if (!samples || samples.size === 0) return { kind: "string" };

  if (o.stringSamplesOverflowed && opts.enums === "auto") return { kind: "string" };

  const distinct = samples.size;
  if (distinct > opts.enumMaxVariants) return { kind: "string" };

  const totalString = o.countByKind.get("string") ?? 0;
  if (opts.enums === "auto") {
    if (totalString < opts.enumMinObservations) return { kind: "string" };
    if (distinct / totalString >= opts.enumDistinctRatio) return { kind: "string" };
  }

  // Build variants.  If any value would need @"…" escaping AND auto mode is
  // active, fall back to string — escapism is a strong signal the field isn't
  // really an enum.  Under "always" mode we accept escapes.
  const variants: EnumVariant[] = [];
  const seenZigNames = new Set<string>();
  for (const [rawValue, count] of samples) {
    const sanitized = sanitizeFieldName(rawValue);
    if (sanitized.escaped && opts.enums === "auto") return { kind: "string" };
    let zigName = sanitized.text;
    let i = 2;
    while (seenZigNames.has(zigName)) zigName = `${sanitized.text}_${i++}`;
    seenZigNames.add(zigName);
    variants.push({ zigName, escaped: sanitized.escaped, rawValue, observedCount: count });
  }

  if (variants.length < 2) return { kind: "string" };

  diag.warn(
    "infer.enum_candidate",
    `String at ${path} suggested as enum (${variants.length} distinct values across ${totalString} observations)`,
    { path },
  );

  return { kind: "enum", path, variants };
}

function inferObject(
  path: string,
  o: Observation,
  obs: ObservationMap,
  opts: ZigshapeOptions,
  diag: DiagnosticBag,
): Shape {
  const fields = new Map<string, FieldShape>();
  for (const key of o.childKeyOrder) {
    const childPath = path + "." + key;
    const childObs = obs.get(childPath);
    const childShape = inferAt(childPath, obs, opts, diag);
    const observedCount = childObs?.total ?? 0;
    const parentTotal = o.total;
    const missing = parentTotal - observedCount;
    const hasNull = (childObs?.countByKind.get("null") ?? 0) > 0;
    const optional = missing > 0 || hasNull;
    const optionalReason: FieldShape["optionalReason"] =
      missing > 0 && hasNull ? "missing-and-null" : missing > 0 ? "missing" : hasNull ? "null" : undefined;

    fields.set(key, {
      path: childPath,
      originalKey: key,
      shape: childShape,
      optional,
      observedCount,
      parentTotal,
      optionalReason,
    });
  }

  if (
    fields.size >= opts.mapMinKeys &&
    looksDynamic(o) &&
    allFieldShapesEqual(fields)
  ) {
    const first = [...fields.values()][0]!;
    diag.warn(
      "infer.map_candidate",
      `Object at ${path} treated as std.StringHashMap (${fields.size} keys, homogeneous values)`,
      { path },
    );
    return { kind: "map", valuePath: first.path, value: first.shape };
  }

  return { kind: "object", path, fields };
}

function inferUnion(
  elementPath: string,
  items: ZValue[],
  opts: ZigshapeOptions,
  diag: DiagnosticBag,
): Shape | null {
  if (!items.every((v) => v.kind === "object")) return null;
  const objects = items as ZObject[];

  const tagField = pickTagField(objects);
  if (!tagField) return null;

  const groups = new Map<string, ZObject[]>();
  for (const obj of objects) {
    const v = obj.fields.get(tagField)?.value;
    if (!v || v.kind !== "string") return null;
    const list = groups.get(v.value);
    if (list) list.push(obj);
    else groups.set(v.value, [obj]);
  }
  if (groups.size < 2) return null;

  const variants: UnionVariant[] = [];
  const seenNames = new Set<string>();
  for (const [tagValue, groupItems] of groups) {
    const stripped = groupItems.map((o) => stripField(o, tagField));
    const subObs = observeSamples(stripped);
    const subShape = inferAt(ROOT_PATH, subObs, opts, diag);
    const base = sanitizeStructName(tagValue) || "Variant";
    let variantName = base;
    let i = 2;
    while (seenNames.has(variantName)) variantName = `${base}_${i++}`;
    seenNames.add(variantName);
    variants.push({
      tagValue,
      variantName,
      shape: subShape,
      observedCount: groupItems.length,
    });
  }

  diag.warn(
    "infer.union_candidate",
    `Array at ${elementPath} treated as tagged union on '${tagField}' (${variants.length} variants)`,
    { path: elementPath },
  );

  return { kind: "union", path: elementPath, tagField, variants };
}

function pickTagField(objects: ZObject[]): string | null {
  if (objects.length < 2) return null;
  const candidates = new Set<string>();
  for (const k of objects[0]!.fields.keys()) candidates.add(k);
  for (let i = 1; i < objects.length; i++) {
    for (const c of [...candidates]) {
      if (!objects[i]!.fields.has(c)) candidates.delete(c);
    }
  }
  for (const c of [...candidates]) {
    const allString = objects.every((o) => o.fields.get(c)?.value.kind === "string");
    if (!allString) candidates.delete(c);
  }
  if (candidates.size === 0) return null;

  for (const pref of TAG_FIELD_PREFERENCES) {
    if (candidates.has(pref) && distinctValues(objects, pref) >= 2) return pref;
  }
  let best: { name: string; distinct: number } | null = null;
  for (const c of candidates) {
    const distinct = distinctValues(objects, c);
    if (distinct < 2) continue;
    if (!best || distinct > best.distinct) best = { name: c, distinct };
  }
  return best?.name ?? null;
}

function distinctValues(objects: ZObject[], field: string): number {
  const set = new Set<string>();
  for (const o of objects) {
    const v = o.fields.get(field)?.value;
    if (v?.kind === "string") set.add(v.value);
  }
  return set.size;
}

function stripField(obj: ZObject, field: string): ZObject {
  if (!obj.fields.has(field)) return obj;
  const fields = new Map(obj.fields);
  fields.delete(field);
  return { kind: "object", fields, src: obj.src };
}

function activeKinds(o: Observation): ValueKind[] {
  const out: ValueKind[] = [];
  for (const [k, c] of o.countByKind) if (c > 0) out.push(k);
  return out;
}

function looksDynamic(o: Observation): boolean {
  if (o.childKeyHasNonIdent) return true;
  if (o.childKeyOrder.every((k) => /^\d+$/.test(k))) return true;
  if (o.childKeyOrder.every((k) => /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i.test(k))) return true;
  return false;
}

function allFieldShapesEqual(fields: Map<string, FieldShape>): boolean {
  const it = fields.values();
  const first = it.next();
  if (first.done) return false;
  for (const f of fields.values()) {
    if (f.optional !== first.value.optional) return false;
    if (!shapesEqual(f.shape, first.value.shape)) return false;
  }
  return true;
}

export { DEFAULT_OPTIONS };
