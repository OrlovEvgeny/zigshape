import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

function tmp() {
  return mkdtempSync(join(tmpdir(), "zigshape-"));
}

describe("cli --report", () => {
  test("writes a JSON schema report", async () => {
    const dir = tmp();
    const out = join(dir, "schema.json");
    const r = await runCli(["--stdin", "--root", "User", "--report", out], '{"id": 1, "name": "x"}');
    expect(r.code).toBe(0);
    const report = JSON.parse(readFileSync(out, "utf8"));
    expect(report.version).toBe(1);
    expect(report.root).toBe("User");
    expect(Object.keys(report.fields).sort()).toEqual(["$.id", "$.name"]);
  });

  test("--report still emits Zig to stdout", async () => {
    const dir = tmp();
    const out = join(dir, "schema.json");
    const r = await runCli(["--stdin", "--root", "X", "--report", out], '{"id": 1}');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub const X = struct {");
  });
});

describe("cli --check-drift", () => {
  test("identical baseline → exit 0, no drift output", async () => {
    const dir = tmp();
    const baseline = join(dir, "baseline.json");
    const sample = join(dir, "in.json");
    writeFileSync(sample, '{"id": 1}');
    let r = await runCli([sample, "--root", "U", "--report", baseline]);
    expect(r.code).toBe(0);
    r = await runCli([sample, "--root", "U", "--check-drift", baseline]);
    expect(r.code).toBe(0);
    expect(r.stderr).not.toContain("BREAKING");
  });

  test("breaking type change → exit 3", async () => {
    const dir = tmp();
    const baseline = join(dir, "baseline.json");
    const v1 = join(dir, "v1.json");
    const v2 = join(dir, "v2.json");
    writeFileSync(v1, '{"id": 1}');
    writeFileSync(v2, '{"id": "one"}');
    await runCli([v1, "--root", "U", "--report", baseline]);
    const r = await runCli([v2, "--root", "U", "--check-drift", baseline]);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("BREAKING");
  });

  test("compatible field add → exit 0", async () => {
    const dir = tmp();
    const baseline = join(dir, "baseline.json");
    const v1 = join(dir, "v1.json");
    const v2 = join(dir, "v2.json");
    writeFileSync(v1, '{"id": 1}');
    writeFileSync(v2, '{"id": 1, "name": "x"}');
    await runCli([v1, "--root", "U", "--report", baseline]);
    const r = await runCli([v2, "--root", "U", "--check-drift", baseline]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("compatible");
  });

  test("missing baseline → exit 2 with explanatory message", async () => {
    const dir = tmp();
    const sample = join(dir, "in.json");
    writeFileSync(sample, '{"id": 1}');
    const r = await runCli([sample, "--check-drift", join(dir, "nope.json")]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("cannot read drift baseline");
  });
});

describe("cli --config", () => {
  test("config provides default options", async () => {
    const dir = tmp();
    const cfg = join(dir, "zigshape.json");
    const sample = join(dir, "in.json");
    writeFileSync(sample, '{"id": 1, "userId": 2}');
    writeFileSync(cfg, JSON.stringify({ options: { intStrategy: "u64" } }));
    const r = await runCli([sample, "--root", "X", "--target", "plain", "--config", cfg]);
    expect(r.code).toBe(0);
    // u64 strategy widens both fields
    expect(r.stdout).toContain("u64");
    expect(r.stdout).not.toContain("u8");
  });

  test("explicit CLI flag overrides config", async () => {
    const dir = tmp();
    const cfg = join(dir, "zigshape.json");
    const sample = join(dir, "in.json");
    writeFileSync(sample, '{"n": 1}');
    writeFileSync(cfg, JSON.stringify({ options: { intStrategy: "u64" } }));
    const r = await runCli([sample, "--root", "X", "--int", "smallest", "--config", cfg]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("u8");
  });

  test("serde.denyUnknownFields from config", async () => {
    const dir = tmp();
    const cfg = join(dir, "zigshape.json");
    const sample = join(dir, "in.json");
    writeFileSync(sample, '{"id": 1}');
    writeFileSync(cfg, JSON.stringify({ serde: { denyUnknownFields: true } }));
    const r = await runCli([
      sample,
      "--root",
      "X",
      "--target",
      "serde-zig",
      "--config",
      cfg,
    ]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(".deny_unknown_fields = true");
  });

  test("malformed config exits 2", async () => {
    const dir = tmp();
    const cfg = join(dir, "zigshape.json");
    const sample = join(dir, "in.json");
    writeFileSync(sample, '{"id": 1}');
    writeFileSync(cfg, "not json");
    const r = await runCli([sample, "--config", cfg]);
    expect(r.code).toBe(2);
  });
});

describe("cli --aliases / --deny-unknown-fields", () => {
  test("--aliases off disables merging", async () => {
    const dir = tmp();
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, '{"url": "x"}');
    writeFileSync(b, '{"uri": "y"}');
    const r = await runCli([a, b, "--root", "X", "--aliases", "off"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("url:");
    expect(r.stdout).toContain("uri:");
  });

  test("--deny-unknown-fields emits the serde flag", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--target", "serde-zig", "--deny-unknown-fields"],
      '{"id": 1}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(".deny_unknown_fields = true");
  });
});
