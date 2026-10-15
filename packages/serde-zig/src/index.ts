import type {
  Diagnostic,
  EnumDecl,
  EnumDeclVariant,
  GenerateOptions,
  NormalizeResult,
  StructDecl,
  UnionDecl,
  ZigField,
  ZigType,
} from "@zigshape/core";
import { escapeZigString, renderZigType } from "@zigshape/core";
import { ALL_CONVENTIONS, fromSnake, type Convention } from "./conventions";

export type { Convention };

/** Caller-supplied serde decoration knobs.  Phase A wires `denyUnknownFields`;
 *  Phase H adds per-path `flatten` / `skip` overrides for fields the user
 *  has explicitly tagged. */
export type SerdeDecorateOptions = {
  /** Emit `.deny_unknown_fields = true` on every generated struct. */
  denyUnknownFields?: boolean;
  /** Field paths that should be flattened: emits `.flatten = .{ .field, … }`
   *  on the parent struct.  `flatten` keeps the nested Zig type but flattens
   *  on the wire. */
  flattenPaths?: string[];
  /** Field paths that should be skipped during serialization: emits
   *  `.skip = .{ .field, … }`. */
  skipPaths?: string[];
  /** Force a specific naming convention for `.rename_all` instead of using
   *  the detect-when-it-round-trips heuristic.  `auto` (default) preserves
   *  the existing detection.  `none` disables detection entirely so every
   *  renamed field gets explicit `.rename`.  Otherwise the chosen convention
   *  is always emitted; per-field `.rename` covers any field whose wire key
   *  doesn't round-trip through the convention. */
  renameAll?: RenameAllStrategy;
};

export type RenameAllStrategy =
  | "auto"
  | "none"
  | "snake_case"
  | "camel_case"
  | "pascal_case"
  | "kebab_case"
  | "screaming_snake";

/** serde.zig's `NamingConvention` variant for a convention.  Every variant
 *  is snake_case except `SCREAMING_SNAKE_CASE`. */
function namingConvention(c: Convention): string {
  return c === "screaming_snake" ? "SCREAMING_SNAKE_CASE" : c;
}

/** Produce GenerateOptions that decorate every struct / enum / union with the
 *  relevant `pub const serde = .{ ... }` block.
 *
 *  Inside those blocks options are written as bare enum literals
 *  (`.rename_all = .camel_case`, `.tag = .internal`, `.skip = .{ .f = .always }`)
 *  rather than `serde.NamingConvention.camel_case`: the block itself is a
 *  decl named `serde`, so any reference to the `serde` module from inside
 *  the struct is an ambiguous reference and fails to compile.  serde.zig
 *  coerces the literals to its option enums.  The file still imports the
 *  module so helpers written at file scope (parse helpers, tests) work. */
export function serdeDecorator(
  result: NormalizeResult,
  options: SerdeDecorateOptions = {},
): GenerateOptions {
  const denyUnknownFields = options.denyUnknownFields === true;
  const flattenSet = new Set(options.flattenPaths ?? []);
  const skipSet = new Set(options.skipPaths ?? []);
  const renameAll: RenameAllStrategy = options.renameAll ?? "auto";
  return {
    extraImports: ['const serde = @import("serde");'],
    decorateStruct: (decl) =>
      buildStructBlock(decl, {
        xmlRoot: result.xmlRootElement && decl.name === result.rootName ? result.xmlRootElement : undefined,
        denyUnknownFields,
        flattenSet,
        skipSet,
        renameAll,
      }),
    // serde.zig needs a default to construct a struct whose field it skips.
    fieldDefault: (_decl, field) => (skipSet.has(field.path) ? zeroValue(field.type) : undefined),
    decorateEnum: (decl) => buildEnumBlock(decl, renameAll),
    decorateUnion: (decl) => buildUnionBlock(decl),
  };
}

/** A Zig expression of type `t` with no data in it. */
function zeroValue(t: ZigType): string {
  switch (t.kind) {
    case "bool":
      return "false";
    case "int":
    case "f64":
      return "0";
    case "string":
      if (t.repr === "mut") break;
      return '""';
    case "slice":
      return "&.{}";
    case "optional":
      return "null";
    default:
      break;
  }
  return `@import("std").mem.zeroes(${renderZigType(t)})`;
}

function buildUnionBlock(decl: UnionDecl): string[] {
  const lines: string[] = [];
  lines.push("pub const serde = .{");
  switch (decl.taggingStyle) {
    case "internal":
      lines.push(`    .tag = .internal,`);
      lines.push(`    .tag_field = "${escapeZigString(decl.tagField)}",`);
      break;
    case "external":
      lines.push(`    .tag = .external,`);
      break;
    case "adjacent":
      lines.push(`    .tag = .adjacent,`);
      lines.push(`    .tag_field = "${escapeZigString(decl.tagField)}",`);
      lines.push(`    .content_field = "data",`);
      break;
    case "untagged":
      lines.push(`    .tag = .untagged,`);
      break;
  }
  // `rename` only matters when there's a tag the wire format actually uses.
  // Untagged variants are matched by structure, so renames are irrelevant.
  if (decl.taggingStyle !== "untagged") {
    const renamed = decl.variants.filter((v) => v.renamed);
    if (renamed.length > 0) {
      lines.push("    .rename = .{");
      for (const v of renamed) {
        lines.push(`        .${v.zigName} = "${escapeZigString(v.tagValue)}",`);
      }
      lines.push("    },");
    }
  }
  lines.push("};");
  return lines;
}

