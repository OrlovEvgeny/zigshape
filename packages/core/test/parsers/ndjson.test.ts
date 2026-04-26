import { describe, expect, test } from "bun:test";
import { parseNdjson } from "../../src/parsers/ndjson";
import { detectFormat } from "../../src/parsers/detect";
import { runPipeline } from "../../src/pipeline";

describe("parseNdjson", () => {
  test("each line becomes an array item", () => {
    const r = parseNdjson('{"id": 1}\n{"id": 2}\n', 0);
    expect(r.value).not.toBeNull();
    expect(r.value!.kind).toBe("array");
    if (r.value!.kind === "array") {
      expect(r.value!.items.length).toBe(2);
      expect(r.value!.items[0]!.kind).toBe("object");
    }
  });

  test("blank lines and # / // comments are skipped", () => {
    const r = parseNdjson(`{"a": 1}\n\n# comment\n// also comment\n{"a": 2}\n`, 0);
    if (r.value?.kind !== "array") throw new Error("expected array");
    expect(r.value.items.length).toBe(2);
  });

  test("source ranges are shifted to absolute positions", () => {
    const input = '{"id": 1}\n{"id": 2}\n';
    const r = parseNdjson(input, 0);
    if (r.value?.kind !== "array") throw new Error("expected array");
    const first = r.value.items[0]!;
    const second = r.value.items[1]!;
    // First object starts at offset 0; second starts after first line + \n.
    expect(first.src.offset).toBe(0);
    expect(second.src.offset).toBe(input.indexOf('{"id": 2}'));
  });

  test("empty input produces an error diagnostic", () => {
    const r = parseNdjson("", 0);
    expect(r.value).toBeNull();
    expect(r.diagnostics.toArray().some((d) => d.code === "parse.ndjson_empty")).toBe(true);
  });
});

describe("NDJSON detection", () => {
  test("two objects on separate lines triggers ndjson", () => {
    expect(detectFormat('{"a": 1}\n{"a": 2}\n').format).toBe("ndjson");
  });

  test("a single multi-line JSON object stays json", () => {
    expect(detectFormat(`{\n  "a": 1\n}\n`).format).toBe("json");
  });
});

describe("NDJSON via runPipeline expands to multiple samples", () => {
  test("each line is observed as its own sample", () => {
    const r = runPipeline({
      samples: ['{"id": 1, "name": "x"}\n{"id": 2}\n'],
      rootName: "User",
      inferOptions: { format: "ndjson" },
    });
    if (!r.normalized) throw new Error("pipeline failed");
    const root = r.normalized.decls.find((d) => d.kind === "struct" && d.name === "User");
    if (!root || root.kind !== "struct") throw new Error("root struct missing");
    // 'name' appeared in 1 of 2 samples → optional.
    const name = root.fields.find((f) => f.name === "name");
    expect(name?.observedCount).toBe(1);
    expect(name?.parentTotal).toBe(2);
    expect(name?.type.kind).toBe("optional");
  });
});

describe("treatRootArrayAsSamples option", () => {
  test("array-rooted JSON expands to multiple samples when flag is set", () => {
    const r = runPipeline({
      samples: ['[{"id": 1, "x": "a"}, {"id": 2}]'],
      rootName: "User",
      inferOptions: { format: "json", treatRootArrayAsSamples: true },
    });
    if (!r.normalized) throw new Error("pipeline failed");
    const root = r.normalized.decls.find((d) => d.kind === "struct" && d.name === "User");
    if (!root || root.kind !== "struct") throw new Error("root struct missing");
    const x = root.fields.find((f) => f.name === "x");
    expect(x?.observedCount).toBe(1);
    expect(x?.parentTotal).toBe(2);
  });

  test("flag off: array stays as a single sample, root becomes []const Item", () => {
    const r = runPipeline({
      samples: ['[{"id": 1}, {"id": 2}]'],
      rootName: "Users",
      inferOptions: { format: "json" },
    });
    if (!r.normalized) throw new Error("pipeline failed");
    expect(r.normalized.rootType.kind).toBe("slice");
  });
});
