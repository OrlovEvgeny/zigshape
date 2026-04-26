import type { Format } from "./parsers/types";

export type IntStrategy = "smallest" | "u64" | "i64";
export type EnumStrategy = "auto" | "off" | "always";
export type UnionStrategy = "off" | "tagged";
export type AliasStrategy = "auto" | "off";
export type StringStrategy = "slice" | "mut" | "sentinel";
export type MapStrategy = "auto" | "struct" | "hash-map";

export type ZigshapeOptions = {
  format: "auto" | Format;
  intStrategy: IntStrategy;
  enums: EnumStrategy;
  unions: UnionStrategy;
  aliases: AliasStrategy;
  defaultsFromSamples: boolean;
  /** When set, the serde decorator emits `.deny_unknown_fields = true` on
   *  every generated struct.  Has no effect on the plain target. */
  denyUnknownFields: boolean;
  /** Wire-format string handling.  "slice" → []const u8 (default).
   *  "mut" → []u8.  "sentinel" → [:0]const u8. */
  strings: StringStrategy;
  /** Map detection override.  "auto" → existing heuristic; "struct" → never
   *  emit std.StringHashMap; "hash-map" → always when fields are homogeneous,
   *  ignoring key shape (still requires homogeneous values). */
  maps: MapStrategy;
  mapMinKeys: number;
  enumMaxVariants: number;
  enumMinObservations: number;
  enumDistinctRatio: number;
};

export const DEFAULT_OPTIONS: ZigshapeOptions = {
  format: "auto",
  intStrategy: "smallest",
  enums: "auto",
  unions: "off",
  aliases: "auto",
  defaultsFromSamples: false,
  denyUnknownFields: false,
  strings: "slice",
  maps: "auto",
  mapMinKeys: 4,
  enumMaxVariants: 8,
  enumMinObservations: 3,
  enumDistinctRatio: 0.6,
};

export function withDefaults(opts?: Partial<ZigshapeOptions>): ZigshapeOptions {
  if (!opts) return { ...DEFAULT_OPTIONS };
  return { ...DEFAULT_OPTIONS, ...opts };
}
