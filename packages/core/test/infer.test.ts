import { describe, expect, test } from "bun:test";
import { parseSample } from "../src/parse";
import { observeSamples } from "../src/observe";
import { infer } from "../src/infer";
import type { Shape } from "../src/shape";
import type { ZValue } from "../src/value";

function inferOf(...samples: string[]) {
  const values: ZValue[] = samples.map((s, i) => {
    const r = parseSample(s, i);
    if (!r.value) throw new Error("parse failed: " + s);
    return r.value;
  });
  return infer(observeSamples(values));
}

describe("infer scalars", () => {
  test("string", () => {
    expect(inferOf('"hi"').root).toEqual({ kind: "string" });
  });
  test("bool", () => {
    expect(inferOf("true").root).toEqual({ kind: "bool" });
  });
  test("unsigned int", () => {
    expect(inferOf("1", "2").root).toEqual({ kind: "int", signed: false });
  });
  test("signed int when any negative", () => {
    expect(inferOf("1", "-2").root).toEqual({ kind: "int", signed: true });
  });
  test("float", () => {
    expect(inferOf("3.14").root).toEqual({ kind: "float" });
  });
  test("int + float promoted to float with warning", () => {
    const r = inferOf("1", "1.5");
    expect(r.root).toEqual({ kind: "float" });
    expect(r.diagnostics.toArray().some((d) => d.code === "infer.int_float_mix")).toBe(true);
  });
});

describe("infer arrays", () => {
  test("array of strings", () => {
    expect(inferOf('["a", "b"]').root).toMatchObject({
      kind: "array",
      element: { kind: "string" },
    });
  });
  test("nested arrays", () => {
    expect(inferOf("[[1, 2], [3]]").root).toMatchObject({
      kind: "array",
      element: { kind: "array", element: { kind: "int", signed: false } },
    });
  });
});

describe("infer objects", () => {
  test("required field", () => {
    const r = inferOf('{"id": 1}');
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect(o.kind).toBe("object");
    const f = o.fields.get("id")!;
    expect(f.optional).toBe(false);
    expect(f.shape).toEqual({ kind: "int", signed: false });
  });

  test("optional via missing across samples", () => {
    const r = inferOf('{"id": 1, "email": "x@y"}', '{"id": 2}');
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect(o.fields.get("email")!.optional).toBe(true);
    expect(o.fields.get("email")!.optionalReason).toBe("missing");
    expect(o.fields.get("id")!.optional).toBe(false);
  });

  test("optional via null", () => {
    const r = inferOf('{"x": "hi"}', '{"x": null}');
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect(o.fields.get("x")!.optional).toBe(true);
    expect(o.fields.get("x")!.optionalReason).toBe("null");
    expect(o.fields.get("x")!.shape).toEqual({ kind: "string" });
  });

  test("optional via both missing and null", () => {
    const r = inferOf('{"x": "hi"}', '{"x": null}', "{}");
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect(o.fields.get("x")!.optionalReason).toBe("missing-and-null");
  });
});

describe("map detection", () => {
  test("non-identifier keys (kebab-case) trigger map", () => {
    const r = inferOf(
      '{"a-1": {"v": 1}, "a-2": {"v": 2}, "a-3": {"v": 3}, "a-4": {"v": 4}}',
    );
    expect(r.root).toMatchObject({ kind: "map", value: { kind: "object" } });
    expect(r.diagnostics.toArray().some((d) => d.code === "infer.map_candidate")).toBe(true);
  });

  test("numeric keys trigger map", () => {
    const r = inferOf(
      '{"1": "a", "2": "b", "3": "c", "4": "d"}',
    );
    expect(r.root).toMatchObject({ kind: "map", value: { kind: "string" } });
  });

  test("identifier keys with same shape do NOT trigger map", () => {
    const r = inferOf(
      '{"alice": {"v": 1}, "bob": {"v": 2}, "carol": {"v": 3}, "dave": {"v": 4}}',
    );
    expect(r.root.kind).toBe("object");
  });

  test("fewer than 4 keys does not trigger map", () => {
    const r = inferOf(
      '{"a-1": {"v": 1}, "a-2": {"v": 2}, "a-3": {"v": 3}}',
    );
    expect(r.root.kind).toBe("object");
  });

  test("heterogeneous child shapes do not trigger map", () => {
    const r = inferOf(
      '{"a-1": {"v": 1}, "a-2": {"v": "x"}, "a-3": {"v": 3}, "a-4": {"v": 4}}',
    );
    expect(r.root.kind).toBe("object");
  });
});

describe("only-null and unknown", () => {
  test("field observed only as null", () => {
    const r = inferOf('{"x": null}');
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect(o.fields.get("x")!.shape).toMatchObject({ kind: "unknown", reason: "only-null" });
  });

  test("heterogeneous scalars fall back to unknown mixed-scalars", () => {
    const r = inferOf('{"x": "a"}', '{"x": 1}');
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect(o.fields.get("x")!.shape).toMatchObject({ kind: "unknown", reason: "mixed-scalars" });
  });
});
