import { DiagnosticBag } from "./diagnostics";
import type { Observation, ObservationMap } from "./observe";
import type { FieldShape, Shape, UnionTaggingStyle, UnionVariant } from "./shape";
import { escapeZigString, sanitizeFieldName, sanitizeStructName, singularize } from "./zig/identifier";
import { pickIntWidth, type ZigStringRepr, type ZigType } from "./zig/types";
import type { ArrayStrategy, StringStrategy } from "./options";

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
  /** XML-specific tag carried from the parser.  "attribute" → emit field
   *  in the struct's `xml_attribute = .{ ... }` list.  "text" → drives the
   *  text-node TODO comment in the serde decorator.  Plain target ignores
   *  it. */
  xml?: "attribute" | "text";
  /** Wire-format names that should also deserialize into this field, set by
   *  alias detection.  Drives `.alias` in the serde decorator; plain target
   *  ignores. */
  aliases?: string[];
  /** True when one or more user-supplied overrides modified this field —
   *  drives the inspector's "overridden" badge. */
  overridden?: boolean;
  /** Per-kind observation counts for the inspector breakdown.  e.g.
   *  `{ string: 6, null: 1 }` plus `missing: 3` derived from
   *  `parentTotal - observedCount`.  Only populated when the normalize
   *  caller passes `observations`. */
  kindCounts?: Record<string, number>;
};

/** Per-path override applied at normalize time.  Maps a field path
 *  (`$.user.id`) to a partial replacement of the inferred ZigField. */
export type FieldOverride = {
  type?: string;
  name?: string;
  optional?: boolean;
};

export type Overrides = Record<string, FieldOverride>;

export type StructDecl = {
  kind: "struct";
  name: string;
  path: string;
  fields: ZigField[];
  /** Provenance pointer, useful for the field inspector. */
  fromArrayElement?: boolean;
};

export type EnumDecl = {
  kind: "enum";
  name: string;
  path: string;
  variants: EnumDeclVariant[];
};

export type EnumDeclVariant = {
  /** Identifier as it appears in Zig source (may be `@"…"`). */
  zigName: string;
  escaped: boolean;
  /** Original wire value. */
  rawValue: string;
  /** True when zigName !== rawValue (rename needed for serde). */
  renamed: boolean;
  observedCount: number;
};

export type Decl = StructDecl | EnumDecl | UnionDecl;

export type UnionDecl = {
  kind: "union";
  name: string;
  path: string;
  tagField: string;
  /** Which serde tagging style the decorator should emit.  Inference
   *  groups variants the same way for all four styles (by discriminator);
   *  this flag only affects the emitted `pub const serde = ...` block. */
  taggingStyle: UnionTaggingStyle;
  variants: UnionDeclVariant[];
};

export type UnionDeclVariant = {
  /** Snake-case Zig field name (sanitized from tagValue). */
  zigName: string;
  escaped: boolean;
  /** Original wire tag value. */
  tagValue: string;
  /** True when zigName !== tagValue (rename needed for serde). */
  renamed: boolean;
  /** The variant's payload type — usually a ref to a generated struct. */
  payload: ZigType;
  observedCount: number;
};

export type NormalizeResult = {
  rootName: string;
  /** The type expression for the root. Equals `ref` to rootName when root is an object. */
  rootType: ZigType;
  /** Top-level declarations in DFS order (root first when applicable). */
  decls: Decl[];
  needsStd: boolean;
  /** XML root element name from the parser, plumbed through so the
   *  serde-zig decorator can emit `.xml_root = "<name>"` on the root struct.
   *  Undefined for non-XML inputs. */
  xmlRootElement?: string;
};

export type IntStrategy = "smallest" | "u64" | "i64";

export type NormalizeOptions = {
  rootName: string;
  intStrategy?: IntStrategy;
  stringStrategy?: StringStrategy;
  /** Array codegen strategy.  See `ArrayStrategy`.  Default `"slice"`. */
  arrayStrategy?: ArrayStrategy;
  /** When true, non-optional scalar fields whose observations contain a single
   *  value get that value emitted as a Zig default (e.g. `port: u16 = 3000`).
   *  Requires `observations` to be supplied. */
  defaultsFromSamples?: boolean;
  observations?: ObservationMap;
  /** XML root element name forwarded from the parser for xml_root emission. */
  xmlRootElement?: string;
  /** Per-path field overrides — applied after inference, before the field
   *  type is finalised.  Used by the CLI config file and the web inspector. */
  overrides?: Overrides;
  /** Optional bag for emitting normalize-time warnings (e.g. fixed-array
   *  fallback when observations disagree on length).  Pipeline supplies the
   *  same bag it uses for parse/observe/infer so warnings survive into the
   *  final result. */
  diagnostics?: DiagnosticBag;
};

