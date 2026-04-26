export type Shape =
  | { kind: "null" }
  | { kind: "bool" }
  | { kind: "int"; signed: boolean; min: bigint; max: bigint }
  | { kind: "float" }
  | { kind: "string" }
  | { kind: "array"; element: Shape }
  | { kind: "object"; path: string; fields: Map<string, FieldShape> }
  | { kind: "map"; valuePath: string; value: Shape }
  | { kind: "enum"; path: string; variants: EnumVariant[] }
  | { kind: "union"; path: string; tagField: string; variants: UnionVariant[] }
  | { kind: "unknown"; reason: UnknownReason };

export type UnionVariant = {
  /** Tag value as it appeared in the wire data. */
  tagValue: string;
  /** Suggested PascalCase variant identifier. */
  variantName: string;
  /** Variant body shape — usually an object struct minus the tag field. */
  shape: Shape;
  observedCount: number;
};

export type EnumVariant = {
  /** Identifier as it appears in Zig source (may be `@"…"`). */
  zigName: string;
  escaped: boolean;
  /** Original wire value. */
  rawValue: string;
  observedCount: number;
};

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
  /** XML-specific tag stamped from observation.  Drives `xml_attribute`
   *  emission in the serde decorator and the text-node TODO comment.
   *  Undefined for non-XML inputs. */
  xml?: "attribute" | "text";
  /** Wire-format names that should also deserialize into this field.  Set by
   *  alias detection when sibling fields with identical shapes never co-occur
   *  in the same sample.  Drives `.alias = .{ ... }` in the serde decorator;
   *  the plain target ignores it. */
  aliases?: string[];
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
      // Structural equality: width / signedness are width-picker concerns,
      // not part of the shape's identity for map / union detection.
      return true;
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
    case "enum": {
      const be = b as typeof a;
      if (a.variants.length !== be.variants.length) return false;
      const aSet = new Set(a.variants.map((v) => v.rawValue));
      for (const v of be.variants) if (!aSet.has(v.rawValue)) return false;
      return true;
    }
    case "union": {
      const bu = b as typeof a;
      if (a.tagField !== bu.tagField) return false;
      if (a.variants.length !== bu.variants.length) return false;
      const aTags = new Set(a.variants.map((v) => v.tagValue));
      for (const v of bu.variants) if (!aTags.has(v.tagValue)) return false;
      return true;
    }
  }
}
