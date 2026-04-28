import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./_helpers";

describe("--int usize", () => {
  test("non-negative observations -> usize", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--int", "usize"],
      '{"i": 1, "j": 2}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("i: usize");
    expect(r.stdout).toContain("j: usize");
  });

  test("any negative observation -> isize", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--int", "usize"],
      '{"signed": -1, "u": 2}',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("signed: isize");
    // Sibling field stays usize since its observations are non-negative.
    expect(r.stdout).toContain("u: usize");
  });

  test("invalid value rejected with helpful message", async () => {
    const r = await runCli(["--stdin", "--root", "X", "--int", "i32"], '{"i": 1}');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--int must be smallest|u64|i64|usize");
  });
});

describe("--unknown", () => {
  test("default emits std.json.Value", async () => {
    const r = await runCli(["--stdin", "--root", "X"], '[null, null]');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("std.json.Value");
  });

  test("serde-value emits serde.Value + serde import", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--unknown", "serde-value"],
      '[null, null]',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("serde.Value");
    expect(r.stdout).toContain('@import("serde")');
    expect(r.stdout).not.toContain("std.json.Value");
  });

  test("string emits []const u8", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--unknown", "string"],
      '[null, null]',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("[]const u8");
    expect(r.stdout).not.toContain("std.json.Value");
  });

  test("compile-error emits @compileError(...)", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--unknown", "compile-error"],
      '[null, null]',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("@compileError");
    expect(r.stdout).toContain("only-null");
    expect(r.stdout).not.toContain("std.json.Value");
  });

  test("invalid value rejected", async () => {
    const r = await runCli(
      ["--stdin", "--root", "X", "--unknown", "panic"],
      '[null]',
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--unknown must be");
  });
});

describe("XML CDATA warning", () => {
  test("CDATA detected emits parse.xml_cdata", async () => {
    const r = await runCli(
      ["--stdin", "--format", "xml", "--root", "Doc"],
      "<root><body><![CDATA[<b>hi</b>]]></body></root>",
    );
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("parse.xml_cdata");
  });

  test("plain XML without CDATA does not warn", async () => {
    const r = await runCli(
      ["--stdin", "--format", "xml", "--root", "Doc"],
      "<root><body>hello</body></root>",
    );
    expect(r.code).toBe(0);
    expect(r.stderr).not.toContain("parse.xml_cdata");
  });
});

describe("CLI directory mode", () => {
  function mkdir(): string {
    return mkdtempSync(join(tmpdir(), "zigshape-dir-"));
  }

  test("walks recursively and merges files as samples", async () => {
    const dir = mkdir();
    writeFileSync(join(dir, "a.json"), '{"id":1,"name":"Alice"}');
    writeFileSync(join(dir, "b.json"), '{"id":2,"name":"Bob","email":"b@x.com"}');
    const r = await runCli([dir, "--root", "User"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pub const User = struct");
    // email present in 1/2 samples → optional
    expect(r.stdout).toContain("email: ?[]const u8 = null");
  });

  test("recurses into subdirectories", async () => {
    const dir = mkdir();
    mkdirSync(join(dir, "nested"));
    writeFileSync(join(dir, "a.json"), '{"id":1}');
    writeFileSync(join(dir, "nested", "b.json"), '{"id":2,"name":"Bob"}');
    const r = await runCli([dir, "--root", "User"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("name: ?[]const u8");
  });

  test("filters by --format", async () => {
    const dir = mkdir();
    writeFileSync(join(dir, "a.json"), '{"id":1}');
    writeFileSync(join(dir, "b.yaml"), "id: 2");
    const r = await runCli([dir, "--root", "X", "--format", "json"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("id: u8");
    // YAML file ignored under --format json — only one sample observed,
    // both fields non-optional.
    expect(r.stdout).not.toContain("?u8");
  });

  test("auto picks all known extensions", async () => {
    const dir = mkdir();
    writeFileSync(join(dir, "a.json"), '{"id":1,"src":"json"}');
    writeFileSync(join(dir, "b.yaml"), 'id: 2\nsrc: yaml');
    const r = await runCli([dir, "--root", "X"]);
    // Mixed-format auto-detect exits 2 with an explicit message — that's
    // expected behaviour, not a bug, but it confirms both files were read.
    expect(r.stderr).toContain("samples appear to be in different formats");
  });

  test("empty directory errors with a helpful message", async () => {
    const dir = mkdir();
    const r = await runCli([dir, "--root", "X"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("no files matching");
  });
});