function detectConvention(decl: StructDecl): Convention | null {
  if (decl.fields.length === 0) return null;
  for (const c of ALL_CONVENTIONS) {
    let ok = true;
    let usefulRename = false;
    for (const f of decl.fields) {
      if (!fieldFitsConvention(f, c)) {
        ok = false;
        break;
      }
      if (f.renamed) usefulRename = true;
    }
    if (ok && usefulRename) return c;
  }
  return null;
}

function fieldFitsConvention(f: ZigField, c: Convention): boolean {
  if (f.escaped) return false;
  if (/_$/.test(f.name)) return false;
  return fromSnake(f.name, c) === f.originalKey;
}

function buildStructBlock(
  decl: StructDecl,
  opts: {
    xmlRoot?: string;
    denyUnknownFields: boolean;
    flattenSet: ReadonlySet<string>;
    skipSet: ReadonlySet<string>;
    renameAll: RenameAllStrategy;
  },
): string[] | null {
  const renamed = decl.fields.filter((f) => f.renamed);
  const attributes = decl.fields.filter((f) => f.xml === "attribute");
  const textFields = decl.fields.filter((f) => f.xml === "text");
  const aliased = decl.fields.filter((f) => f.aliases && f.aliases.length > 0);
  const flattened = decl.fields.filter((f) => opts.flattenSet.has(f.path));
  const skipped = decl.fields.filter((f) => opts.skipSet.has(f.path));
  const xmlRoot = opts.xmlRoot;
  const denyUnknownFields = opts.denyUnknownFields;
  const forcedConvention: Convention | null =
    opts.renameAll !== "auto" && opts.renameAll !== "none" ? opts.renameAll : null;

  if (
    renamed.length === 0 &&
    attributes.length === 0 &&
    textFields.length === 0 &&
    aliased.length === 0 &&
    flattened.length === 0 &&
    skipped.length === 0 &&
    !xmlRoot &&
    !denyUnknownFields &&
    !(forcedConvention && decl.fields.length > 0)
  ) {
    return null;
  }

  let convention: Convention | null;
  let explicit: ZigField[];
  if (forcedConvention) {
    convention = forcedConvention;
    // Under forced mode, every field whose wire key doesn't round-trip
    // through the chosen convention needs an explicit `.rename` to override
    // it.  Escaped identifiers and trailing-`_` keyword escapes always need
    // explicit rename because no convention can produce them.
    explicit = decl.fields.filter((f) => !fieldFitsConvention(f, forcedConvention));
  } else if (opts.renameAll === "none") {
    convention = null;
    explicit = renamed;
  } else {
    convention = renamed.length > 0 ? detectConvention(decl) : null;
    explicit = convention ? [] : renamed;
  }

  const lines: string[] = [];
  lines.push("pub const serde = .{");
  if (xmlRoot) {
    lines.push(`    .xml_root = "${escapeZigString(xmlRoot)}",`);
  }
  if (attributes.length > 0) {
    const list = attributes.map((f) => `.${f.name}`).join(", ");
    lines.push(`    .xml_attribute = .{ ${list} },`);
  }
  if (convention) {
    lines.push(`    .rename_all = .${namingConvention(convention)},`);
  }
  if (explicit.length > 0) {
    lines.push("    .rename = .{");
    for (const f of explicit) {
      lines.push(`        .${f.name} = "${escapeZigString(f.originalKey)}",`);
    }
    lines.push("    },");
  }
  if (aliased.length > 0) {
    lines.push("    .alias = .{");
    for (const f of aliased) {
      const list = f.aliases!.map((a) => `"${escapeZigString(a)}"`).join(", ");
      lines.push(`        .${f.name} = &.{ ${list} },`);
    }
    lines.push("    },");
  }
  if (flattened.length > 0) {
    // serde.zig iterates `flatten` as a list of field-name strings.
    const list = flattened.map((f) => `"${escapeZigString(f.name)}"`).join(", ");
    lines.push(`    .flatten = &[_][]const u8{ ${list} },`);
  }
  if (skipped.length > 0) {
    // `skip` maps each field to a SkipMode; listing bare names is ignored.
    lines.push("    .skip = .{");
    for (const f of skipped) lines.push(`        .${f.name} = .always,`);
    lines.push("    },");
  }
  if (denyUnknownFields) {
    lines.push("    .deny_unknown_fields = true,");
  }
  for (const f of textFields) {
    lines.push(
      `    // TODO: serde.zig does not document an xml_text mapping for field '${f.name}'; verify behavior.`,
    );
  }
  lines.push("};");
  return lines;
}

