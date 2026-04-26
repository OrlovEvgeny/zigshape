import type { NormalizeResult, StructDecl, ZigField } from "./normalize";
import { renderZigType } from "./zig/types";

export type GenerateOptions = {
  /** Decorator hook: invoked once per struct decl, returning extra Zig lines to
   *  inject at the end of the struct body (e.g. the `pub const serde = ...;` block).
   *  Lines are inserted as-is and indented with 4 spaces by the caller — return
   *  unindented lines.  Return null/undefined for no decoration. */
  decorateStruct?: (decl: StructDecl) => string[] | null | undefined;
  /** Extra import lines (e.g. `const serde = @import("serde");`). */
  extraImports?: string[];
};

const INDENT = "    ";

export function generateZig(result: NormalizeResult, options: GenerateOptions = {}): string {
  const lines: string[] = [];
  const imports: string[] = [];
  if (result.needsStd) imports.push('const std = @import("std");');
  for (const im of options.extraImports ?? []) imports.push(im);
  if (imports.length > 0) {
    lines.push(...imports);
    lines.push("");
  }

  const rootHasMatchingDecl =
    result.rootType.kind === "ref" &&
    result.rootType.structName === result.rootName &&
    result.decls.some((d) => d.name === result.rootName);

  if (!rootHasMatchingDecl) {
    lines.push(`pub const ${result.rootName} = ${renderZigType(result.rootType)};`);
    lines.push("");
  }

  for (const decl of result.decls) {
    appendStruct(lines, decl, options);
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n") + "\n";
}

function appendStruct(lines: string[], decl: StructDecl, options: GenerateOptions): void {
  const decoration = options.decorateStruct?.(decl) ?? [];
  if (decl.fields.length === 0 && decoration.length === 0) {
    lines.push(`pub const ${decl.name} = struct {};`);
    return;
  }
  lines.push(`pub const ${decl.name} = struct {`);
  for (const f of decl.fields) lines.push(INDENT + renderField(f));
  if (decoration.length > 0) {
    if (decl.fields.length > 0) lines.push("");
    for (const dl of decoration) lines.push(dl === "" ? "" : INDENT + dl);
  }
  lines.push("};");
}

function renderField(f: ZigField): string {
  let s = `${f.name}: ${renderZigType(f.type)}`;
  if (f.defaultExpr !== undefined) s += ` = ${f.defaultExpr}`;
  return s + ",";
}
