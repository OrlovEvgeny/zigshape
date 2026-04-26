import { describe, expect, test } from "bun:test";
import { parseSample } from "../src/parse";
import type { ZArray, ZObject } from "../src/value";

describe("parseSample", () => {
  test("primitives", () => {
    expect(parseSample("null", 0).value).toMatchObject({ kind: "null" });
    expect(parseSample("true", 0).value).toMatchObject({ kind: "bool", value: true });
    expect(parseSample('"hi"', 0).value).toMatchObject({ kind: "string", value: "hi" });
    expect(parseSample("42", 0).value).toMatchObject({ kind: "int", value: 42n });
    expect(parseSample("-7", 0).value).toMatchObject({ kind: "int", value: -7n });
    expect(parseSample("3.14", 0).value).toMatchObject({ kind: "float", value: 3.14 });
    expect(parseSample("1e3", 0).value).toMatchObject({ kind: "float", value: 1000 });
  });

  test("preserves big integers as bigint", () => {
    const res = parseSample("123456789012345678901234567890", 0);
    expect(res.value).toMatchObject({
      kind: "int",
      value: 123456789012345678901234567890n,
    });
  });

  test("array", () => {
    const res = parseSample("[1, 2, 3]", 0);
    const v = res.value as ZArray;
    expect(v.kind).toBe("array");
    expect(v.items).toHaveLength(3);
    expect(v.items[0]).toMatchObject({ kind: "int", value: 1n });
  });

  test("object preserves key order and src offsets", () => {
    const input = '{"a": 1, "b": "x"}';
    const v = parseSample(input, 0).value as ZObject;
    expect(v.kind).toBe("object");
    expect([...v.fields.keys()]).toEqual(["a", "b"]);
    const a = v.fields.get("a")!;
    expect(a.value).toMatchObject({ kind: "int", value: 1n });
    expect(input.slice(a.keySrc.offset, a.keySrc.offset + a.keySrc.length)).toBe('"a"');
  });

  test("nested object", () => {
    const v = parseSample('{"u": {"id": 1, "name": "Alice"}}', 0).value as ZObject;
    const u = v.fields.get("u")!.value as ZObject;
    expect([...u.fields.keys()]).toEqual(["id", "name"]);
  });

  test("tolerates trailing commas (JSONC)", () => {
    const res = parseSample("[1, 2, 3,]", 0);
    expect(res.diagnostics.hasErrors()).toBe(false);
    const v = res.value as ZArray;
    expect(v.items).toHaveLength(3);
  });

  test("tolerates // and /* */ comments (JSONC)", () => {
    const res = parseSample(
      `{
        // user info
        "id": 1, /* important */ "name": "A"
      }`,
      0,
    );
    expect(res.diagnostics.hasErrors()).toBe(false);
    const v = res.value as ZObject;
    expect([...v.fields.keys()]).toEqual(["id", "name"]);
  });

  test("syntax error reports diagnostic with src offset", () => {
    const res = parseSample('{"a": }', 0);
    expect(res.diagnostics.hasErrors()).toBe(true);
    const errs = res.diagnostics.toArray().filter((d) => d.severity === "error");
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]!.src).toBeDefined();
    expect(errs[0]!.src!.sample).toBe(0);
  });

  test("duplicate key keeps first and warns", () => {
    const res = parseSample('{"a": 1, "a": 2}', 0);
    const v = res.value as ZObject;
    expect(v.fields.get("a")?.value).toMatchObject({ kind: "int", value: 1n });
    const warns = res.diagnostics.toArray().filter((d) => d.code === "parse.duplicate_key");
    expect(warns).toHaveLength(1);
  });

  test("sample index propagates to src refs", () => {
    const v = parseSample('"x"', 7).value!;
    expect(v.src.sample).toBe(7);
    expect(v.src.offset).toBe(0);
    expect(v.src.length).toBe(3);
  });
});
