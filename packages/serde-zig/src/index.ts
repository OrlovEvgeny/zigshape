import type { GenerateOptions, NormalizeResult, StructDecl, ZigField } from "@zigshape/core";
import { escapeZigString } from "@zigshape/core";
import { ALL_CONVENTIONS, fromSnake, type Convention } from "./conventions";

export type { Convention };

/** Produce GenerateOptions that decorate every struct with `pub const serde = .{ ... }`
 *  and add `const serde = @import("serde");` to the file's imports when any struct
 *  requires it. */
export function serdeDecorator(result: NormalizeResult): GenerateOptions {
  const anyRenamed = result.decls.some((d) => d.fields.some((f) => f.renamed));
  return {
    extraImports: anyRenamed ? ['const serde = @import("serde");'] : [],
    decorateStruct: (decl) => buildSerdeBlock(decl),
  };
}

/** Decide whether a single naming convention covers every field's wire name without
 *  introducing per-field explicit overrides.  Strict: every field (renamed or not)
 *  must round-trip via the chosen convention.  Escaped (`@"…"`) and keyword-suffix
 *  (`type_`, `pub_`) fields never qualify — they always need explicit renames. */
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

function buildSerdeBlock(decl: StructDecl): string[] | null {
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
