import type { FieldShape, Shape } from "./shape";
import { sanitizeFieldName, sanitizeStructName, singularize } from "./zig/identifier";
import type { ZigType } from "./zig/types";

export type ZigField = {
  /** Identifier as it appears in Zig source (may be `@"…"`). */
  name: string;
  /** True when emitted as `@"…"`. */
  escaped: boolean;
  /** Original JSON key. */
  originalKey: string;
  /** True when `name` does not equal `originalKey` (rename needed for serde). */
  renamed: boolean;
  type: ZigType;
  /** "null" for optionals, undefined otherwise. */
  defaultExpr?: string;
  // provenance for inspector / warnings
  path: string;
  observedCount: number;
  parentTotal: number;
  optionalReason?: string;
};

export type StructDecl = {
  name: string;
  path: string;
  fields: ZigField[];
  /** Provenance pointer, useful for the field inspector. */
  fromArrayElement?: boolean;
};

export type NormalizeResult = {
  rootName: string;
  /** The type expression for the root. Equals `ref` to rootName when root is an object. */
  rootType: ZigType;
  /** Top-level struct declarations in DFS order (root first when applicable). */
  decls: StructDecl[];
  needsStd: boolean;
};

export type NormalizeOptions = {
  rootName: string;
};

type NormalizeState = {
  decls: StructDecl[];
  usedTypeNames: Set<string>;
  needsStd: boolean;
};

export function normalize(root: Shape, options: NormalizeOptions): NormalizeResult {
  const state: NormalizeState = {
    decls: [],
    usedTypeNames: new Set(),
    needsStd: false,
  };
  const rootType = walkShape(root, options.rootName, state, /*fromArrayElement*/ false);
  return {
    rootName: options.rootName,
    rootType,
    decls: state.decls,
    needsStd: state.needsStd,
  };
}

function walkShape(shape: Shape, hint: string, state: NormalizeState, fromArrayElement: boolean): ZigType {
  switch (shape.kind) {
    case "bool":
      return { kind: "bool" };
    case "string":
      return { kind: "string" };
    case "int":
      return { kind: shape.signed ? "i64" : "u64" };
    case "float":
      return { kind: "f64" };
    case "null":
    case "unknown":
      state.needsStd = true;
      return { kind: "json" };
    case "array": {
      const elementHint = singularize(hint);
      const element = walkShape(shape.element, elementHint, state, /*fromArrayElement*/ true);
      return { kind: "slice", element };
    }
    case "map": {
      state.needsStd = true;
      const value = walkShape(shape.value, hint + "Value", state, false);
      return { kind: "stringMap", value };
    }
    case "object":
      return walkObject(shape, hint, state, fromArrayElement);
  }
}

function walkObject(
  shape: Extract<Shape, { kind: "object" }>,
  hint: string,
  state: NormalizeState,
  fromArrayElement: boolean,
): ZigType {
  const baseName = sanitizeStructName(hint) || "Auto";
  const name = uniqify(state.usedTypeNames, baseName);
  state.usedTypeNames.add(name);

  const decl: StructDecl = {
    name,
    path: shape.path,
    fields: [],
    fromArrayElement,
  };
  // Push before walking children so DFS order has parents before children.
  state.decls.push(decl);

  const usedFieldNames = new Set<string>();
  for (const [originalKey, fieldShape] of shape.fields) {
    decl.fields.push(buildField(originalKey, fieldShape, usedFieldNames, state));
  }
  return { kind: "ref", structName: name };
}

function buildField(
  originalKey: string,
  fieldShape: FieldShape,
  usedFieldNames: Set<string>,
  state: NormalizeState,
): ZigField {
  const sanitized = sanitizeFieldName(originalKey);
  const baseName = sanitized.text;
  const finalName = uniqify(usedFieldNames, baseName);
  usedFieldNames.add(finalName);

  // Hint for nested struct naming uses the original key, not the sanitized one,
  // so plural-stripping and casing work on the source name.
  const innerHint = originalKey;
  let type = walkShape(fieldShape.shape, innerHint, state, false);
  let defaultExpr: string | undefined;
  if (fieldShape.optional) {
    type = { kind: "optional", inner: type };
    defaultExpr = "null";
  }

  return {
    name: finalName,
    escaped: sanitized.escaped,
    originalKey,
    renamed: finalName !== originalKey,
    type,
    defaultExpr,
    path: fieldShape.path,
    observedCount: fieldShape.observedCount,
    parentTotal: fieldShape.parentTotal,
    optionalReason: fieldShape.optionalReason,
  };
}

function uniqify(used: ReadonlySet<string>, base: string): string {
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}
