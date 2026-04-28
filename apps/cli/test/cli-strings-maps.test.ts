import { describe, expect, test } from "bun:test";
import { runCli } from "./_helpers";

describe("--strings", () => {
  test("default emits []const u8", async () => {
    const r = await runCli(["--stdin", "--root", "X"], '{"name": "alice"}');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("name: []const u8");
  });

  test("mut emits []u8", async () => {
    const r = await runCli(["--stdin", "--root", "X", "--strings", "mut"], '{"name": "alice"}');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("name: []u8");
  });

  test("sentinel emits [:0]const u8", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--strings", "sentinel"],
      '{"name": "alice"}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("name: [:0]const u8");
  });

  test("invalid value rejected", async () => {
    const r = await runCli(["--stdin", "--strings", "nope"], '{"x": 1}');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--strings must be slice|mut|sentinel");
  });
});

describe("--maps", () => {
  test("struct disables map detection even with dynamic keys", async () => {
    const r = await runCli(
      ["--stdin", "--root", "Cfg", "--maps", "struct"],
      '{"a-1": {"v": 1}, "a-2": {"v": 2}, "a-3": {"v": 3}, "a-4": {"v": 4}}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain("StringHashMap");
    expect(r.stdout).toContain("pub const Cfg = struct {");
    // dashed keys sanitize to snake_case fields
    expect(r.stdout).toContain("a_1:");
  });

  test("hash-map forces map even with identifier-only keys", async () => {
    const r = await runCli(
      ["--stdin", "--root", "Cfg", "--maps", "hash-map"],
      '{"alice": {"v": 1}, "bob": {"v": 2}}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("std.StringHashMap");
  });

  test("auto preserves existing heuristic", async () => {
    const r = await runCli(
      ["--stdin", "--root", "Cfg"],
      '{"alice": {"v": 1}, "bob": {"v": 2}}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain("StringHashMap");
  });
});
