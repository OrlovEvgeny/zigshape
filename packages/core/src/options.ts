import type { Format } from "./parsers/types";

export type IntStrategy = "smallest" | "u64" | "i64";
export type EnumStrategy = "auto" | "off" | "always";
export type UnionStrategy = "off" | "tagged";
export type AliasStrategy = "auto" | "off";

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
  mapMinKeys: 4,
  enumMaxVariants: 8,
  enumMinObservations: 3,
  enumDistinctRatio: 0.6,
};

export function withDefaults(opts?: Partial<ZigshapeOptions>): ZigshapeOptions {
  if (!opts) return { ...DEFAULT_OPTIONS };
  return { ...DEFAULT_OPTIONS, ...opts };
}
