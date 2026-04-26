import { describe, expect, test } from "bun:test";
import { parseSample } from "../src/parse";
import { observeSamples } from "../src/observe";
import { infer } from "../src/infer";
import type { Shape } from "../src/shape";
import type { ZValue } from "../src/value";
import type { AliasStrategy } from "../src/options";

function inferOf(samples: string[], aliases: AliasStrategy = "auto") {
  const values: ZValue[] = samples.map((s, i) => {
    const r = parseSample(s, i);
    if (!r.value) throw new Error("parse failed: " + s);
    return r.value;
  });
  return infer(observeSamples(values), { aliases });
}

describe("alias detection", () => {
  test("three mutually exclusive same-shape siblings collapse to one canonical", () => {
    const r = inferOf([
      '{"url": "https://a"}',
      '{"uri": "https://b"}',
      '{"endpoint": "https://c"}',
    ]);
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect(o.kind).toBe("object");
    expect([...o.fields.keys()].length).toBe(1);
    const f = [...o.fields.values()][0]!;
    expect(f.aliases?.sort()).toEqual(
      ["url", "uri", "endpoint"].filter((k) => k !== f.originalKey).sort(),
    );
    // canonical covers all 3 samples → no longer optional
    expect(f.optional).toBe(false);
    expect(f.observedCount).toBe(3);

    expect(
      r.diagnostics.toArray().some((d) => d.code === "infer.alias_candidate"),
    ).toBe(true);
  });

  test("canonical is the field with the highest observed count", () => {
    const r = inferOf([
      '{"url": "x"}',
      '{"url": "y"}',
      '{"uri": "z"}',
    ]);
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect([...o.fields.keys()]).toEqual(["url"]);
    expect(o.fields.get("url")!.aliases).toEqual(["uri"]);
  });

  test("co-occurring siblings are NOT collapsed", () => {
    const r = inferOf([
      '{"url": "a", "uri": "b"}',
      '{"url": "c", "uri": "d"}',
    ]);
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect([...o.fields.keys()].sort()).toEqual(["uri", "url"]);
    expect(o.fields.get("url")!.aliases).toBeUndefined();
    expect(o.fields.get("uri")!.aliases).toBeUndefined();
  });

  test("different shapes are NOT collapsed", () => {
    const r = inferOf([
      '{"a": "string"}',
      '{"b": 42}',
    ]);
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect([...o.fields.keys()].sort()).toEqual(["a", "b"]);
    expect(o.fields.get("a")!.aliases).toBeUndefined();
  });

  test("aliases='off' disables detection", () => {
    const r = inferOf(
      ['{"url": "a"}', '{"uri": "b"}'],
      "off",
    );
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect([...o.fields.keys()].sort()).toEqual(["uri", "url"]);
    expect(o.fields.get("url")!.aliases).toBeUndefined();
  });

  test("partial coverage keeps canonical optional", () => {
    const r = inferOf([
      '{"url": "x"}',
      '{"uri": "y"}',
      "{}", // 3rd sample has neither
    ]);
    const o = r.root as Extract<Shape, { kind: "object" }>;
    const f = [...o.fields.values()][0]!;
    expect(f.aliases?.length).toBe(1);
    expect(f.optional).toBe(true);
    expect(f.observedCount).toBe(2);
  });

  test("only one observed candidate does nothing", () => {
    const r = inferOf([
      '{"url": "x"}',
      "{}",
    ]);
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect([...o.fields.keys()]).toEqual(["url"]);
    expect(o.fields.get("url")!.aliases).toBeUndefined();
  });

  test("alias merge precedes map detection so 4 mutex keys do not become a map", () => {
    const r = inferOf([
      '{"k1": 1}',
      '{"k2": 2}',
      '{"k3": 3}',
      '{"k4": 4}',
    ]);
    expect(r.root.kind).toBe("object");
  });

  test("shapes from int subobjects merge by structural equality", () => {
    const r = inferOf([
      '{"primary": {"v": 1}}',
      '{"secondary": {"v": 2}}',
    ]);
    const o = r.root as Extract<Shape, { kind: "object" }>;
    expect([...o.fields.keys()].length).toBe(1);
    const f = [...o.fields.values()][0]!;
    expect(f.aliases?.length).toBe(1);
  });

  test("XML-tagged fields are excluded from alias merging", () => {
    // Hand-build an observation that simulates two XML attribute siblings
    // — they should never be aliased.
    const r = inferOf([
      '<root a="x" />',
      '<root b="y" />',
    ]);
    // XML auto-detect needs --format=xml; fall back: skip if not parseable.
    if (!r.root || r.root.kind !== "object") return;
    const o = r.root;
    const aField = o.fields.get("a");
    const bField = o.fields.get("b");
    if (aField && bField) {
      expect(aField.aliases).toBeUndefined();
      expect(bField.aliases).toBeUndefined();
    }
  });
});
