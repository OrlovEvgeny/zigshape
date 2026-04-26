import type { Diagnostic } from "./diagnostics";
import type { Decl, NormalizeResult, ZigField } from "./normalize";
import { renderZigType } from "./zig/types";

/** JSON schema-report shape.  Stable contract — versioned at v1.  Bumped
 *  whenever the on-disk shape changes in a way that breaks `diffReports`. */
export type SchemaReport = {
  version: 1;
  root: string;
  fields: Record<string, ReportField>;
  decls: ReportDecl[];
  warnings: Diagnostic[];
};

export type ReportField = {
  type: string;
  observed: number;
  total: number;
  nullable: boolean;
  aliases?: string[];
  xml?: "attribute" | "text";
  optionalReason?: string;
};

export type ReportDecl = {
  name: string;
  kind: "struct" | "enum" | "union";
  fields?: string[];
  variants?: string[];
};

export function buildReport(
  normalized: NormalizeResult,
  warnings: Diagnostic[],
): SchemaReport {
  const fields: Record<string, ReportField> = {};
  const decls: ReportDecl[] = [];

  for (const decl of normalized.decls) {
    decls.push(declSummary(decl));
    if (decl.kind !== "struct") continue;
    for (const f of decl.fields) {
      fields[f.path] = fieldEntry(f);
    }
  }

  return {
    version: 1,
    root: normalized.rootName,
    fields,
    decls,
    warnings,
  };
}

function declSummary(decl: Decl): ReportDecl {
  if (decl.kind === "struct") {
    return { name: decl.name, kind: "struct", fields: decl.fields.map((f) => f.name) };
  }
  if (decl.kind === "enum") {
    return { name: decl.name, kind: "enum", variants: decl.variants.map((v) => v.zigName) };
  }
  return { name: decl.name, kind: "union", variants: decl.variants.map((v) => v.zigName) };
}

function fieldEntry(f: ZigField): ReportField {
  const entry: ReportField = {
    type: renderZigType(f.type),
    observed: f.observedCount,
    total: f.parentTotal,
    nullable: f.type.kind === "optional",
  };
  if (f.aliases && f.aliases.length > 0) entry.aliases = [...f.aliases];
  if (f.xml) entry.xml = f.xml;
  if (f.optionalReason) entry.optionalReason = f.optionalReason;
  return entry;
}
