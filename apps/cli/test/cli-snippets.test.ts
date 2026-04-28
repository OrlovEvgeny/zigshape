import { describe, expect, test } from "bun:test";
import { runCli } from "./_helpers";

describe("--with-parser", () => {
  test("plain + json appends parseUser using std.json.parseFromSlice", async () => {
    const r = await runCli(
      ["--stdin", "--root", "User", "--target", "plain", "--with-parser"],
      '{"id": 1}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub fn parseUser");
    expect(r.stdout).toContain("std.json.parseFromSlice");
    expect(r.stdout).toContain('@import("std")');
  });

  test("serde-zig + yaml uses serde.yaml.fromSlice", async () => {
    const r = await runCli(
      [
        "--stdin",
        "--root",
        "Cfg",
        "--format",
        "yaml",
        "--target",
        "serde-zig",
        "--with-parser",
      ],
      "host: localhost\nport: 80",
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("serde.yaml.fromSlice(Cfg");
    expect(r.stdout).toContain('@import("serde")');
    expect(r.stdout).toContain('@import("std")');
  });
});

describe("--with-tests", () => {
  test("appends a test block using the first sample as input", async () => {
    const r = await runCli(
      ["--stdin", "--root", "User", "--target", "plain", "--with-tests"],
      '{"id": 1, "name": "Alice"}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('test "parse User"');
    expect(r.stdout).toContain("std.heap.ArenaAllocator");
    expect(r.stdout).toContain('\\\\{"id": 1, "name": "Alice"}');
  });
});

describe("--with-build-snippet", () => {
  test("plain target prepends a no-op comment", async () => {
    const r = await runCli(
      ["--stdin", "--root", "U", "--target", "plain", "--with-build-snippet"],
      '{"id": 1}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout.trimStart().startsWith("// build.zig: nothing to add")).toBe(true);
  });

  test("serde-zig prepends b.dependency block", async () => {
    const r = await runCli(
      [
        "--stdin",
        "--root",
        "U",
        "--target",
        "serde-zig",
        "--with-build-snippet",
      ],
      '{"id": 1}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('b.dependency("serde"');
    expect(r.stdout).toContain("build.zig.zon");
  });
});

describe("all snippets together", () => {
  test("imports appear once even when both parser and tests need std", async () => {
    const r = await runCli(
      [
        "--stdin",
        "--root",
        "User",
        "--target",
        "serde-zig",
        "--with-parser",
        "--with-tests",
        "--with-build-snippet",
      ],
      '{"id": 1}',
    );
    expect(r.code).toBe(0);
    const stdImports = r.stdout.match(/@import\("std"\)/g) ?? [];
    expect(stdImports.length).toBe(1);
    const serdeImports = r.stdout.match(/@import\("serde"\)/g) ?? [];
    expect(serdeImports.length).toBe(1);
  });

  test("YAML input on plain target keeps test scaffold but warns about no parser", async () => {
    const r = await runCli(
      [
        "--stdin",
        "--root",
        "Cfg",
        "--format",
        "yaml",
        "--target",
        "plain",
        "--with-parser",
        "--with-tests",
      ],
      "host: localhost",
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("std doesn't ship a YAML parser");
  });
});
