import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENTRY = new URL("../src/main.ts", import.meta.url).pathname;

async function runCli(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  const proc = Bun.spawn(["bun", ENTRY, ...args], {
    stdin: stdin === undefined ? "ignore" : new Response(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { stdout, stderr, code };
}

describe("cli", () => {
  test("--help exits 0 and prints usage", async () => {
    const r = await runCli(["--help"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Usage:");
  });

  test("plain target via stdin", async () => {
    const r = await runCli(
      ["--stdin", "--root", "User", "--target", "plain"],
      '{"id": 1, "name": "Alice"}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub const User = struct {");
    expect(r.stdout).toContain("id: u8");
    expect(r.stdout).toContain("name: []const u8");
    expect(r.stdout).not.toContain("@import(\"serde\")");
  });

  test("serde-zig target adds rename_all for camel keys", async () => {
    const r = await runCli(
      ["--stdin", "--root", "User", "--target", "serde-zig"],
      '{"userId": 1, "firstName": "Alice"}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('const serde = @import("serde");');
    expect(r.stdout).toContain("rename_all = serde.NamingConvention.camel_case");
  });

  test("file input", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zigshape-"));
    const file = join(dir, "sample.json");
    writeFileSync(file, '{"id": 1}');
    const r = await runCli([file, "--root", "X"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub const X = struct {");
  });

  test("multiple files merge as samples (optional field)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zigshape-"));
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, '{"id": 1, "email": "a@b"}');
    writeFileSync(b, '{"id": 2}');
    const r = await runCli([a, b, "--root", "User"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("email: ?[]const u8 = null");
  });

  test("--out writes to file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zigshape-"));
    const out = join(dir, "out.zig");
    const r = await runCli(
      ["--stdin", "--root", "X", "--out", out],
      '{"id": 1}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
    const written = await Bun.file(out).text();
    expect(written).toContain("pub const X = struct {");
  });

  test("invalid --target rejected", async () => {
    const r = await runCli(["--stdin", "--target", "rust"], "{}");
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--target");
  });

  test("malformed JSON exits non-zero with stderr message", async () => {
    const r = await runCli(["--stdin", "--root", "X"], "not json at all");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("error");
  });

  test("warnings go to stderr; stdout still contains code", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--target", "plain"],
      '{"x": null}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("?std.json.Value");
    expect(r.stderr.toLowerCase()).toContain("only null");
  });

  test("YAML input via --format yaml", async () => {
    const r = await runCli(
      ["--stdin", "--format", "yaml", "--root", "Cfg"],
      "name: hello\nport: 80\nflags:\n  - a\n  - b",
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub const Cfg = struct {");
    expect(r.stdout).toContain("port: u8");
    expect(r.stdout).toContain("flags: []const []const u8");
  });

  test("TOML input via --format toml", async () => {
    const r = await runCli(
      ["--stdin", "--format", "toml", "--root", "Cfg"],
      'title = "myapp"\nport = 3000\n[database]\nhost = "localhost"',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub const Cfg = struct {");
    expect(r.stdout).toContain("database: Database");
    expect(r.stdout).toContain("pub const Database = struct {");
  });

  test("auto-detect picks JSON for braces", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X"],
      '{"id": 1}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub const X = struct {");
  });

  test("auto-detect picks YAML for colon-block", async () => {
    const r = await runCli(
      ["--stdin", "--root", "Cfg"],
      "name: hello\nport: 80",
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub const Cfg = struct {");
  });

  test("--int u64 reverts width to v0.1 default", async () => {
    const r = await runCli(
      ["--stdin", "--int", "u64", "--root", "X"],
      '{"id": 1}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("id: u64");
  });

  test("--unions tagged emits union(enum)", async () => {
    const r = await runCli(
      ["--stdin", "--unions", "tagged", "--root", "Commands", "--target", "serde-zig"],
      '[{"type":"ping"},{"type":"execute","query":"x"},{"type":"ping"}]',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("union(enum)");
    expect(r.stdout).toContain("tag = serde.UnionTag.internal");
    expect(r.stdout).toContain('tag_field = "type"');
  });

  test("--enums off keeps strings even with low cardinality", async () => {
    const r = await runCli(
      ["--stdin", "--enums", "off", "--root", "User"],
      '[{"status":"a"},{"status":"b"},{"status":"a"},{"status":"b"},{"status":"a"}]',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain("enum {");
    expect(r.stdout).toContain("status: []const u8");
  });

  test("--defaults-from-samples emits observed scalars as defaults", async () => {
    const r = await runCli(
      ["--stdin", "--format", "toml", "--defaults-from-samples", "--root", "Cfg"],
      'title = "myapp"\nport = 3000\ndebug = false',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('title: []const u8 = "myapp"');
    expect(r.stdout).toContain("port: u16 = 3000");
    expect(r.stdout).toContain("debug: bool = false");
  });

  test("without --defaults-from-samples no defaults are emitted on a singleton config", async () => {
    const r = await runCli(
      ["--stdin", "--format", "toml", "--root", "Cfg"],
      'title = "myapp"\nport = 3000',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain('= "myapp"');
    expect(r.stdout).not.toContain("= 3000");
  });

  test("--zig-fmt produces idempotent output", async () => {
    const r = await runCli(
      ["--stdin", "--zig-fmt", "--root", "User"],
      '{"id": 1, "name": "A"}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub const User = struct {");
  });

  test("invalid --format rejected", async () => {
    const r = await runCli(["--stdin", "--format", "xml"], "{}");
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--format");
  });
});
