import { describe, expect, test } from "bun:test";
import { infer } from "../src/infer";
import { observeSamples } from "../src/observe";
import { parseSample } from "../src/parse";
import type { Shape } from "../src/shape";
import type { ZValue } from "../src/value";

function inferOf(samples: string[], opts: Parameters<typeof infer>[1] = {}) {
  const values: ZValue[] = samples.map((s, i) => {
    const r = parseSample(s, i);
    if (!r.value) throw new Error("parse fail: " + s);
    return r.value;
  });
  return infer(observeSamples(values), opts);
}

describe("enum inference (auto)", () => {
  test("low-cardinality string field with repeats becomes enum", () => {
    const r = inferOf([
      '{"status": "active"}',
      '{"status": "inactive"}',
      '{"status": "active"}',
      '{"status": "pending"}',
      '{"status": "active"}',
      '{"status": "inactive"}',
    ]);
    const root = r.root as Extract<Shape, { kind: "object" }>;
    const status = root.fields.get("status")!.shape;
    expect(status.kind).toBe("enum");
    if (status.kind === "enum") {
      expect(status.variants.map((v) => v.rawValue).sort()).toEqual(["active", "inactive", "pending"]);
    }
  });

  test("all distinct values (no repeats) stays string", () => {
    const r = inferOf([
      '{"name": "alice"}',
      '{"name": "bob"}',
      '{"name": "carol"}',
      '{"name": "dave"}',
    ]);
    const root = r.root as Extract<Shape, { kind: "object" }>;
    expect(root.fields.get("name")!.shape.kind).toBe("string");
  });

  test("too few observations stays string", () => {
    const r = inferOf(['{"status": "active"}', '{"status": "pending"}']);
    const root = r.root as Extract<Shape, { kind: "object" }>;
    expect(root.fields.get("status")!.shape.kind).toBe("string");
  });

  test("kebab-case values still enum (sanitized, not escaped)", () => {
    const r = inferOf([
      '{"k": "in-progress"}',
      '{"k": "done"}',
      '{"k": "in-progress"}',
      '{"k": "done"}',
      '{"k": "done"}',
    ]);
    const root = r.root as Extract<Shape, { kind: "object" }>;
    const k = root.fields.get("k")!.shape;
    expect(k.kind).toBe("enum");
    if (k.kind === "enum") {
      const inProg = k.variants.find((v) => v.rawValue === "in-progress")!;
      expect(inProg.zigName).toBe("in_progress");
      expect(inProg.escaped).toBe(false);
    }
  });

  test("@\"…\"-needing values block enum suggestion in auto mode", () => {
    // Values starting with a digit force @"..." escaping; auto mode keeps them
    // as []const u8 to avoid surprising users with escaped enum variants.
    const r = inferOf([
      '{"k": "1st"}',
      '{"k": "2nd"}',
      '{"k": "1st"}',
      '{"k": "2nd"}',
      '{"k": "1st"}',
    ]);
    const root = r.root as Extract<Shape, { kind: "object" }>;
    expect(root.fields.get("k")!.shape.kind).toBe("string");
  });

  test("warns on suggestion", () => {
    const r = inferOf([
      '{"s": "a"}',
      '{"s": "b"}',
      '{"s": "a"}',
      '{"s": "b"}',
      '{"s": "a"}',
    ]);
    expect(r.diagnostics.toArray().some((d) => d.code === "infer.enum_candidate")).toBe(true);
  });
});

describe("enum inference (off)", () => {
  test("never becomes enum", () => {
    const r = inferOf(
      ['{"s": "a"}', '{"s": "b"}', '{"s": "a"}', '{"s": "b"}', '{"s": "a"}'],
      { enums: "off" },
    );
    const root = r.root as Extract<Shape, { kind: "object" }>;
    expect(root.fields.get("s")!.shape.kind).toBe("string");
  });
});

describe("enum inference (always)", () => {
  test("triggers despite low observation count", () => {
    const r = inferOf(['{"s": "a"}', '{"s": "b"}'], { enums: "always" });
    const root = r.root as Extract<Shape, { kind: "object" }>;
    expect(root.fields.get("s")!.shape.kind).toBe("enum");
  });

  test("accepts non-identifier values via @\"…\" escaping", () => {
    const r = inferOf(
      ['{"k": "in-progress"}', '{"k": "done"}', '{"k": "in-progress"}'],
      { enums: "always" },
    );
    const root = r.root as Extract<Shape, { kind: "object" }>;
    const k = root.fields.get("k")!.shape;
    expect(k.kind).toBe("enum");
    if (k.kind === "enum") {
      const inProg = k.variants.find((v) => v.rawValue === "in-progress")!;
      expect(inProg.zigName).toBe("in_progress");
      expect(inProg.escaped).toBe(false);
    }
  });

  test("more variants than enumMaxVariants stays string", () => {
    const r = inferOf(
      [
        '{"s": "a"}',
        '{"s": "b"}',
        '{"s": "c"}',
        '{"s": "d"}',
        '{"s": "e"}',
        '{"s": "f"}',
        '{"s": "g"}',
        '{"s": "h"}',
        '{"s": "i"}',
      ],
      { enums: "always", enumMaxVariants: 8 },
    );
    const root = r.root as Extract<Shape, { kind: "object" }>;
    expect(root.fields.get("s")!.shape.kind).toBe("string");
  });
});
