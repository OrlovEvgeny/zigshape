import type {
  Decl,
  EnumDecl,
  NormalizeResult,
  StructDecl,
  UnionDecl,
  ZigField,
} from "./normalize";
import { renderZigType } from "./zig/types";

export type GenerateOptions = {
  /** Decorator hook for struct declarations: invoked once per struct, returning
   *  extra Zig lines to inject at the end of the struct body (e.g. a
   *  `pub const serde = ...;` block).  Lines are inserted as-is and indented
   *  with 4 spaces by the caller — return unindented lines.  Return null /
   *  undefined for no decoration. */
  decorateStruct?: (decl: StructDecl) => string[] | null | undefined;
  /** Decorator hook for enum declarations.  Same contract as decorateStruct. */
  decorateEnum?: (decl: EnumDecl) => string[] | null | undefined;
  /** Decorator hook for union(enum) declarations. */
  decorateUnion?: (decl: UnionDecl) => string[] | null | undefined;
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
    appendDecl(lines, decl, options);
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n") + "\n";
}

function appendDecl(lines: string[], decl: Decl, options: GenerateOptions): void {
  if (decl.kind === "struct") return appendStruct(lines, decl, options);
  if (decl.kind === "enum") return appendEnum(lines, decl, options);
  return appendUnion(lines, decl, options);
}

function appendUnion(lines: string[], decl: UnionDecl, options: GenerateOptions): void {
  const decoration = options.decorateUnion?.(decl) ?? [];
  if (decl.variants.length === 0 && decoration.length === 0) {
    lines.push(`pub const ${decl.name} = union(enum) {};`);
    return;
  }
  lines.push(`pub const ${decl.name} = union(enum) {`);
  for (const v of decl.variants) {
    lines.push(INDENT + v.zigName + ": " + renderZigType(v.payload) + ",");
  }
  if (decoration.length > 0) {
    if (decl.variants.length > 0) lines.push("");
    for (const dl of decoration) lines.push(dl === "" ? "" : INDENT + dl);
  }
  lines.push("};");
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

function appendEnum(lines: string[], decl: EnumDecl, options: GenerateOptions): void {
  const decoration = options.decorateEnum?.(decl) ?? [];
  if (decl.variants.length === 0 && decoration.length === 0) {
    lines.push(`pub const ${decl.name} = enum {};`);
    return;
  }
  lines.push(`pub const ${decl.name} = enum {`);
  for (const v of decl.variants) lines.push(INDENT + v.zigName + ",");
  if (decoration.length > 0) {
    if (decl.variants.length > 0) lines.push("");
    for (const dl of decoration) lines.push(dl === "" ? "" : INDENT + dl);
  }
  lines.push("};");
}

function renderField(f: ZigField): string {
  let s = `${f.name}: ${renderZigType(f.type)}`;
  if (f.defaultExpr !== undefined) s += ` = ${f.defaultExpr}`;
  return s + ",";
}
