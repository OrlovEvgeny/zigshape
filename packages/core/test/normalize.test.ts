import { describe, expect, test } from "bun:test";
import { parseSample } from "../src/parse";
import { observeSamples } from "../src/observe";
import { infer } from "../src/infer";
import { normalize, type Decl, type StructDecl } from "../src/normalize";
import { renderZigType } from "../src/zig/types";

function norm(rootName: string, ...samples: string[]) {
  const values = samples.map((s, i) => {
    const r = parseSample(s, i);
    if (!r.value) throw new Error("parse fail");
    return r.value;
  });
  const { root } = infer(observeSamples(values));
  const result = normalize(root, { rootName });
  return {
    ...result,
    structAt(i: number): StructDecl {
      const d: Decl | undefined = result.decls[i];
      if (!d || d.kind !== "struct") throw new Error(`expected struct at index ${i}`);
      return d;
    },
  };
}

describe("normalize", () => {
  test("flat struct of scalars", () => {
    const r = norm("User", '{"id": 1, "name": "Alice", "active": true}');
    expect(r.decls).toHaveLength(1);
    expect(r.structAt(0).name).toBe("User");
    const fields = r.structAt(0).fields;
    expect(fields.map((f) => `${f.name}: ${renderZigType(f.type)}`)).toEqual([
      "id: u8",
      "name: []const u8",
      "active: bool",
    ]);
  });

  test("optional adds ?T and default null", () => {
    const r = norm("User", '{"id": 1, "email": "a"}', '{"id": 2}');
    const f = r.structAt(0).fields.find((f) => f.name === "email")!;
    expect(renderZigType(f.type)).toBe("?[]const u8");
    expect(f.defaultExpr).toBe("null");
  });

  test("camelCase keys snake the field name and mark renamed", () => {
    const r = norm("User", '{"userId": 1, "firstName": "A"}');
    const fields = r.structAt(0).fields;
    expect(fields.map((f) => f.name)).toEqual(["user_id", "first_name"]);
    expect(fields.every((f) => f.renamed)).toBe(true);
    expect(fields[0]!.originalKey).toBe("userId");
  });

  test("reserved keyword key gets _ suffix", () => {
    const r = norm("Thing", '{"type": "x", "pub": "y"}');
    expect(r.structAt(0).fields.map((f) => f.name)).toEqual(["type_", "pub_"]);
  });

  test("invalid identifier key uses @\"…\"", () => {
    const r = norm("Thing", '{"2fa_enabled": true}');
    const f = r.structAt(0).fields[0]!;
    expect(f.name).toBe('@"2fa_enabled"');
    expect(f.escaped).toBe(true);
  });

  test("collision after sanitization gets _2 suffix", () => {
    // userId -> user_id; user-id -> user_id; both collide.
    const r = norm("X", '{"userId": 1, "user-id": 2}');
    const names = r.structAt(0).fields.map((f) => f.name);
    expect(names).toEqual(["user_id", "user_id_2"]);
  });

  test("nested struct gets PascalCase name from field key", () => {
    const r = norm("Root", '{"profile": {"city": "NYC"}}');
    expect(r.decls.map((d) => d.name)).toEqual(["Root", "Profile"]);
    const profile = r.decls.find((d) => d.name === "Profile") as StructDecl;
    expect(profile.fields[0]!.name).toBe("city");
  });

  test("array of objects yields singularized struct name", () => {
    const r = norm("Root", '{"users": [{"id": 1}]}');
    const names = r.decls.map((d) => d.name);
    expect(names).toEqual(["Root", "User"]);
    const root = r.structAt(0);
    expect(renderZigType(root.fields[0]!.type)).toBe("[]const User");
  });

  test("struct name collision suffixes _2", () => {
    const r = norm("Root", '{"profile": {"a": 1}, "Profile": {"b": 2}}');
    const names = r.decls.map((d) => d.name).sort();
    expect(names).toEqual(["Profile", "Profile_2", "Root"]);
  });

  test("map shape -> stringMap and needsStd", () => {
    const r = norm(
      "Cfg",
      '{"a-1": {"v": 1}, "a-2": {"v": 2}, "a-3": {"v": 3}, "a-4": {"v": 4}}',
    );
    expect(r.needsStd).toBe(true);
    expect(renderZigType(r.rootType)).toBe("std.StringHashMap(CfgValue)");
    // The value object struct should be declared
    const valueStruct = r.decls.find((d) => d.name === "CfgValue");
    expect(valueStruct).toBeDefined();
  });

  test("only-null field falls back to std.json.Value", () => {
    const r = norm("X", '{"x": null}');
    const f = r.structAt(0).fields[0]!;
    expect(renderZigType(f.type)).toBe("?std.json.Value");
    expect(r.needsStd).toBe(true);
  });

  test("heterogeneous scalar field falls back to json", () => {
    const r = norm("X", '{"x": "a"}', '{"x": 1}');
    const f = r.structAt(0).fields[0]!;
    expect(renderZigType(f.type)).toBe("std.json.Value");
    expect(r.needsStd).toBe(true);
  });

  test("signed int when any negative", () => {
    const r = norm("X", '{"n": -1}');
    expect(renderZigType(r.structAt(0).fields[0]!.type)).toBe("i8");
  });

  test("array of scalars", () => {
    const r = norm("X", '{"tags": ["a", "b"]}');
    expect(renderZigType(r.structAt(0).fields[0]!.type)).toBe("[]const []const u8");
  });

  test("non-object root: scalar", () => {
    const r = norm("Count", "42");
    expect(r.decls).toHaveLength(0);
    expect(renderZigType(r.rootType)).toBe("u8");
  });

  test("non-object root: array of objects", () => {
    const r = norm("Users", '[{"id": 1}, {"id": 2}]');
    expect(renderZigType(r.rootType)).toBe("[]const User");
    expect(r.decls.map((d) => d.name)).toEqual(["User"]);
  });
});
