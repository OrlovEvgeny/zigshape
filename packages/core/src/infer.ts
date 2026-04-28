import { DiagnosticBag } from "./diagnostics";
import { DEFAULT_OPTIONS, withDefaults, type UnionStrategy, type ZigshapeOptions } from "./options";
import { observeSamples, ROOT_PATH, type Observation, type ObservationMap, type ValueKind } from "./observe";
import {
  shapesEqual,
  type EnumVariant,
  type FieldShape,
  type Shape,
  type UnionTaggingStyle,
  type UnionVariant,
} from "./shape";
import { sanitizeFieldName, sanitizeStructName } from "./zig/identifier";
import type { ZObject, ZValue } from "./value";

const TAG_FIELD_PREFERENCES = ["type", "kind", "_type", "_tag", "__typename"];

/** Anchored regexes for recognisable string shapes.  Used by `inferString` to
 *  emit `infer.string_shape` warnings when every observed value of a field
 *  matches the same classifier.  Type stays `[]const u8` — the warning is a
 *  hint, not a type change (per the explainability-first design). */
type StringShape = "iso8601" | "uuid" | "url" | "email";
const STRING_SHAPE_PATTERNS: Record<StringShape, RegExp> = {
  iso8601:
    /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/,
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  url: /^https?:\/\/[^\s]+$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

function classifyStringShape(s: string): StringShape | null {
  if (STRING_SHAPE_PATTERNS.iso8601.test(s)) return "iso8601";
  if (STRING_SHAPE_PATTERNS.uuid.test(s)) return "uuid";
  if (STRING_SHAPE_PATTERNS.email.test(s)) return "email";
  if (STRING_SHAPE_PATTERNS.url.test(s)) return "url";
  return null;
}

function classifyAllSamples(samples: Map<string, number>): StringShape | null {
  if (samples.size === 0) return null;
  let style: StringShape | null = null;
  for (const v of samples.keys()) {
    const c = classifyStringShape(v);
    if (c === null) return null;
    if (style === null) style = c;
    else if (style !== c) return null;
  }
  return style;
}

function resolveTaggingStyle(s: UnionStrategy): UnionTaggingStyle | null {
  if (s === "off") return null;
  if (s === "tagged") return "internal";
  return s;
}

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
      const taggingStyle = resolveTaggingStyle(opts.unions);
      if (
        taggingStyle &&
        elementObs &&
        !elementObs.objectItemsOverflowed &&
        elementObs.objectItems &&
        elementObs.objectItems.length >= 2
      ) {
        const union = inferUnion(elementPath, elementObs.objectItems, taggingStyle, opts, diag);
        if (union) return { kind: "array", path, element: union };
      }
      const element = inferAt(elementPath, obs, opts, diag);
      return { kind: "array", path, element };
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
  // String-shape hint: emit a warning when every observed value at this path
  // matches the same recognisable shape (ISO-8601 datetime / UUID / URL /
  // email).  Type stays `[]const u8` — we surface the hint without silently
  // changing types, consistent with the explainability-first design.
  if (o.stringSamples && o.stringSamples.size > 0 && !o.stringSamplesOverflowed) {
    const shape = classifyAllSamples(o.stringSamples);
    if (shape) {
      diag.warn(
        "infer.string_shape",
        `Strings at ${path} look like ${shape}; emitted as []const u8. Override the field for a custom type.`,
        { path },
      );
    }
  }

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
      xml: o.childKeyXml?.get(key),
    });
  }

  if (opts.aliases !== "off") inferAliases(path, fields, o, diag);

  if (shouldEmitMap(opts, fields, o)) {
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

function shouldEmitMap(
  opts: ZigshapeOptions,
  fields: Map<string, FieldShape>,
  o: Observation,
): boolean {
  if (opts.maps === "struct") return false;
  if (fields.size === 0) return false;
  if (!allFieldShapesEqual(fields)) return false;
  if (opts.maps === "hash-map") return fields.size >= 2;
  // auto
  return fields.size >= opts.mapMinKeys && looksDynamic(o);
}

/** Greedy alias detection.  For sibling optional fields with structurally
 *  equal shapes that never co-occur in the same sample, fold them into one
 *  canonical field with `aliases` set.  The canonical is the field with the
 *  highest observed count (ties broken by source-order, which `Map` preserves).
 *
 *  Uses `o.childKeyBySample` populated by `observe`; if absent (e.g. older
 *  observation maps), the pass is a no-op. */
function inferAliases(
  parentPath: string,
  fields: Map<string, FieldShape>,
  o: Observation,
  diag: DiagnosticBag,
): void {
  const presence = o.childKeyBySample;
  if (!presence) return;
  if (fields.size < 2) return;

  // Group optional candidates into shape-equivalence classes.  Skip XML-tagged
  // fields — attribute / text identity is positional and shouldn't merge.
  const classes: string[][] = [];
  for (const [key, fs] of fields) {
    if (!fs.optional) continue;
    if (fs.xml) continue;
    let placed = false;
    for (const cls of classes) {
      const anchorShape = fields.get(cls[0]!)!.shape;
      if (shapesEqual(anchorShape, fs.shape)) {
        cls.push(key);
        placed = true;
        break;
      }
    }
    if (!placed) classes.push([key]);
  }

  for (const cls of classes) {
    if (cls.length < 2) continue;
    // Sort by observed count desc, then by original-key order (already
    // preserved in `cls` as we walked `fields` in insertion order, so a stable
    // sort gets us tie-break by source order).
    cls.sort((a, b) => fields.get(b)!.observedCount - fields.get(a)!.observedCount);
    const canonical = cls[0]!;
    const canonField = fields.get(canonical)!;
    const accum = new Set<number>(presence.get(canonical) ?? []);
    const merged: string[] = [];
    for (let i = 1; i < cls.length; i++) {
      const k = cls[i]!;
      const p = presence.get(k);
      if (!p) continue;
      let overlap = false;
      for (const s of p) if (accum.has(s)) { overlap = true; break; }
      if (overlap) continue;
      merged.push(k);
      for (const s of p) accum.add(s);
    }
    if (merged.length === 0) continue;

    canonField.aliases = merged;
    canonField.observedCount = accum.size;
    if (accum.size === o.total) {
      canonField.optional = false;
      canonField.optionalReason = undefined;
    }
    for (const k of merged) fields.delete(k);

    diag.warn(
      "infer.alias_candidate",
      `Object at ${parentPath} treats '${canonical}' as canonical with aliases [${merged.join(", ")}] (mutually exclusive across samples)`,
      { path: canonField.path },
    );
  }
}

function inferUnion(
  elementPath: string,
  items: ZValue[],
  taggingStyle: UnionTaggingStyle,
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
    `Array at ${elementPath} treated as ${taggingStyle}-tagged union on '${tagField}' (${variants.length} variants)`,
    { path: elementPath },
  );

  // Untagged unions rely on serde.zig disambiguating variants by structure
  // alone — flag overlaps the user must resolve manually.
  if (taggingStyle === "untagged") {
    for (let i = 0; i < variants.length; i++) {
      for (let j = i + 1; j < variants.length; j++) {
        if (shapesEqual(variants[i]!.shape, variants[j]!.shape)) {
          diag.warn(
            "infer.union_untagged_overlap",
            `Untagged union at ${elementPath} has structurally identical variants '${variants[i]!.tagValue}' and '${variants[j]!.tagValue}'; serde.zig cannot disambiguate them`,
            { path: elementPath },
          );
        }
      }
    }
  }

  return { kind: "union", path: elementPath, tagField, variants, taggingStyle };
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
