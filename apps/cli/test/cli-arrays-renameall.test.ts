import { describe, expect, test } from "bun:test";

const ENTRY = new URL("../src/main.ts", import.meta.url).pathname;

async function runCli(args: string[], stdin?: string) {
  const proc = Bun.spawn(["bun", ENTRY, ...args], {
    stdin: stdin === undefined ? "ignore" : new Response(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout, stderr, code: await proc.exited };
}

describe("--arrays", () => {
  test("default emits []const T", async () => {
    const r = await runCli(["--stdin", "--root", "X"], '{"items": [1, 2, 3]}');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("items: []const ");
  });

  test("arraylist emits std.ArrayList(T)", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--arrays", "arraylist"],
      '{"items": [1, 2, 3]}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("items: std.ArrayList(");
    // arraylist requires std.
    expect(r.stdout).toContain('@import("std")');
  });

  test("fixed emits [N]T when every observation has length N", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--arrays", "fixed", "--samples-from-array"],
      JSON.stringify([
        { coords: [1, 2, 3] },
        { coords: [4, 5, 6] },
      ]),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("coords: [3]");
  });

  test("fixed falls back to slice with infer.fixed_length_unstable when lengths vary", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--arrays", "fixed", "--samples-from-array"],
      JSON.stringify([
        { coords: [1, 2, 3] },
        { coords: [4, 5] },
      ]),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("coords: []const ");
    expect(r.stderr).toContain("infer.fixed_length_unstable");
  });

  test("invalid --arrays value rejected", async () => {
    const r = await runCli(["--stdin", "--root", "X", "--arrays", "weird"], '{"x": []}');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--arrays must be slice|arraylist|fixed");
  });
});

describe("--rename-all", () => {
  test("default behavior preserves auto-detection", async () => {
    const r = await runCli(
      ["--stdin", "--root", "U", "--target", "serde-zig"],
      '{"userId": 1, "firstName": "A"}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("rename_all = serde.NamingConvention.camel_case");
  });

  test("forces snake_case even with no renames", async () => {
    const r = await runCli(
      ["--stdin", "--root", "C", "--target", "serde-zig", "--rename-all", "snake_case"],
      '{"port": 80, "host": "x"}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("rename_all = serde.NamingConvention.snake_case");
  });

  test("forces camel_case + emits explicit .rename for non-conforming wire", async () => {
    // user_name doesn't fit camel_case round-trip from the snake-cased Zig
    // name; should get explicit `.rename`.
    const r = await runCli(
      ["--stdin", "--root", "U", "--target", "serde-zig", "--rename-all", "camel_case"],
      '{"user_name": "A", "userId": 1}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("rename_all = serde.NamingConvention.camel_case");
    expect(r.stdout).toContain('.user_name = "user_name"');
  });

  test("none disables auto-detect — explicit per-field rename only", async () => {
    const r = await runCli(
      ["--stdin", "--root", "U", "--target", "serde-zig", "--rename-all", "none"],
      '{"userId": 1, "firstName": "A"}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain("rename_all");
    expect(r.stdout).toContain('.user_id = "userId"');
    expect(r.stdout).toContain('.first_name = "firstName"');
  });

  test("screaming_snake forced", async () => {
    const r = await runCli(
      ["--stdin", "--root", "C", "--target", "serde-zig", "--rename-all", "screaming_snake"],
      '{"MAX_RETRIES": 5, "TIMEOUT": 30}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("rename_all = serde.NamingConvention.screaming_snake");
  });

  test("invalid value rejected", async () => {
    const r = await runCli(
      ["--stdin", "--root", "U", "--target", "serde-zig", "--rename-all", "bogus"],
      '{"id": 1}',
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--rename-all must be");
  });
});
