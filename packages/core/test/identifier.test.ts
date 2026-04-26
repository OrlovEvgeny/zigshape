import { describe, expect, test } from "bun:test";
import {
  sanitizeFieldName,
  sanitizeStructName,
  singularize,
  toPascalCase,
  toSnakeCase,
} from "../src/zig/identifier";

describe("toSnakeCase", () => {
  const cases: Array<[string, string]> = [
    ["userId", "user_id"],
    ["FirstName", "first_name"],
    ["first-name", "first_name"],
    ["first name", "first_name"],
    ["URLPath", "url_path"],
    ["HTTPSConnection", "https_connection"],
    ["already_snake", "already_snake"],
    ["__weird__", "weird"],
    ["A", "a"],
    ["", ""],
  ];
  for (const [input, expected] of cases) {
    test(`'${input}' -> '${expected}'`, () => {
      expect(toSnakeCase(input)).toBe(expected);
    });
  }
});

describe("toPascalCase", () => {
  const cases: Array<[string, string]> = [
    ["userId", "UserId"],
    ["first-name", "FirstName"],
    ["URLPath", "UrlPath"],
    ["users", "Users"],
    ["", ""],
  ];
  for (const [input, expected] of cases) {
    test(`'${input}' -> '${expected}'`, () => {
      expect(toPascalCase(input)).toBe(expected);
    });
  }
});

describe("sanitizeFieldName", () => {
  test("plain camel becomes snake", () => {
    expect(sanitizeFieldName("userId")).toEqual({
      text: "user_id",
      escaped: false,
      changed: true,
    });
  });
  test("already snake stays as-is", () => {
    expect(sanitizeFieldName("user_id")).toEqual({
      text: "user_id",
      escaped: false,
      changed: false,
    });
  });
  test("reserved keyword gets trailing underscore", () => {
    expect(sanitizeFieldName("type")).toEqual({
      text: "type_",
      escaped: false,
      changed: true,
    });
    expect(sanitizeFieldName("pub")).toMatchObject({ text: "pub_", changed: true });
  });
  test("starts with digit -> escaped @\"…\"", () => {
    expect(sanitizeFieldName("2fa_enabled")).toEqual({
      text: '@"2fa_enabled"',
      escaped: true,
      changed: true,
    });
  });
  test("space in key -> escaped", () => {
    expect(sanitizeFieldName("first name")).toEqual({
      text: "first_name",
      escaped: false,
      changed: true,
    });
  });
  test("kebab key -> snake", () => {
    expect(sanitizeFieldName("first-name")).toMatchObject({ text: "first_name", changed: true });
  });
  test("dot in key forces escaping (not just snakeable)", () => {
    expect(sanitizeFieldName("a.b.c")).toMatchObject({
      text: "a_b_c",
      escaped: false,
      changed: true,
    });
  });
  test("only-special-chars key falls back to @\"…\"", () => {
    expect(sanitizeFieldName("!!!")).toMatchObject({ text: '@"!!!"', escaped: true });
  });
});

describe("sanitizeStructName", () => {
  test("plural stays plural here (singularize is separate)", () => {
    expect(sanitizeStructName("users")).toBe("Users");
  });
  test("kebab", () => {
    expect(sanitizeStructName("user-profile")).toBe("UserProfile");
  });
  test("keyword collision suffixes _", () => {
    expect(sanitizeStructName("struct")).toBe("Struct"); // PascalCase escapes via the case change
  });
});

describe("singularize", () => {
  const cases: Array<[string, string]> = [
    ["users", "user"],
    ["entries", "entry"],
    ["address", "address"],
    ["bus", "bus"],
    ["status", "status"],
    ["a", "a"],
  ];
  for (const [input, expected] of cases) {
    test(`'${input}' -> '${expected}'`, () => {
      expect(singularize(input)).toBe(expected);
    });
  }
});
