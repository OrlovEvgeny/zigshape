import { DiagnosticBag } from "./diagnostics";
import { ROOT_PATH, type Observation, type ObservationMap, type ValueKind } from "./observe";
import { shapesEqual, type FieldShape, type Shape } from "./shape";

export type InferenceResult = {
  root: Shape;
  diagnostics: DiagnosticBag;
};

export type InferOptions = {
  mapMinKeys: number;
};

const DEFAULT_OPTIONS: InferOptions = {
  mapMinKeys: 4,
};

export function infer(observations: ObservationMap, opts: Partial<InferOptions> = {}): InferenceResult {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const diag = new DiagnosticBag();
  const root = inferAt(ROOT_PATH, observations, options, diag);
  return { root, diagnostics: diag };
}

function inferAt(
  path: string,
  obs: ObservationMap,
  opts: InferOptions,
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

  // Multiple non-null kinds.
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
  opts: InferOptions,
  diag: DiagnosticBag,
): Shape {
  switch (kind) {
    case "bool":
      return { kind: "bool" };
    case "string":
      return { kind: "string" };
    case "float":
      return { kind: "float" };
    case "int":
      return { kind: "int", signed: o.intSigned === true };
    case "array": {
      const elementPath = path + "[*]";
      const element = inferAt(elementPath, obs, opts, diag);
      return { kind: "array", element };
    }
    case "object":
      return inferObject(path, o, obs, opts, diag);
    case "null":
      return { kind: "null" };
  }
}

function inferObject(
  path: string,
  o: Observation,
  obs: ObservationMap,
  opts: InferOptions,
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

    // Strip pure-null when we also see real values: shape already reflects that.
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

  // Map detection
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