type NormalizeState = {
  decls: Decl[];
  usedTypeNames: Set<string>;
  needsStd: boolean;
  intStrategy: IntStrategy;
  stringRepr: ZigStringRepr;
  arrayStrategy: ArrayStrategy;
  defaultsFromSamples: boolean;
  observations?: ObservationMap;
  overrides: Overrides;
  diagnostics?: DiagnosticBag;
};

export function normalize(root: Shape, options: NormalizeOptions): NormalizeResult {
  const state: NormalizeState = {
    decls: [],
    usedTypeNames: new Set(),
    needsStd: false,
    intStrategy: options.intStrategy ?? "smallest",
    stringRepr: options.stringStrategy ?? "slice",
    arrayStrategy: options.arrayStrategy ?? "slice",
    defaultsFromSamples: options.defaultsFromSamples ?? false,
    observations: options.observations,
    overrides: options.overrides ?? {},
    diagnostics: options.diagnostics,
  };
  // When root is non-object, the generator emits a top-level alias
  // `pub const <rootName> = <rootType>;`.  Reserve the name now so any inner
  // declaration walked next gets uniqified instead of colliding.
  if (root.kind !== "object") {
    state.usedTypeNames.add(options.rootName);
  }
  const rootType = walkShape(root, options.rootName, state, /*fromArrayElement*/ false);
  return {
    rootName: options.rootName,
    rootType,
    decls: state.decls,
    needsStd: state.needsStd,
    xmlRootElement: options.xmlRootElement,
  };
}

function walkShape(shape: Shape, hint: string, state: NormalizeState, fromArrayElement: boolean): ZigType {
  switch (shape.kind) {
    case "bool":
      return { kind: "bool" };
    case "string":
      return { kind: "string", repr: state.stringRepr };
    case "int":
      return { kind: "int", width: pickIntWidth(shape.min, shape.max, state.intStrategy) };
    case "float":
      return { kind: "f64" };
    case "null":
    case "unknown":
      state.needsStd = true;
      return { kind: "json" };
    case "array": {
      const elementHint = singularize(hint);
      const element = walkShape(shape.element, elementHint, state, /*fromArrayElement*/ true);
      switch (state.arrayStrategy) {
        case "arraylist":
          state.needsStd = true;
          return { kind: "arraylist", element };
        case "fixed": {
          const o = state.observations?.get(shape.path);
          if (
            o &&
            o.arrayMinLen !== undefined &&
            o.arrayMaxLen !== undefined &&
            o.arrayMinLen === o.arrayMaxLen
          ) {
            return { kind: "fixedArray", length: o.arrayMinLen, element };
          }
          state.diagnostics?.warn(
            "infer.fixed_length_unstable",
            `Array at ${shape.path} has variable length across samples (min=${o?.arrayMinLen ?? "?"}, max=${o?.arrayMaxLen ?? "?"}); --arrays fixed fell back to []const T`,
            { path: shape.path },
          );
          return { kind: "slice", element };
        }
        default:
          return { kind: "slice", element };
      }
    }
    case "map": {
      state.needsStd = true;
      const value = walkShape(shape.value, hint + "Value", state, false);
      return { kind: "stringMap", value };
    }
    case "object":
      return walkObject(shape, hint, state, fromArrayElement);
    case "enum":
      return walkEnum(shape, hint, state);
    case "union":
      return walkUnion(shape, hint, state);
  }
}

function walkUnion(
  shape: Extract<Shape, { kind: "union" }>,
  hint: string,
  state: NormalizeState,
): ZigType {
  const baseName = sanitizeStructName(hint) || "Auto";
  const name = uniqify(state.usedTypeNames, baseName);
  state.usedTypeNames.add(name);

  const decl: UnionDecl = {
    kind: "union",
    name,
    path: shape.path,
    tagField: shape.tagField,
    taggingStyle: shape.taggingStyle,
    variants: [],
  };
  state.decls.push(decl);

  const seenVariantNames = new Set<string>();
  for (const v of shape.variants) {
    const sanitizedField = sanitizeFieldName(v.tagValue);
    let zigName = sanitizedField.text;
    let i = 2;
    while (seenVariantNames.has(zigName)) zigName = `${sanitizedField.text}_${i++}`;
    seenVariantNames.add(zigName);
    // Variant payload becomes its own struct (named after the variant).
    const payloadHint = v.variantName;
    const payload = walkShape(v.shape, payloadHint, state, /*fromArrayElement*/ true);
    decl.variants.push({
      zigName,
      escaped: sanitizedField.escaped,
      tagValue: v.tagValue,
      renamed: zigName !== v.tagValue,
      payload,
      observedCount: v.observedCount,
    });
  }
  return { kind: "ref", structName: name };
}

