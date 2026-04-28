import type {
  EnumDecl,
  EnumDeclVariant,
  GenerateOptions,
  NormalizeResult,
  StructDecl,
  UnionDecl,
  ZigField,
} from "@zigshape/core";
import { escapeZigString } from "@zigshape/core";
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

/** Produce GenerateOptions that decorate every struct / enum / union with the
 *  relevant `pub const serde = .{ ... }` block, and add
 *  `const serde = @import("serde");` whenever any decoration is non-empty
 *  (including union tag plumbing, which always needs the serde namespace). */
export function serdeDecorator(
  result: NormalizeResult,
  options: SerdeDecorateOptions = {},
): GenerateOptions {
  const denyUnknownFields = options.denyUnknownFields === true;
  const flattenSet = new Set(options.flattenPaths ?? []);
  const skipSet = new Set(options.skipPaths ?? []);
  const renameAll: RenameAllStrategy = options.renameAll ?? "auto";
  const forcedConvention: Convention | null =
    renameAll !== "auto" && renameAll !== "none" ? renameAll : null;
  const anyDecorated = result.decls.some((d) => {
    if (d.kind === "struct") {
      if (d.fields.some((f) => f.renamed || f.xml || (f.aliases?.length ?? 0) > 0)) return true;
      if (d.fields.some((f) => flattenSet.has(f.path) || skipSet.has(f.path))) return true;
      if (result.xmlRootElement && d.name === result.rootName) return true;
      if (denyUnknownFields) return true;
      if (forcedConvention && d.fields.length > 0) return true;
      return false;
    }
    if (d.kind === "enum") return d.variants.some((v) => v.renamed);
    return true; // union always emits .tag/.tag_field
  });
  return {
    extraImports: anyDecorated ? ['const serde = @import("serde");'] : [],
    decorateStruct: (decl) =>
      buildStructBlock(decl, {
        xmlRoot: result.xmlRootElement && decl.name === result.rootName ? result.xmlRootElement : undefined,
        denyUnknownFields,
        flattenSet,
        skipSet,
        renameAll,
      }),
    decorateEnum: (decl) => buildEnumBlock(decl, renameAll),
    decorateUnion: (decl) => buildUnionBlock(decl),
  };
}

function buildUnionBlock(decl: UnionDecl): string[] {
  const lines: string[] = [];
  lines.push("pub const serde = .{");
  switch (decl.taggingStyle) {
    case "internal":
      lines.push(`    .tag = serde.UnionTag.internal,`);
      lines.push(`    .tag_field = "${escapeZigString(decl.tagField)}",`);
      break;
    case "external":
      lines.push(`    .tag = serde.UnionTag.external,`);
      break;
    case "adjacent":
      lines.push(`    .tag = serde.UnionTag.adjacent,`);
      lines.push(`    .tag_field = "${escapeZigString(decl.tagField)}",`);
      lines.push(`    .content_field = "data",`);
      break;
    case "untagged":
      lines.push(`    .tag = serde.UnionTag.untagged,`);
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
    lines.push(`    .rename_all = serde.NamingConvention.${convention},`);
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
    const list = flattened.map((f) => `.${f.name}`).join(", ");
    lines.push(`    .flatten = .{ ${list} },`);
  }
  if (skipped.length > 0) {
    const list = skipped.map((f) => `.${f.name}`).join(", ");
    lines.push(`    .skip = .{ ${list} },`);
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
    lines.push(`    .rename_all = serde.NamingConvention.${convention},`);
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
