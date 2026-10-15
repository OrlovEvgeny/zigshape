import { describe, expect, test } from "bun:test";
import { parseZon } from "../../src/parsers/zon";
import { runPipeline } from "../../src/pipeline";
import type { ZArray, ZObject } from "../../src/value";

describe("parseZon", () => {
  test("struct, tuple, scalars and enum literals", () => {
    const r = parseZon('.{ .name = .app, .v = "1.0", .n = -3, .f = 1.5, .ok = true, .none = null, .list = .{ 1, 2 } }', 0);
    const f = (r.value as ZObject).fields;
    expect(f.get("name")!.value).toMatchObject({ kind: "string", value: "app", enumLiteral: true });
    expect(f.get("v")!.value).toMatchObject({ kind: "string", value: "1.0" });
    expect(f.get("n")!.value).toMatchObject({ kind: "int", value: -3n });
    expect(f.get("f")!.value).toMatchObject({ kind: "float", value: 1.5 });
    expect(f.get("ok")!.value).toMatchObject({ kind: "bool", value: true });
    expect(f.get("none")!.value).toMatchObject({ kind: "null" });
    expect((f.get("list")!.value as ZArray).items).toHaveLength(2);
  });

  test("number bases, underscores, chars, escapes and quoted identifiers", () => {
    const r = parseZon(".{ .h = 0xff, .o = 0o17, .b = 0b101, .u = 1_000, .c = 'a', .s = \"a\\n\\u{1F600}\", .@\"odd key\" = 1 }", 0);
    const f = (r.value as ZObject).fields;
    expect(f.get("h")!.value).toMatchObject({ value: 255n });
    expect(f.get("o")!.value).toMatchObject({ value: 15n });
    expect(f.get("b")!.value).toMatchObject({ value: 5n });
    expect(f.get("u")!.value).toMatchObject({ value: 1000n });
    expect(f.get("c")!.value).toMatchObject({ kind: "int", value: 97n });
    expect(f.get("s")!.value).toMatchObject({ value: "a\n😀" });
    expect(f.has("odd key")).toBe(true);
  });

  test("multiline strings join their lines", () => {
    const r = parseZon(".{ .t =\n    \\\\one\n    \\\\two\n}", 0);
    expect((r.value as ZObject).fields.get("t")!.value).toMatchObject({ value: "one\ntwo" });
  });

  test("constructs serde.zig rejects are flagged", () => {
    const r = parseZon(".{\n    // c\n    .f = 0x1,\n}", 0);
    const w = r.diagnostics.toArray().find((d) => d.code === "parse.zon_serde_compat");
    expect(w?.message).toContain("comments");
    expect(w?.message).toContain("hex/octal/binary integers");
  });

  test("syntax errors carry line and column", () => {
    const r = parseZon(".{ .a = }", 0);
    expect(r.value).toBeNull();
    expect(r.diagnostics.toArray()[0]!.message).toContain("line 1, col 9");
  });

  test("enum literals become an enum whose variants keep their spelling", () => {
    const { normalized } = runPipeline({ samples: [".{ .level = .fooBar }"], rootName: "Cfg", inferOptions: { format: "zon" } });
    const e = normalized!.decls.find((d) => d.kind === "enum");
    expect(e?.kind === "enum" && e.variants.map((v) => [v.zigName, v.renamed])).toEqual([["fooBar", false]]);
  });
});
