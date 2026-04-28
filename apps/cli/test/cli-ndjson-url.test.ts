import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./_helpers";

describe("cli --format ndjson", () => {
  test("each line becomes a sample", async () => {
    const r = await runCli(
      ["--stdin", "--format", "ndjson", "--root", "User"],
      '{"id": 1, "name": "Alice"}\n{"id": 2}\n',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("name: ?[]const u8 = null");
  });

  test("auto-detect picks ndjson for two-line {…}{…}", async () => {
    const r = await runCli(
      ["--stdin", "--root", "User"],
      '{"id": 1, "name": "Alice"}\n{"id": 2}\n',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("name: ?[]const u8 = null");
  });
});

describe("cli --samples-from-array", () => {
  test("array-rooted JSON expands to samples", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zigshape-"));
    const file = join(dir, "samples.json");
    writeFileSync(file, '[{"id": 1, "x": "a"}, {"id": 2}]');
    const r = await runCli([file, "--root", "User", "--samples-from-array"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("x: ?[]const u8 = null");
  });

  test("flag off keeps array-shaped root", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zigshape-"));
    const file = join(dir, "samples.json");
    writeFileSync(file, '[{"id": 1}, {"id": 2}]');
    const r = await runCli([file, "--root", "Users"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("[]const User");
  });
});

describe("cli serde flatten / skip via config", () => {
  test("flatten + skip emit serde block entries", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zigshape-"));
    const cfg = join(dir, "zigshape.json");
    const sample = join(dir, "in.json");
    writeFileSync(sample, '{"id": 1, "email": "x", "profile": {"city": "NYC"}}');
    writeFileSync(
      cfg,
      JSON.stringify({
        serde: { flattenPaths: ["$.profile"], skipPaths: ["$.email"] },
      }),
    );
    const r = await runCli([
      sample,
      "--root",
      "User",
      "--target",
      "serde-zig",
      "--config",
      cfg,
    ]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(".flatten = .{ .profile },");
    expect(r.stdout).toContain(".skip = .{ .email },");
  });
});

// http URL fetch is intentionally not exercised in tests — would need a
// loopback server.  The code path is small and parallel to file reads.
