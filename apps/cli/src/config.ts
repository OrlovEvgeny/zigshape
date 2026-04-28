import type { ZigshapeOptions } from "@zigshape/core";
import type { RenameAllStrategy } from "@zigshape/serde-zig";

/** zigshape.json on-disk shape.  All keys optional. */
export type ZigshapeConfig = {
  options?: Partial<ZigshapeOptions>;
  /** Per-path overrides applied at normalize time.  Phase D wires the runtime
   *  side; the loader recognises the key now so configs are stable across
   *  phases. */
  overrides?: Record<string, FieldOverride>;
  /** Decoration knobs forwarded to the serde decorator. */
  serde?: {
    denyUnknownFields?: boolean;
    flattenPaths?: string[];
    skipPaths?: string[];
    /** Force a serde naming convention.  Defaults to `auto` (existing
     *  detect-when-it-round-trips heuristic) when unspecified. */
    renameAll?: RenameAllStrategy;
  };
};

export type FieldOverride = {
  type?: string;
  name?: string;
  optional?: boolean;
};

export async function loadConfig(path: string): Promise<ZigshapeConfig> {
  const text = await Bun.file(path).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`config ${path}: ${(e as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`config ${path}: must be an object`);
  }
  return parsed as ZigshapeConfig;
}
