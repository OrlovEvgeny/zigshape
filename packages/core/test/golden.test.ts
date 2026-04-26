import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateZig } from "../src/generate";
import { infer } from "../src/infer";
import { normalize } from "../src/normalize";
import { observeSamples } from "../src/observe";
import { parseSample } from "../src/parse";

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(here, "golden");

// Map from fixture base name to the rootName to use.
const ROOT_NAMES: Record<string, string> = {
  flat: "User",
  nested: "User",
  "array-of-objects": "Root",
  "reserved-keys": "Thing",
  "weird-keys": "Thing",
  map: "Cfg",
  "scalar-root": "Count",
  "array-root": "Users",
  "empty-struct": "Empty",
  optional: "User",
};

function generatePlainZig(input: string, rootName: string): string {
  const r = parseSample(input, 0);
  if (!r.value) throw new Error("parse failed: " + r.diagnostics.toArray().map((d) => d.message).join("; "));
  const observations = observeSamples([r.value]);
  const { root } = infer(observations);
  const result = normalize(root, { rootName });
  return generateZig(result);
}

describe("plain Zig golden fixtures", () => {
  const entries = readdirSync(goldenDir).filter((f) => f.endsWith(".json"));
  expect(entries.length).toBeGreaterThanOrEqual(6);

  for (const file of entries) {
    const base = file.replace(/\.json$/, "");
    const rootName = ROOT_NAMES[base];
    if (!rootName) throw new Error(`No rootName configured for ${base}`);

    test(base, () => {
      const input = readFileSync(join(goldenDir, file), "utf8");
      const expected = readFileSync(join(goldenDir, base + ".plain.zig"), "utf8");
      const actual = generatePlainZig(input, rootName);
      expect(actual).toBe(expected);
    });
  }
});