function walkEnum(
  shape: Extract<Shape, { kind: "enum" }>,
  hint: string,
  state: NormalizeState,
): ZigType {
  const baseName = sanitizeStructName(hint) || "Auto";
  const name = uniqify(state.usedTypeNames, baseName);
  state.usedTypeNames.add(name);

  // Resolve identifier collisions across variants AFTER initial sanitization.
  const seen = new Set<string>();
  const decl: EnumDecl = {
    kind: "enum",
    name,
    path: shape.path,
    variants: shape.variants.map((v) => {
      let zigName = v.zigName;
      let i = 2;
      while (seen.has(zigName)) zigName = `${v.zigName}_${i++}`;
      seen.add(zigName);
      return {
        zigName,
        escaped: v.escaped,
        rawValue: v.rawValue,
        renamed: zigName !== v.rawValue,
        observedCount: v.observedCount,
      };
    }),
  };
  state.decls.push(decl);
  return { kind: "ref", structName: name };
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
    kind: "struct",
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
  const override = state.overrides[fieldShape.path];

  // Apply name override before unique-suffixing so the requested name wins
  // collisions deterministically.  Sanitize the override so users can't
  // produce illegal Zig identifiers.
  let sanitized = sanitizeFieldName(originalKey);
  if (override?.name && override.name !== "") {
    sanitized = sanitizeFieldName(override.name);
  }
  const baseName = sanitized.text;
  const finalName = uniqify(usedFieldNames, baseName);
  usedFieldNames.add(finalName);

  // Hint for nested struct naming uses the original key, not the sanitized one,
  // so plural-stripping and casing work on the source name.
  const innerHint = originalKey;
  let type: ZigType;
  if (override?.type && override.type !== "") {
    type = { kind: "raw", text: override.type };
  } else {
    type = walkShape(fieldShape.shape, innerHint, state, false);
  }

  // Decide optionality: explicit override wins; otherwise carry the inferred
  // optionality.  When override forces non-optional on an inferred-optional
  // field, drop the `?` wrapper and the `null` default — the user has stated
  // the field is always present in their data.
  const inferredOptional = fieldShape.optional;
  const wantOptional =
    override?.optional !== undefined ? override.optional : inferredOptional;

  let defaultExpr: string | undefined;
  if (wantOptional) {
    if (type.kind !== "optional") type = { kind: "optional", inner: type };
    defaultExpr = "null";
  } else if (state.defaultsFromSamples && state.observations && !override?.type) {
    const k = fieldShape.shape.kind;
    if (k === "bool" || k === "int" || k === "string") {
      const o = state.observations.get(fieldShape.path);
      if (o) {
        const lit = scalarSingletonLiteral(o, k);
        if (lit !== undefined) defaultExpr = lit;
      }
    }
  }

  const overridden = !!(
    override &&
    ((override.name && override.name !== originalKey) ||
      override.type ||
      override.optional !== undefined)
  );

  let kindCounts: Record<string, number> | undefined;
  if (state.observations) {
    const o = state.observations.get(fieldShape.path);
    if (o) {
      kindCounts = {};
      for (const [k, c] of o.countByKind) if (c > 0) kindCounts[k] = c;
    }
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
    xml: fieldShape.xml,
    aliases: fieldShape.aliases,
    overridden: overridden || undefined,
    kindCounts,
  };
}

function scalarSingletonLiteral(
  o: Observation,
  kind: "bool" | "int" | "string",
): string | undefined {
  switch (kind) {
    case "string": {
      if (!o.stringSamples || o.stringSamples.size !== 1) return undefined;
      const value = [...o.stringSamples.keys()][0]!;
      return `"${escapeZigString(value)}"`;
    }
    case "int": {
      if (o.intMin === undefined || o.intMax === undefined) return undefined;
      if (o.intMin !== o.intMax) return undefined;
      return o.intMin.toString();
    }
    case "bool": {
      const t = o.boolTrue ?? 0;
      const f = o.boolFalse ?? 0;
      if (t > 0 && f === 0) return "true";
      if (f > 0 && t === 0) return "false";
      return undefined;
    }
  }
}

function uniqify(used: ReadonlySet<string>, base: string): string {
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}
