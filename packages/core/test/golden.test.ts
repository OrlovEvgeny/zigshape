import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/pipeline";
import { generateZig } from "../src/generate";
import type { ZigshapeOptions } from "../src/options";

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(here, "golden");

type FixtureCfg = { rootName: string; options?: Partial<ZigshapeOptions> };

const ROOT_NAMES: Record<string, FixtureCfg> = {
  flat: { rootName: "User" },
  nested: { rootName: "User" },
  "array-of-objects": { rootName: "Root" },
  "reserved-keys": { rootName: "Thing" },
  "weird-keys": { rootName: "Thing" },
  map: { rootName: "Cfg" },
  "scalar-root": { rootName: "Count" },
  "array-root": { rootName: "Users" },
  "empty-struct": { rootName: "Empty" },
  optional: { rootName: "User" },
  "intwidth-u8-max": { rootName: "N" },
  "intwidth-u16": { rootName: "N" },
  "intwidth-u32": { rootName: "N" },
  "intwidth-u64": { rootName: "N" },
  "intwidth-i8": { rootName: "N" },
  "intwidth-i16": { rootName: "N" },
  "enum-status": { rootName: "User" },
  "enum-with-rename": { rootName: "Task", options: { enums: "always" } },
  "union-commands": { rootName: "Commands", options: { unions: "tagged" } },
};

/** A fixture is either a single .json file (one sample) or a .samples.json
 *  file containing an array of samples (each element is itself any JSON
 *  value).  The companion .plain.zig file holds the expected output. */
function loadSamples(base: string): string[] {
  const samplesPath = join(goldenDir, base + ".samples.json");
  if (existsSync(samplesPath)) {
    const arr = JSON.parse(readFileSync(samplesPath, "utf8"));
    if (!Array.isArray(arr)) throw new Error(`${base}.samples.json is not an array`);
    return arr.map((s) => JSON.stringify(s));
  }
  return [readFileSync(join(goldenDir, base + ".json"), "utf8")];
}

function generatePlainZig(samples: string[], cfg: FixtureCfg): string {
  const { normalized } = runPipeline({
    samples,
    rootName: cfg.rootName,
    inferOptions: cfg.options,
  });
  if (!normalized) throw new Error("pipeline produced no output");
  return generateZig(normalized);
}

describe("plain Zig golden fixtures", () => {
  const fixtureBases = new Set<string>();
  for (const f of readdirSync(goldenDir)) {
    if (f.endsWith(".samples.json")) fixtureBases.add(f.replace(/\.samples\.json$/, ""));
    else if (f.endsWith(".json")) fixtureBases.add(f.replace(/\.json$/, ""));
  }
  expect(fixtureBases.size).toBeGreaterThanOrEqual(6);

  for (const base of fixtureBases) {
    const cfg = ROOT_NAMES[base];
    if (!cfg) throw new Error(`No fixture config for ${base}`);
    test(base, () => {
      const samples = loadSamples(base);
      const expected = readFileSync(join(goldenDir, base + ".plain.zig"), "utf8");
      const actual = generatePlainZig(samples, cfg);
      expect(actual).toBe(expected);
    });
  }
});
