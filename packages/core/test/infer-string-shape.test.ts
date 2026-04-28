import { describe, expect, test } from "bun:test";
import { runPipeline } from "../src/pipeline";

function pipeline(...samples: string[]) {
  return runPipeline({ samples, rootName: "Root" });
}

describe("string-shape hint warnings", () => {
  test("ISO-8601 datetime string fires infer.string_shape", () => {
    const r = pipeline(
      '{"created_at": "2026-01-01T00:00:00Z"}',
      '{"created_at": "2026-04-15T12:30:45Z"}',
    );
    const shape = r.warnings.find((w) => w.code === "infer.string_shape");
    expect(shape).toBeDefined();
    expect(shape!.message).toContain("iso8601");
    expect(shape!.path).toBe("$.created_at");
  });

  test("ISO-8601 date-only also fires", () => {
    const r = pipeline('{"birthday": "1990-04-12"}');
    expect(r.warnings.some((w) => w.code === "infer.string_shape")).toBe(true);
  });

  test("UUID strings fire infer.string_shape", () => {
    const r = pipeline(
      '{"id": "550e8400-e29b-41d4-a716-446655440000"}',
      '{"id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"}',
    );
    const shape = r.warnings.find((w) => w.code === "infer.string_shape");
    expect(shape).toBeDefined();
    expect(shape!.message).toContain("uuid");
  });

  test("URL strings fire infer.string_shape", () => {
    const r = pipeline('{"link": "https://example.com/path"}');
    const shape = r.warnings.find((w) => w.code === "infer.string_shape");
    expect(shape).toBeDefined();
    expect(shape!.message).toContain("url");
  });

  test("email strings fire infer.string_shape", () => {
    const r = pipeline(
      '{"contact": "alice@example.com"}',
      '{"contact": "bob@example.com"}',
    );
    const shape = r.warnings.find((w) => w.code === "infer.string_shape");
    expect(shape).toBeDefined();
    expect(shape!.message).toContain("email");
  });

  test("plain prose strings do not fire", () => {
    const r = pipeline('{"name": "Alice"}', '{"name": "Bob"}');
    expect(r.warnings.some((w) => w.code === "infer.string_shape")).toBe(false);
  });

  test("type still emits []const u8 — hint never changes the wire type", () => {
    const r = pipeline('{"created_at": "2026-01-01T00:00:00Z"}');
    if (!r.normalized) throw new Error("pipeline failed");
    const root = r.normalized.decls.find((d) => d.kind === "struct");
    if (!root || root.kind !== "struct") throw new Error("root struct expected");
    const f = root.fields.find((x) => x.name === "created_at");
    expect(f).toBeDefined();
    expect(f!.type.kind).toBe("string");
  });

  test("mixed shapes within one path do not fire", () => {
    // First sample is ISO, second is plain — the "every value matches" guard
    // fails so no hint.
    const r = pipeline(
      '{"v": "2026-01-01T00:00:00Z"}',
      '{"v": "free text"}',
    );
    expect(r.warnings.some((w) => w.code === "infer.string_shape")).toBe(false);
  });
});

describe("untagged union overlap warning", () => {
  test("structurally identical variants warn", () => {
    const r = runPipeline({
      samples: [
        JSON.stringify([
          { kind: "alpha", n: 1 },
          { kind: "beta", n: 2 },
        ]),
      ],
      rootName: "Cmd",
      inferOptions: { unions: "untagged" },
    });
    const overlap = r.warnings.find((w) => w.code === "infer.union_untagged_overlap");
    expect(overlap).toBeDefined();
  });

  test("variants with different shapes do NOT warn", () => {
    const r = runPipeline({
      samples: [
        JSON.stringify([
          { kind: "ping" },
          { kind: "execute", query: "SELECT 1" },
        ]),
      ],
      rootName: "Cmd",
      inferOptions: { unions: "untagged" },
    });
    expect(r.warnings.some((w) => w.code === "infer.union_untagged_overlap")).toBe(
      false,
    );
  });
});
