import { describe, expect, test } from "bun:test";
import { parseToml } from "../../src/parsers/toml";
import type { ZArray, ZObject } from "../../src/value";

describe("parseToml", () => {
  test("flat scalars", () => {
    const v = parseToml(
      `title = "myapp"\nport = 3000\ndebug = true\nratio = 1.5`,
      0,
    ).value as ZObject;
    expect(v.kind).toBe("object");
    expect(v.fields.get("title")!.value).toMatchObject({ kind: "string", value: "myapp" });
    expect(v.fields.get("port")!.value).toMatchObject({ kind: "int", value: 3000n });
    expect(v.fields.get("debug")!.value).toMatchObject({ kind: "bool", value: true });
    expect(v.fields.get("ratio")!.value).toMatchObject({ kind: "float", value: 1.5 });
  });

  test("nested table -> nested object", () => {
    const v = parseToml(
      `title = "myapp"\n[database]\nhost = "localhost"\nport = 5432`,
      0,
    ).value as ZObject;
    const db = v.fields.get("database")!.value as ZObject;
    expect(db.kind).toBe("object");
    expect(db.fields.get("host")!.value).toMatchObject({ kind: "string", value: "localhost" });
    expect(db.fields.get("port")!.value).toMatchObject({ kind: "int", value: 5432n });
  });

  test("array of tables -> array of objects", () => {
    const v = parseToml(
      `[[users]]\nname = "alice"\n[[users]]\nname = "bob"`,
      0,
    ).value as ZObject;
    const users = v.fields.get("users")!.value as ZArray;
    expect(users.kind).toBe("array");
    expect(users.items).toHaveLength(2);
    expect((users.items[0] as ZObject).fields.get("name")!.value).toMatchObject({
      kind: "string",
      value: "alice",
    });
  });

  test("inline table", () => {
    const v = parseToml(
      `point = { x = 1, y = 2 }`,
      0,
    ).value as ZObject;
    const p = v.fields.get("point")!.value as ZObject;
    expect([...p.fields.keys()]).toEqual(["x", "y"]);
  });

  test("array of mixed scalars stays array", () => {
    const v = parseToml(
      `tags = ["a", "b", "c"]`,
      0,
    ).value as ZObject;
    const tags = v.fields.get("tags")!.value as ZArray;
    expect(tags.items).toHaveLength(3);
    expect(tags.items[0]).toMatchObject({ kind: "string", value: "a" });
  });

  test("date scalar -> string with warning", () => {
    const r = parseToml(`when = 2024-01-15T10:00:00Z`, 0);
    const v = r.value as ZObject;
    const when = v.fields.get("when")!.value;
    expect(when.kind).toBe("string");
    expect(r.diagnostics.toArray().some((d) => d.code === "parse.toml_date")).toBe(true);
  });

  test("syntax error reports diagnostic", () => {
    const r = parseToml("not = valid syntax = here", 0);
    expect(r.diagnostics.hasErrors()).toBe(true);
  });

  test("empty document -> empty object", () => {
    const v = parseToml("", 0).value as ZObject;
    expect(v.kind).toBe("object");
    expect(v.fields.size).toBe(0);
  });

  test("sample index propagates to whole-document src", () => {
    const v = parseToml(`x = 1`, 4).value!;
    expect(v.src.sample).toBe(4);
  });

  test("negative integer", () => {
    const v = parseToml(`n = -42`, 0).value as ZObject;
    expect(v.fields.get("n")!.value).toMatchObject({ kind: "int", value: -42n });
  });

  test("nested table dotted path", () => {
    const v = parseToml(
      `[server.http]\nport = 80\n[server.https]\nport = 443`,
      0,
    ).value as ZObject;
    const server = v.fields.get("server")!.value as ZObject;
    const http = server.fields.get("http")!.value as ZObject;
    const https = server.fields.get("https")!.value as ZObject;
    expect(http.fields.get("port")!.value).toMatchObject({ kind: "int", value: 80n });
    expect(https.fields.get("port")!.value).toMatchObject({ kind: "int", value: 443n });
  });
});
