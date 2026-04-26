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

/** Produce GenerateOptions that decorate every struct / enum / union with the
 *  relevant `pub const serde = .{ ... }` block, and add
 *  `const serde = @import("serde");` whenever any decoration is non-empty
 *  (including union tag plumbing, which always needs the serde namespace). */
export function serdeDecorator(result: NormalizeResult): GenerateOptions {
  const anyRenamed = result.decls.some((d) => {
    if (d.kind === "struct") return d.fields.some((f) => f.renamed);
    if (d.kind === "enum") return d.variants.some((v) => v.renamed);
    return true; // union always emits .tag/.tag_field
  });
  return {
    extraImports: anyRenamed ? ['const serde = @import("serde");'] : [],
    decorateStruct: (decl) => buildStructBlock(decl),
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

function buildStructBlock(decl: StructDecl): string[] | null {
  const renamed = decl.fields.filter((f) => f.renamed);
  if (renamed.length === 0) return null;

  const convention = detectConvention(decl);
  const explicit = convention ? [] : renamed;

  const lines: string[] = [];
  lines.push("pub const serde = .{");
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
