import { describe, expect, test } from "bun:test";
import { runPipeline } from "../src/pipeline";
import type { Shape } from "../src/shape";

function rootShape(samples: string[], opts: Parameters<typeof runPipeline>[0]["inferOptions"] = {}) {
  const r = runPipeline({ samples, rootName: "X", inferOptions: opts });
  if (!r.normalized) throw new Error("pipeline failed");
  // Re-derive the shape kind from the rootType: a stringMap rootType
  // corresponds to a "map" shape; otherwise we can read the kind from decls.
  return { result: r.normalized, warnings: r.warnings };
}

describe("map detection edge cases", () => {
  test("empty object stays as struct", () => {
    const { result } = rootShape(["{}"]);
    const struct = result.decls.find((d) => d.kind === "struct");
    expect(struct).toBeDefined();
    if (struct?.kind === "struct") {
      expect(struct.fields.length).toBe(0);
    }
  });

  test("single-key object never becomes a map (below threshold)", () => {
    const { result } = rootShape(['{"only": {"v": 1}}']);
    const struct = result.decls.find((d) => d.kind === "struct" && d.name === "X");
    expect(struct).toBeDefined();
    expect(result.rootType.kind).toBe("ref");
  });

  test("UUID-keyed object with homogeneous values triggers map", () => {
    const { result, warnings } = rootShape([
      '{"6f1b8a3e-1f9d-4b6e-8c4a-2c5b1c1f1d9a": {"v": 1},' +
      ' "6f1b8a3e-1f9d-4b6e-8c4a-2c5b1c1f1d9b": {"v": 2},' +
      ' "6f1b8a3e-1f9d-4b6e-8c4a-2c5b1c1f1d9c": {"v": 3},' +
      ' "6f1b8a3e-1f9d-4b6e-8c4a-2c5b1c1f1d9d": {"v": 4}}',
    ]);
    expect(result.rootType.kind).toBe("stringMap");
    expect(warnings.some((w) => w.code === "infer.map_candidate")).toBe(true);
  });

  test("mixed identifier keys → struct (not all keys are dynamic-looking)", () => {
    const { result } = rootShape([
      '{"alice": {"v": 1}, "bob": {"v": 2}, "carol": {"v": 3}, "dave": {"v": 4}}',
    ]);
    expect(result.rootType.kind).toBe("ref");
  });

  test("--maps hash-map forces map even on identifier-only keys", () => {
    const { result } = rootShape(
      ['{"alice": {"v": 1}, "bob": {"v": 2}}'],
      { maps: "hash-map" },
    );
    expect(result.rootType.kind).toBe("stringMap");
  });

  test("--maps struct disables map detection on dynamic keys", () => {
    const { result } = rootShape(
      [
        '{"a-1": {"v": 1}, "a-2": {"v": 2}, "a-3": {"v": 3}, "a-4": {"v": 4}}',
      ],
      { maps: "struct" },
    );
    expect(result.rootType.kind).toBe("ref");
  });

  test("heterogeneous values → struct, not map, even with dynamic keys", () => {
    const { result } = rootShape([
      '{"a-1": 1, "a-2": "x", "a-3": true, "a-4": 4}',
    ]);
    expect(result.rootType.kind).toBe("ref");
  });
});

// (Compile-time only — rootShape returns NormalizeResult so this assert is
// just a marker that the test file imports the Shape type successfully.)
const _: Shape = { kind: "null" };
void _;
