import { describe, expect, test } from "bun:test";
import { runPipeline } from "../src/pipeline";
import type { Shape } from "../src/shape";

function infer(samples: string[]) {
  const r = runPipeline({
    samples,
    rootName: "Cmd",
    inferOptions: { unions: "tagged" },
  });
  return r;
}

describe("union(enum) variant naming collisions", () => {
  test("variants whose sanitized names clash get _2 suffix", () => {
    const samples = [
      '[{"type": "ping", "v": 1},{"type": "Ping", "v": 2},{"type": "pong", "v": 3}]',
    ];
    const r = infer(samples);
    expect(r.normalized).not.toBeNull();
    const decls = r.normalized!.decls;
    const union = decls.find((d) => d.kind === "union");
    expect(union).toBeDefined();
    if (!union || union.kind !== "union") return;
    // Both "ping" and "Ping" sanitize to "ping" — collision must be resolved
    // deterministically, leaving pong untouched.
    const names = union.variants.map((v) => v.zigName).sort();
    expect(names.includes("ping")).toBe(true);
    expect(names.includes("ping_2")).toBe(true);
    expect(names.includes("pong")).toBe(true);
  });

  test("variants with non-identifier discriminator values escape & dedupe", () => {
    const samples = [
      '[{"type": "do-x", "n": 1},{"type": "do x", "n": 2},{"type": "do_x", "n": 3}]',
    ];
    const r = infer(samples);
    if (!r.normalized) throw new Error("infer failed");
    const union = r.normalized.decls.find((d) => d.kind === "union");
    if (!union || union.kind !== "union") throw new Error("union expected");
    // All three sanitize to "do_x" — uniqification must produce 3 distinct
    // identifiers.
    const names = new Set(union.variants.map((v) => v.zigName));
    expect(names.size).toBe(3);
  });
});

describe("union pickTagField fallback", () => {
  test("falls back to highest-cardinality string field when no preferred tag exists", () => {
    const r = infer([
      '[{"action": "go", "v": 1},{"action": "stop", "v": 2}]',
    ]);
    if (!r.normalized) throw new Error("infer failed");
    const union = r.normalized.decls.find((d) => d.kind === "union");
    if (!union || union.kind !== "union") throw new Error("union expected");
    expect(union.tagField).toBe("action");
  });
});

describe("union: sub-shape inference still works under collisions", () => {
  test("variant struct names get singular form from variantName", () => {
    const r = infer([
      '[{"type": "alpha", "n": 1},{"type": "beta", "s": "x"}]',
    ]);
    if (!r.normalized) throw new Error("infer failed");
    const structs = r.normalized.decls.filter((d) => d.kind === "struct");
    const names = structs.map((s) => s.name);
    expect(names.includes("Alpha")).toBe(true);
    expect(names.includes("Beta")).toBe(true);
  });
});

describe("Shape: union variants are returned with deterministic order", () => {
  test("first-seen tag value comes first", () => {
    const r = infer([
      '[{"type": "a"}, {"type": "b"}, {"type": "a"}]',
    ]);
    const root = r.normalized?.decls.find((d) => d.kind === "union");
    if (!root || root.kind !== "union") throw new Error("union expected");
    expect(root.variants.map((v) => v.tagValue)).toEqual(["a", "b"]);
  });
});

describe("Shape consumer: shape kind is union", () => {
  test("infer surface still exposes the union shape", () => {
    const r = infer(['[{"type": "x"},{"type": "y"}]']);
    if (!r.normalized) throw new Error("infer failed");
    // The root array's element shape is the union — the rootType therefore
    // wraps a slice of the union struct ref.
    const arr = r.normalized.rootType;
    expect(arr.kind).toBe("slice");
    if (arr.kind !== "slice") return;
    expect(arr.element.kind).toBe("ref");
  });
});

// Sanity helper exported for completeness even though tests above already
// cover the inference surface.
export function unionShapeOf(root: Shape): Shape | null {
  if (root.kind !== "array") return null;
  return root.element;
}
