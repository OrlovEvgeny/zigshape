export type Shape =
  | { kind: "null" }
  | { kind: "bool" }
  | { kind: "int"; signed: boolean }
  | { kind: "float" }
  | { kind: "string" }
  | { kind: "array"; element: Shape }
  | { kind: "object"; path: string; fields: Map<string, FieldShape> }
  | { kind: "map"; valuePath: string; value: Shape }
  | { kind: "unknown"; reason: UnknownReason };

export type UnknownReason =
  | "no-observations"
  | "only-null"
  | "mixed-scalars"
  | "mixed-shapes";

export type FieldShape = {
  path: string;
  originalKey: string;
  shape: Shape;
  optional: boolean;
  observedCount: number;
  parentTotal: number;
  optionalReason?: "missing" | "null" | "missing-and-null";
};

export function shapesEqual(a: Shape, b: Shape): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "null":
    case "bool":
    case "float":
    case "string":
      return true;
    case "int":
      return a.signed === (b as typeof a).signed;
    case "unknown":
      return a.reason === (b as typeof a).reason;
    case "array":
      return shapesEqual(a.element, (b as typeof a).element);
    case "map":
      return shapesEqual(a.value, (b as typeof a).value);
    case "object": {
      const bo = b as typeof a;
      if (a.fields.size !== bo.fields.size) return false;
      for (const [k, fa] of a.fields) {
        const fb = bo.fields.get(k);
        if (!fb) return false;
        if (fa.optional !== fb.optional) return false;
        if (!shapesEqual(fa.shape, fb.shape)) return false;
      }
      return true;
    }
  }
}