function buildEnumBlock(decl: EnumDecl, renameAll: RenameAllStrategy): string[] | null {
  const renamed = decl.variants.filter((v) => v.renamed);
  const forcedConvention: Convention | null =
    renameAll !== "auto" && renameAll !== "none" ? renameAll : null;
  if (renamed.length === 0 && !forcedConvention) return null;
  if (renamed.length === 0 && forcedConvention && decl.variants.length === 0) return null;

  let convention: Convention | null;
  let explicit: typeof renamed;
  if (forcedConvention) {
    convention = forcedConvention;
    explicit = decl.variants.filter((v) => !variantFitsConvention(v, forcedConvention));
  } else if (renameAll === "none") {
    convention = null;
    explicit = renamed;
  } else {
    convention = detectEnumConvention(decl.variants);
    explicit = convention ? [] : renamed;
  }

  const lines: string[] = [];
  lines.push("pub const serde = .{");
  if (convention) {
    lines.push(`    .rename_all = .${namingConvention(convention)},`);
  }
  if (explicit.length > 0) {
    lines.push("    .rename = .{");
    for (const v of explicit) {
      lines.push(`        .${v.zigName} = "${escapeZigString(v.rawValue)}",`);
    }
    lines.push("    },");
  }
  lines.push("};");
  return lines;
}

function variantFitsConvention(v: EnumDeclVariant, c: Convention): boolean {
  if (v.escaped) return false;
  if (/_$/.test(v.zigName)) return false;
  return fromSnake(v.zigName, c) === v.rawValue;
}

function detectEnumConvention(variants: EnumDeclVariant[]): Convention | null {
  if (variants.length === 0) return null;
  for (const c of ALL_CONVENTIONS) {
    let ok = true;
    let usefulRename = false;
    for (const v of variants) {
      if (!variantFitsConvention(v, c)) {
        ok = false;
        break;
      }
      if (v.renamed) usefulRename = true;
    }
    if (ok && usefulRename) return c;
  }
  return null;
}

/** Field types the generated file declares that serde.zig 1.2 can't
 *  deserialize, as diagnostics.  Checked against serde.zig 1.2.3:
 *  - `std.json.Value` holds an allocator, which serde.zig can't construct.
 *  - `[]u8` and `[:0]const u8` fail to compile: every string kind is read
 *    through `deserializeString`, which returns `[]const u8`.
 *  - `serde.Value` is built from typed values, not parsed from input: a
 *    field of that type accepts null and nothing else. */
export function serdeCompatWarnings(result: NormalizeResult): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  const report = (path: string, code: string, message: string) => {
    const key = `${code}@${path}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ severity: "warning", code, message, path });
  };
  const visit = (t: ZigType, path: string, onlyNull = false): void => {
    switch (t.kind) {
      case "serdeValue":
        if (onlyNull) {
          out.push({
            severity: "info",
            code: "serde.value_null_only",
            message: `Only null was seen at ${path}; ?serde.Value reads null, but serde.zig can't parse other input into serde.Value. Set a concrete type once you know it`,
            path,
          });
        } else {
          report(path, "serde.value_unparseable",
            `serde.Value at ${path} won't parse: serde.zig builds serde.Value from typed values and can't read arbitrary input into it. Set a concrete type for this field`);
        }
        return;
      case "json":
        report(path, "serde.unsupported_json_value",
          `std.json.Value at ${path} can't be deserialized by serde.zig; use serde.Value (--unknown serde-value)`);
        return;
      case "string":
        if (t.repr === "mut" || t.repr === "sentinel") {
          const name = t.repr === "mut" ? "[]u8" : "[:0]const u8";
          report(path, "serde.unsupported_string",
            `${name} at ${path} doesn't compile with serde.zig 1.2, which reads strings as []const u8; use --strings slice`);
        }
        return;
      case "raw":
        if (t.text.includes("std.json.Value")) {
          report(path, "serde.unsupported_json_value",
            `Override ${t.text} at ${path} uses std.json.Value, which serde.zig can't deserialize; use serde.Value`);
        }
        return;
      case "optional":
        return visit(t.inner, path, onlyNull);
      case "slice":
      case "arraylist":
      case "fixedArray":
        return visit(t.element, `${path}[]`);
      case "stringMap":
        return visit(t.value, `${path}{}`);
      default:
        return;
    }
  };
  for (const d of result.decls) {
    if (d.kind === "struct") {
      for (const f of d.fields) {
        const kinds = Object.keys(f.kindCounts ?? {});
        visit(f.type, f.path, kinds.length === 1 && kinds[0] === "null");
      }
    }
    if (d.kind === "union") for (const v of d.variants) visit(v.payload, d.path);
  }
  if (result.rootType.kind !== "ref") visit(result.rootType, "$");
  return out;
}
