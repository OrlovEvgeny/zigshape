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
 *  Phase D will add per-path `flatten` / `skip` overrides on top. */
export type SerdeDecorateOptions = {
  /** Emit `.deny_unknown_fields = true` on every generated struct. */
  denyUnknownFields?: boolean;
};

/** Produce GenerateOptions that decorate every struct / enum / union with the
 *  relevant `pub const serde = .{ ... }` block, and add
 *  `const serde = @import("serde");` whenever any decoration is non-empty
 *  (including union tag plumbing, which always needs the serde namespace). */
export function serdeDecorator(
  result: NormalizeResult,
  options: SerdeDecorateOptions = {},
): GenerateOptions {
  const denyUnknownFields = options.denyUnknownFields === true;
  const anyDecorated = result.decls.some((d) => {
    if (d.kind === "struct") {
      if (d.fields.some((f) => f.renamed || f.xml || (f.aliases?.length ?? 0) > 0)) return true;
      if (result.xmlRootElement && d.name === result.rootName) return true;
      if (denyUnknownFields) return true;
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
      }),
    decorateEnum: (decl) => buildEnumBlock(decl),
    decorateUnion: (decl) => buildUnionBlock(decl),
  };
}

function buildUnionBlock(decl: UnionDecl): string[] {
  const lines: string[] = [];
  lines.push("pub const serde = .{");
  lines.push(`    .tag = serde.UnionTag.internal,`);
  lines.push(`    .tag_field = "${escapeZigString(decl.tagField)}",`);
  const renamed = decl.variants.filter((v) => v.renamed);
  if (renamed.length > 0) {
    lines.push("    .rename = .{");
    for (const v of renamed) {
      lines.push(`        .${v.zigName} = "${escapeZigString(v.tagValue)}",`);
    }
    lines.push("    },");
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
  opts: { xmlRoot?: string; denyUnknownFields: boolean },
): string[] | null {
  const renamed = decl.fields.filter((f) => f.renamed);
  const attributes = decl.fields.filter((f) => f.xml === "attribute");
  const textFields = decl.fields.filter((f) => f.xml === "text");
  const aliased = decl.fields.filter((f) => f.aliases && f.aliases.length > 0);
  const xmlRoot = opts.xmlRoot;
  const denyUnknownFields = opts.denyUnknownFields;

  if (
    renamed.length === 0 &&
    attributes.length === 0 &&
    textFields.length === 0 &&
    aliased.length === 0 &&
    !xmlRoot &&
    !denyUnknownFields
  ) {
    return null;
  }

  const convention = renamed.length > 0 ? detectConvention(decl) : null;
  const explicit = convention ? [] : renamed;

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

function buildEnumBlock(decl: EnumDecl): string[] | null {
  const renamed = decl.variants.filter((v) => v.renamed);
  if (renamed.length === 0) return null;

  // Try a single naming convention across all variants (renamed AND not).
  const convention = detectEnumConvention(decl.variants);
  const explicit = convention ? [] : renamed;

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

function detectEnumConvention(variants: EnumDeclVariant[]): Convention | null {
  if (variants.length === 0) return null;
  for (const c of ALL_CONVENTIONS) {
    let ok = true;
    let usefulRename = false;
    for (const v of variants) {
      if (v.escaped) {
        ok = false;
        break;
      }
      if (/_$/.test(v.zigName)) {
        ok = false;
        break;
      }
      if (fromSnake(v.zigName, c) !== v.rawValue) {
        ok = false;
        break;
      }
      if (v.renamed) usefulRename = true;
    }
    if (ok && usefulRename) return c;
  }
  return null;
}
