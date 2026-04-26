import { describe, expect, test } from "bun:test";
import { parseYaml } from "../../src/parsers/yaml";
import type { ZArray, ZObject } from "../../src/value";

describe("parseYaml", () => {
  test("scalars", () => {
    expect(parseYaml("hello", 0).value).toMatchObject({ kind: "string", value: "hello" });
    expect(parseYaml("42", 0).value).toMatchObject({ kind: "int", value: 42n });
    expect(parseYaml("3.14", 0).value).toMatchObject({ kind: "float", value: 3.14 });
    expect(parseYaml("true", 0).value).toMatchObject({ kind: "bool", value: true });
    expect(parseYaml("null", 0).value).toMatchObject({ kind: "null" });
  });

  test("hex and octal as ints", () => {
    expect(parseYaml("0xff", 0).value).toMatchObject({ kind: "int", value: 0xffn });
    expect(parseYaml("0o17", 0).value).toMatchObject({ kind: "int", value: 0o17n });
  });

  test("scientific notation as float", () => {
    expect(parseYaml("1e3", 0).value).toMatchObject({ kind: "float", value: 1000 });
  });

  test("flow-style mapping", () => {
    const v = parseYaml('{ a: 1, b: "two" }', 0).value as ZObject;
    expect([...v.fields.keys()]).toEqual(["a", "b"]);
    expect(v.fields.get("a")!.value).toMatchObject({ kind: "int", value: 1n });
  });

  test("block mapping with src offsets", () => {
    const input = "id: 1\nname: Alice";
    const v = parseYaml(input, 0).value as ZObject;
    expect([...v.fields.keys()]).toEqual(["id", "name"]);
    const idField = v.fields.get("id")!;
    expect(input.slice(idField.keySrc.offset, idField.keySrc.offset + idField.keySrc.length)).toBe(
      "id",
    );
    expect(idField.value).toMatchObject({ kind: "int", value: 1n });
  });

  test("block sequence", () => {
    const v = parseYaml("- a\n- b\n- c", 0).value as ZArray;
    expect(v.kind).toBe("array");
    expect(v.items).toHaveLength(3);
    expect(v.items[0]).toMatchObject({ kind: "string", value: "a" });
  });

  test("nested map and seq", () => {
    const input = "user:\n  name: Alice\n  tags:\n    - admin\n    - user";
    const v = parseYaml(input, 0).value as ZObject;
    const user = v.fields.get("user")!.value as ZObject;
    expect(user.fields.get("name")!.value).toMatchObject({ kind: "string", value: "Alice" });
    const tags = user.fields.get("tags")!.value as ZArray;
    expect(tags.items).toHaveLength(2);
  });

  test("comments are tolerated", () => {
    const v = parseYaml("# header\nid: 1 # inline\nname: Alice", 0).value as ZObject;
    expect([...v.fields.keys()]).toEqual(["id", "name"]);
  });

  test("anchors and aliases resolve to the value", () => {
    const input = "a: &x\n  port: 8080\nb: *x";
    const r = parseYaml(input, 0);
    const root = r.value as ZObject;
    const a = root.fields.get("a")!.value as ZObject;
    const b = root.fields.get("b")!.value as ZObject;
    expect(a.fields.get("port")!.value).toMatchObject({ kind: "int", value: 8080n });
    expect(b.fields.get("port")!.value).toMatchObject({ kind: "int", value: 8080n });
  });

  test("merge keys via <<", () => {
    const input = "defaults: &d\n  port: 8080\n  debug: true\nserver:\n  <<: *d\n  port: 9090";
    const root = parseYaml(input, 0).value as ZObject;
    const server = root.fields.get("server")!.value as ZObject;
    // Override wins
    expect(server.fields.get("port")!.value).toMatchObject({ kind: "int", value: 9090n });
    // Merged from defaults
    expect(server.fields.get("debug")!.value).toMatchObject({ kind: "bool", value: true });
  });

  test("multi-document warns and uses first", () => {
    const r = parseYaml("foo: 1\n---\nfoo: 2", 0);
    const root = r.value as ZObject;
    expect(root.fields.get("foo")!.value).toMatchObject({ kind: "int", value: 1n });
    expect(r.diagnostics.toArray().some((d) => d.code === "parse.yaml_multi_document")).toBe(true);
  });

  test("syntax error reports diagnostic", () => {
    const r = parseYaml("a: : :", 0);
    expect(r.diagnostics.hasErrors()).toBe(true);
  });

  test("YAML 1.2 dates parse as plain strings (no warning)", () => {
    // YAML 1.2 (default) doesn't auto-coerce 2024-01-15 to a Date. The Date
    // branch in scalarToZ is reachable only with schema: 'yaml-1.1', which
    // we don't enable by default.
    const r = parseYaml("when: 2024-01-15", 0);
    const root = r.value as ZObject;
    const v = root.fields.get("when")!.value;
    expect(v).toMatchObject({ kind: "string", value: "2024-01-15" });
  });

  test("empty mapping value -> null", () => {
    const root = parseYaml("a:\nb: 1", 0).value as ZObject;
    expect(root.fields.get("a")!.value).toMatchObject({ kind: "null" });
    expect(root.fields.get("b")!.value).toMatchObject({ kind: "int", value: 1n });
  });

  test("sample index propagates to src refs", () => {
    const v = parseYaml("hi", 7).value!;
    expect(v.src.sample).toBe(7);
  });
});
