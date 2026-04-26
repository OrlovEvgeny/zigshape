import type { ReportField, SchemaReport } from "./report";

export type DriftEntry =
  | { kind: "added"; path: string; type: string }
  | { kind: "removed"; path: string; type: string }
  | { kind: "type-changed"; path: string; from: string; to: string }
  | { kind: "nullable-changed"; path: string; from: boolean; to: boolean }
  | { kind: "aliases-changed"; path: string; from: string[]; to: string[] }
  | { kind: "root-renamed"; from: string; to: string };

export type DriftSeverity = "breaking" | "compatible";

export type DriftReport = {
  entries: (DriftEntry & { severity: DriftSeverity })[];
  hasBreaking: boolean;
};

/** Compare two schema reports.  An entry is "breaking" iff a downstream
 *  consumer of the previous report's wire types could fail when handed data
 *  matching the new report — i.e. removed fields, type changes, optional →
 *  required transitions, or alias removals.  New fields and required → optional
 *  are "compatible". */
export function diffReports(prev: SchemaReport, next: SchemaReport): DriftReport {
  const entries: (DriftEntry & { severity: DriftSeverity })[] = [];

  if (prev.root !== next.root) {
    entries.push({ kind: "root-renamed", from: prev.root, to: next.root, severity: "breaking" });
  }

  const prevPaths = new Set(Object.keys(prev.fields));
  const nextPaths = new Set(Object.keys(next.fields));

  for (const p of prevPaths) {
    if (!nextPaths.has(p)) {
      entries.push({ kind: "removed", path: p, type: prev.fields[p]!.type, severity: "breaking" });
      continue;
    }
    const a = prev.fields[p]!;
    const b = next.fields[p]!;
    if (a.type !== b.type) {
      entries.push({ kind: "type-changed", path: p, from: a.type, to: b.type, severity: "breaking" });
    }
    if (a.nullable !== b.nullable) {
      // required → nullable is breaking (downstream parsers expected non-null);
      // nullable → required is compatible (callers already handled null).
      const severity: DriftSeverity = !a.nullable && b.nullable ? "breaking" : "compatible";
      entries.push({ kind: "nullable-changed", path: p, from: a.nullable, to: b.nullable, severity });
    }
    const ad = aliasDiff(a, b);
    if (ad) {
      const severity: DriftSeverity = ad.removed ? "breaking" : "compatible";
      entries.push({
        kind: "aliases-changed",
        path: p,
        from: a.aliases ?? [],
        to: b.aliases ?? [],
        severity,
      });
    }
  }

  for (const p of nextPaths) {
    if (prevPaths.has(p)) continue;
    entries.push({ kind: "added", path: p, type: next.fields[p]!.type, severity: "compatible" });
  }

  return { entries, hasBreaking: entries.some((e) => e.severity === "breaking") };
}

function aliasDiff(a: ReportField, b: ReportField): { removed: boolean } | null {
  const A = new Set(a.aliases ?? []);
  const B = new Set(b.aliases ?? []);
  if (A.size === 0 && B.size === 0) return null;
  let removed = false;
  let added = false;
  for (const x of A) if (!B.has(x)) removed = true;
  for (const x of B) if (!A.has(x)) added = true;
  if (!removed && !added) return null;
  return { removed };
}

export function formatDrift(d: DriftReport): string {
  const lines: string[] = [];
  for (const e of d.entries) {
    const tag = e.severity === "breaking" ? "BREAKING" : "compatible";
    switch (e.kind) {
      case "added":
        lines.push(`+ ${e.path}: ${e.type} (${tag})`);
        break;
      case "removed":
        lines.push(`- ${e.path}: ${e.type} (${tag})`);
        break;
      case "type-changed":
        lines.push(`~ ${e.path}: ${e.from} → ${e.to} (${tag})`);
        break;
      case "nullable-changed":
        lines.push(`? ${e.path}: nullable ${e.from} → ${e.to} (${tag})`);
        break;
      case "aliases-changed":
        lines.push(`@ ${e.path}: aliases [${e.from.join(", ")}] → [${e.to.join(", ")}] (${tag})`);
        break;
      case "root-renamed":
        lines.push(`! root: ${e.from} → ${e.to} (${tag})`);
        break;
    }
  }
  return lines.join("\n");
}
