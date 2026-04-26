// Unit-test the pieces of the VS Code extension that don't need the VS Code
// runtime — i.e., the inference + decoration glue.  Full integration testing
// (commands, menus, file dialogs) is handled by VS Code's vscode-test
// harness, which is run separately via `bun run package` in CI.

import { describe, expect, test } from "bun:test";
import { generateZig, runPipeline } from "@zigshape/core";
import { serdeDecorator } from "@zigshape/serde-zig";

function smoke(samples: string[], target: "plain" | "serde-zig"): string {
  const r = runPipeline({ samples, rootName: "User", inferOptions: { format: "auto" } });
  if (!r.normalized) throw new Error("pipeline failed");
  const opts = target === "serde-zig" ? serdeDecorator(r.normalized) : {};
  return generateZig(r.normalized, opts);
}

describe("extension generation surface", () => {
  test("plain target with single JSON sample", () => {
    const code = smoke(['{"id": 1, "name": "Alice"}'], "plain");
    expect(code).toContain("pub const User = struct {");
    expect(code).not.toContain("@import(\"serde\")");
  });

  test("serde-zig target picks up rename_all", () => {
    const code = smoke(['{"userId": 1, "firstName": "Alice"}'], "serde-zig");
    expect(code).toContain('const serde = @import("serde");');
    expect(code).toContain("rename_all = serde.NamingConvention.camel_case");
  });

  test("multiple samples merge into optional fields", () => {
    const code = smoke([
      '{"id": 1, "name": "x"}',
      '{"id": 2}',
    ], "plain");
    expect(code).toContain("name: ?[]const u8 = null");
  });
});
