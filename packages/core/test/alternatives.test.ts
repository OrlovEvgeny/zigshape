import { describe, expect, test } from "bun:test";
import { suggestAlternatives, type ZigType } from "../src/zig/types";

function alts(t: ZigType): string[] {
  return suggestAlternatives(t);
}

describe("suggestAlternatives", () => {
  test("string slice -> other reprs + serde.Value", () => {
    const a = alts({ kind: "string", repr: "slice" });
    expect(a).toContain("[]u8");
    expect(a).toContain("[:0]const u8");
    expect(a).toContain("serde.Value");
    // Current rendering filtered out.
    expect(a).not.toContain("[]const u8");
  });

  test("int u8 -> other widths", () => {
    const a = alts({ kind: "int", width: "u8" });
    expect(a).toContain("u16");
    expect(a).toContain("u32");
    expect(a).toContain("u64");
    expect(a).not.toContain("u8");
    // Capped at 4.
    expect(a.length).toBeLessThanOrEqual(4);
  });

  test("f64 -> f32 / string / serde.Value", () => {
    const a = alts({ kind: "f64" });
    expect(a).toContain("f32");
    expect(a).toContain("[]const u8");
    expect(a).toContain("serde.Value");
  });

  test("slice T -> ArrayList + mut slice", () => {
    const a = alts({ kind: "slice", element: { kind: "string", repr: "slice" } });
    expect(a).toContain("std.ArrayList([]const u8)");
    expect(a).toContain("[][]const u8");
  });

  test("json (unknown) -> serde / string / compileError", () => {
    const a = alts({ kind: "json" });
    expect(a).toContain("serde.Value");
    expect(a).toContain("[]const u8");
    expect(a.some((s) => s.includes("@compileError"))).toBe(true);
  });

  test("optional T -> non-optional T", () => {
    const a = alts({ kind: "optional", inner: { kind: "string", repr: "slice" } });
    expect(a).toContain("[]const u8");
  });

  test("ref -> just optional wrap", () => {
    const a = alts({ kind: "ref", structName: "User" });
    expect(a).toEqual(["?User"]);
  });

  test("bool -> none", () => {
    expect(alts({ kind: "bool" })).toEqual([]);
  });

  test("raw -> none (already user-provided)", () => {
    expect(alts({ kind: "raw", text: "MyType" })).toEqual([]);
  });

  test("dedup current rendering", () => {
    const a = alts({ kind: "string", repr: "mut" });
    // Current is []u8; should be filtered.
    expect(a.includes("[]u8")).toBe(false);
    // []const u8 included as alternative.
    expect(a.includes("[]const u8")).toBe(true);
  });
});
