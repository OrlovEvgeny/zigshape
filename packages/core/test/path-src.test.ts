import { describe, expect, test } from "bun:test";
import { parseSample } from "../src/parse";
import { pathSrcMap } from "../src/value";

describe("pathSrcMap", () => {
  test("JSON: every path resolves to a precise per-node range", () => {
    const sample = '{"id": 1, "user": {"name": "Alice"}}';
    const r = parseSample(sample, 0);
    expect(r.value).not.toBeNull();
    const map = pathSrcMap(r.value!);
    expect(map.get("$")).toBeDefined();
    expect(map.get("$.id")).toBeDefined();
    expect(map.get("$.user")).toBeDefined();
    expect(map.get("$.user.name")).toBeDefined();
    // The leaf range must point inside the original text — not the whole doc.
    const idSrc = map.get("$.id")!;
    expect(sample.slice(idSrc.offset, idSrc.offset + idSrc.length)).toBe("1");
    const nameSrc = map.get("$.user.name")!;
    expect(sample.slice(nameSrc.offset, nameSrc.offset + nameSrc.length)).toBe('"Alice"');
  });

  test("YAML: per-node ranges flow through", () => {
    const sample = "id: 1\nuser:\n  name: Alice\n";
    const r = parseSample(sample, 0, "yaml");
    expect(r.value).not.toBeNull();
    const map = pathSrcMap(r.value!);
    expect(map.get("$.id")).toBeDefined();
    expect(map.get("$.user.name")).toBeDefined();
    const idSrc = map.get("$.id")!;
    // YAML ranges from the `yaml` lib are precise on scalars.
    expect(sample.slice(idSrc.offset, idSrc.offset + idSrc.length)).toBe("1");
  });

  test("array element paths use [*]", () => {
    const sample = '[{"id": 1}, {"id": 2}]';
    const r = parseSample(sample, 0);
    expect(r.value).not.toBeNull();
    const map = pathSrcMap(r.value!);
    expect(map.get("$[*].id")).toBeDefined();
  });

  test("TOML / XML: whole-doc fallback is still a valid lookup", () => {
    const sample = 'id = 1\n[user]\nname = "Alice"\n';
    const r = parseSample(sample, 0, "toml");
    expect(r.value).not.toBeNull();
    const map = pathSrcMap(r.value!);
    // smol-toml does not expose per-key positions; the whole-doc fallback
    // means every path maps to (0, length(sample)).
    const idSrc = map.get("$.id");
    expect(idSrc).toBeDefined();
    expect(idSrc!.offset).toBe(0);
    expect(idSrc!.length).toBe(sample.length);
  });
});
