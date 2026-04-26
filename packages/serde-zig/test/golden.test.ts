import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateZig, runPipeline, type ZigshapeOptions } from "@zigshape/core";
import { serdeDecorator } from "../src";

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(here, "golden");

type FixtureCfg = { rootName: string; options?: Partial<ZigshapeOptions> };

const FIXTURES: Record<string, FixtureCfg> = {
  "camel-keys": { rootName: "User" },
  "kebab-config": { rootName: "Cfg" },
  "reserved-keys": { rootName: "Thing" },
  "weird-keys": { rootName: "Thing" },
  "nested-camel": { rootName: "User" },
  "enum-rename": { rootName: "Task", options: { enums: "always" } },
  "union-commands": { rootName: "Commands", options: { unions: "tagged" } },
};

function loadSamples(base: string): string[] {
  const samplesPath = join(goldenDir, base + ".samples.json");
  if (existsSync(samplesPath)) {
    const arr = JSON.parse(readFileSync(samplesPath, "utf8"));
    if (!Array.isArray(arr)) throw new Error(`${base}.samples.json is not an array`);
    return arr.map((s) => JSON.stringify(s));
  }
  return [readFileSync(join(goldenDir, base + ".json"), "utf8")];
}

function generateSerdeZig(samples: string[], cfg: FixtureCfg): string {
  const { normalized } = runPipeline({
    samples,
    rootName: cfg.rootName,
    inferOptions: cfg.options,
  });
  if (!normalized) throw new Error("pipeline produced no output");
  return generateZig(normalized, serdeDecorator(normalized));
}

describe("serde-zig golden fixtures", () => {
  const fixtureBases = new Set<string>();
  for (const f of readdirSync(goldenDir)) {
    if (f.endsWith(".samples.json")) fixtureBases.add(f.replace(/\.samples\.json$/, ""));
    else if (f.endsWith(".json")) fixtureBases.add(f.replace(/\.json$/, ""));
  }
  expect(fixtureBases.size).toBeGreaterThanOrEqual(4);

  for (const base of fixtureBases) {
    const cfg = FIXTURES[base];
    if (!cfg) throw new Error(`No fixture config for ${base}`);
    test(base, () => {
      const samples = loadSamples(base);
      const expected = readFileSync(join(goldenDir, base + ".serde.zig"), "utf8");
      const actual = generateSerdeZig(samples, cfg);
      expect(actual).toBe(expected);
    });
  }
});
