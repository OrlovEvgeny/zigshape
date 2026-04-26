import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateZig,
  infer,
  normalize,
  observeSamples,
  parseSample,
} from "@zigshape/core";
import { serdeDecorator } from "../src";

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(here, "golden");

const ROOT_NAMES: Record<string, string> = {
  "camel-keys": "User",
  "kebab-config": "Cfg",
  "reserved-keys": "Thing",
  "weird-keys": "Thing",
  "nested-camel": "User",
};

function generateSerdeZig(input: string, rootName: string): string {
  const r = parseSample(input, 0);
  if (!r.value) throw new Error("parse failed");
  const observations = observeSamples([r.value]);
  const { root } = infer(observations);
  const result = normalize(root, { rootName });
  return generateZig(result, serdeDecorator(result));
}

describe("serde-zig golden fixtures", () => {
  const entries = readdirSync(goldenDir).filter((f) => f.endsWith(".json"));
  expect(entries.length).toBeGreaterThanOrEqual(4);

  for (const file of entries) {
    const base = file.replace(/\.json$/, "");
    const rootName = ROOT_NAMES[base];
    if (!rootName) throw new Error(`No rootName for ${base}`);
    test(base, () => {
      const input = readFileSync(join(goldenDir, file), "utf8");
      const expected = readFileSync(join(goldenDir, base + ".serde.zig"), "utf8");
      const actual = generateSerdeZig(input, rootName);
      expect(actual).toBe(expected);
    });
  }
});
