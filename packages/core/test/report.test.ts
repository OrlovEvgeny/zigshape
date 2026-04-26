import { describe, expect, test } from "bun:test";
import { runPipeline } from "../src/pipeline";
import { buildReport } from "../src/report";
import { diffReports } from "../src/drift";

function report(rootName: string, samples: string[]) {
  const { normalized, warnings } = runPipeline({ samples, rootName });
  if (!normalized) throw new Error("pipeline failed");
  return buildReport(normalized, warnings);
}

describe("buildReport", () => {
  test("captures field paths, types, observed counts", () => {
    const r = report("User", ['{"id": 1, "name": "A"}', '{"id": 2}']);
    expect(r.version).toBe(1);
    expect(r.root).toBe("User");
    expect(Object.keys(r.fields).sort()).toEqual(["$.id", "$.name"]);
    expect(r.fields["$.id"]!.type).toBe("u8");
    expect(r.fields["$.id"]!.nullable).toBe(false);
    expect(r.fields["$.id"]!.observed).toBe(2);
    expect(r.fields["$.id"]!.total).toBe(2);
    expect(r.fields["$.name"]!.nullable).toBe(true);
    expect(r.fields["$.name"]!.observed).toBe(1);
    expect(r.fields["$.name"]!.optionalReason).toBe("missing");
  });

  test("captures aliases", () => {
    const r = report("Cfg", [
      '{"url": "x"}',
      '{"uri": "y"}',
      '{"endpoint": "z"}',
    ]);
    const entry = Object.values(r.fields)[0]!;
    expect(entry.aliases?.length).toBe(2);
  });

  test("captures decl summary", () => {
    const r = report("U", ['{"id": 1, "name": "x"}']);
    const struct = r.decls.find((d) => d.name === "U");
    expect(struct?.kind).toBe("struct");
    expect(struct?.fields).toEqual(["id", "name"]);
  });
});

describe("diffReports", () => {
  test("identical reports have no entries", () => {
    const a = report("U", ['{"id": 1}']);
    const b = report("U", ['{"id": 1}']);
    const d = diffReports(a, b);
    expect(d.entries).toEqual([]);
    expect(d.hasBreaking).toBe(false);
  });

  test("added field is compatible", () => {
    const a = report("U", ['{"id": 1}']);
    const b = report("U", ['{"id": 1, "name": "x"}']);
    const d = diffReports(a, b);
    expect(d.entries).toContainEqual({
      kind: "added",
      path: "$.name",
      type: "[]const u8",
      severity: "compatible",
    });
    expect(d.hasBreaking).toBe(false);
  });

  test("removed field is breaking", () => {
    const a = report("U", ['{"id": 1, "name": "x"}']);
    const b = report("U", ['{"id": 1}']);
    const d = diffReports(a, b);
    expect(d.entries.some((e) => e.kind === "removed" && e.severity === "breaking")).toBe(true);
    expect(d.hasBreaking).toBe(true);
  });

  test("type change is breaking", () => {
    const a = report("U", ['{"id": 1}']);
    const b = report("U", ['{"id": "one"}']);
    const d = diffReports(a, b);
    expect(d.entries.some((e) => e.kind === "type-changed" && e.severity === "breaking")).toBe(true);
    expect(d.hasBreaking).toBe(true);
  });

  test("optional → required is compatible", () => {
    const a = report("U", ['{"id": 1}', "{}"]);
    const b = report("U", ['{"id": 1}']);
    const d = diffReports(a, b);
    const change = d.entries.find((e) => e.kind === "nullable-changed");
    expect(change?.severity).toBe("compatible");
  });

  test("required → optional is breaking (downstream parsers expected non-null)", () => {
    const a = report("U", ['{"id": 1}']);
    const b = report("U", ['{"id": 1}', "{}"]);
    const d = diffReports(a, b);
    const change = d.entries.find((e) => e.kind === "nullable-changed");
    expect(change?.severity).toBe("breaking");
  });

  test("root rename is breaking", () => {
    const a = report("Old", ['{"id": 1}']);
    const b = report("New", ['{"id": 1}']);
    const d = diffReports(a, b);
    expect(d.hasBreaking).toBe(true);
    expect(d.entries.some((e) => e.kind === "root-renamed")).toBe(true);
  });
});
