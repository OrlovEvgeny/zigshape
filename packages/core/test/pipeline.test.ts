import { describe, expect, test } from "bun:test";
import { generateZig } from "../src/generate";
import { runPipeline } from "../src/pipeline";
import type { StructDecl } from "../src/normalize";

describe("runPipeline", () => {
  test("happy path", () => {
    const r = runPipeline({
      samples: ['{"id": 1, "name": "A"}', '{"id": 2}'],
      rootName: "User",
    });
    expect(r.normalized).not.toBeNull();
    const root = r.normalized!.decls[0] as StructDecl;
    expect(root.fields.find((f) => f.name === "name")!.defaultExpr).toBe("null");
    const code = generateZig(r.normalized!);
    expect(code).toContain("name: ?[]const u8 = null");
  });

  test("merges parse, infer, and observe diagnostics", () => {
    const r = runPipeline({
      samples: ['{"x": 1}', '{"x": 1.5}'],
      rootName: "X",
    });
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain("infer.int_float_mix");
  });

  test("all-parse-failure returns null and carries errors", () => {
    const r = runPipeline({
      samples: ["{ this is not json"],
      rootName: "Bad",
    });
    expect(r.normalized).toBeNull();
    expect(r.warnings.some((w) => w.severity === "error")).toBe(true);
  });

  test("partial parse failure: one good sample is enough", () => {
    const r = runPipeline({
      samples: ['{"id": 1}', "{ broken"],
      rootName: "X",
    });
    expect(r.normalized).not.toBeNull();
    expect(r.warnings.some((w) => w.severity === "error")).toBe(true);
  });

  test("empty input list", () => {
    const r = runPipeline({ samples: [], rootName: "X" });
    expect(r.normalized).toBeNull();
    expect(r.warnings).toHaveLength(0);
  });
});
