import { describe, expect, test } from "bun:test";
import { runPipeline } from "../src/pipeline";
import { generateZig } from "../src/generate";

function gen(rootName: string, samples: string[], overrides: Record<string, { type?: string; name?: string; optional?: boolean }>) {
  const r = runPipeline({ samples, rootName, overrides });
  if (!r.normalized) throw new Error("pipeline failed");
  return { code: generateZig(r.normalized), result: r.normalized };
}

describe("normalize overrides", () => {
  test("type override replaces inferred Zig type with raw text", () => {
    const { code } = gen("U", ['{"id": 1}'], { "$.id": { type: "[]const u8" } });
    expect(code).toContain("id: []const u8");
    expect(code).not.toContain("id: u8");
  });

  test("name override renames field, sanitizing if needed", () => {
    const { code } = gen("U", ['{"id": 1}'], { "$.id": { name: "userId" } });
    expect(code).toContain("user_id: u8");
  });

  test("optional=true forces ? wrapper and null default on a required field", () => {
    const { code } = gen("U", ['{"id": 1}'], { "$.id": { optional: true } });
    expect(code).toContain("id: ?u8 = null");
  });

  test("optional=false drops ? wrapper from an inferred-optional field", () => {
    const { code } = gen("U", ['{"id": 1}', "{}"], { "$.id": { optional: false } });
    expect(code).toContain("id: u8");
    expect(code).not.toContain("?u8 = null");
  });

  test("overridden flag is set on touched fields", () => {
    const { result } = gen("U", ['{"id": 1, "name": "x"}'], {
      "$.id": { type: "[]const u8" },
    });
    const struct = result.decls.find((d) => d.kind === "struct" && d.name === "U") as
      | { kind: "struct"; fields: { name: string; overridden?: boolean }[] }
      | undefined;
    const idField = struct?.fields.find((f) => f.name === "id");
    const nameField = struct?.fields.find((f) => f.name === "name");
    expect(idField?.overridden).toBe(true);
    expect(nameField?.overridden).toBeUndefined();
  });

  test("paths with no override leave the field untouched", () => {
    const { code } = gen("U", ['{"id": 1, "name": "x"}'], { "$.nope": { type: "void" } });
    expect(code).toContain("id: u8");
    expect(code).toContain("name: []const u8");
    expect(code).not.toContain("void");
  });

  test("missing or empty overrides match nothing", () => {
    const { code } = gen("U", ['{"id": 1}'], { "$.id": { type: "" } });
    expect(code).toContain("id: u8");
  });
});
