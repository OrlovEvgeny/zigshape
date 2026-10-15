import { describe, expect, test } from "bun:test";
import { parseToon } from "../../src/parsers/toon";
import type { ZArray, ZObject } from "../../src/value";

describe("parseToon", () => {
  test("tabular arrays, inline arrays and nested objects", () => {
    const r = parseToon("users[2]{id,name}:\n  1,Alice\n  2,Bob\ntags[2]: a,b\nmeta:\n  page: 1\n", 0);
    const f = (r.value as ZObject).fields;
    const users = (f.get("users")!.value as ZArray).items as ZObject[];
    expect(users[0]!.fields.get("id")!.value).toMatchObject({ kind: "int", value: 1n });
    expect(users[1]!.fields.get("name")!.value).toMatchObject({ kind: "string", value: "Bob" });
    expect((f.get("tags")!.value as ZArray).items).toHaveLength(2);
    expect((f.get("meta")!.value as ZObject).fields.get("page")!.value).toMatchObject({ value: 1n });
  });

  test("decoder errors become diagnostics", () => {
    const r = parseToon("items[3]: a,b\n", 0);
    expect(r.value).toBeNull();
    expect(r.diagnostics.toArray()[0]!.code).toBe("parse.toon_error");
  });
});
