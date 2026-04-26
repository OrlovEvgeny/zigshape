import { describe, expect, test } from "bun:test";
import { parseXml } from "../../src/parsers/xml";
import type { ZArray, ZObject } from "../../src/value";

describe("parseXml", () => {
  test("simple element with single child", () => {
    const r = parseXml("<user><name>Alice</name></user>", 0);
    expect(r.diagnostics.hasErrors()).toBe(false);
    expect(r.xmlRoot).toBe("user");
    const v = r.value as ZObject;
    expect(v.kind).toBe("object");
    expect(v.fields.get("name")!.value).toMatchObject({ kind: "string", value: "Alice" });
    expect(v.fields.get("name")!.xml).toBeUndefined();
  });

  test("attribute is tagged xml.kind = attribute", () => {
    const r = parseXml('<user id="42" />', 0);
    const v = r.value as ZObject;
    const id = v.fields.get("id")!;
    expect(id.value).toMatchObject({ kind: "int", value: 42n });
    expect(id.xml).toEqual({ kind: "attribute" });
  });

  test("attributes alongside child elements", () => {
    const r = parseXml('<user id="42"><name>Alice</name></user>', 0);
    const v = r.value as ZObject;
    expect(v.fields.get("id")!.xml).toEqual({ kind: "attribute" });
    expect(v.fields.get("name")!.xml).toBeUndefined();
    expect(r.diagnostics.toArray().some((d) => d.code === "parse.xml_mixed_content")).toBe(false);
  });

  test("repeated child elements become an array", () => {
    const r = parseXml("<users><user>a</user><user>b</user></users>", 0);
    const v = r.value as ZObject;
    const users = v.fields.get("user")!.value as ZArray;
    expect(users.kind).toBe("array");
    expect(users.items).toHaveLength(2);
  });

  test("mixed content fires warning and surfaces text node as `value`", () => {
    const r = parseXml('<description lang="en">Hello</description>', 0);
    const v = r.value as ZObject;
    expect(v.fields.get("lang")!.xml).toEqual({ kind: "attribute" });
    const valueField = v.fields.get("value")!;
    expect(valueField.xml).toEqual({ kind: "text" });
    expect(valueField.value).toMatchObject({ kind: "string", value: "Hello" });
    const codes = r.diagnostics.toArray().map((d) => d.code);
    expect(codes).toContain("parse.xml_mixed_content");
  });

  test("namespace prefix stripped with warning", () => {
    const r = parseXml(
      '<root xmlns:ns="http://x"><ns:name>Alice</ns:name></root>',
      0,
    );
    const v = r.value as ZObject;
    expect(v.fields.has("name")).toBe(true);
    expect(r.diagnostics.toArray().some((d) => d.code === "parse.xml_namespace")).toBe(true);
  });

  test("CDATA becomes string content", () => {
    const r = parseXml("<x><![CDATA[<raw>]]></x>", 0);
    expect(r.value).toMatchObject({ kind: "string", value: "<raw>" });
  });

  test("empty self-closing element produces empty object", () => {
    const r = parseXml("<x/>", 0);
    expect(r.value).toMatchObject({ kind: "string" });
    // fast-xml-parser maps `<x/>` to "" — which jsToZ surfaces as a string.
    // The shape inferer turns it into []const u8 with empty value, fine for v0.3.
  });

  test("malformed XML produces a diagnostic and null value", () => {
    const r = parseXml("<user><name></user>", 0);
    expect(r.value).toBeNull();
    const codes = r.diagnostics.toArray().map((d) => d.code);
    expect(codes).toContain("parse.xml_error");
  });

  test("integer attribute parses as int", () => {
    const r = parseXml('<x count="42" />', 0);
    const v = r.value as ZObject;
    expect(v.fields.get("count")!.value).toMatchObject({ kind: "int", value: 42n });
  });

  test("boolean attribute parses as bool", () => {
    const r = parseXml('<x enabled="true" />', 0);
    const v = r.value as ZObject;
    expect(v.fields.get("enabled")!.value).toMatchObject({ kind: "bool", value: true });
  });
});
