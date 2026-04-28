import type { ZigshapeOptions } from "@zigshape/core";

export type PresetId = "api" | "strict" | "loose" | "xml";

export type Preset = {
  id: PresetId;
  label: string;
  description: string;
  options: Partial<ZigshapeOptions>;
};

export const PRESETS: Preset[] = [
  {
    id: "api",
    label: "API response",
    description: "Smallest int widths from observed range; auto enum suggestion; missing/null become optional.",
    options: {
      intStrategy: "smallest",
      enums: "auto",
      unions: "off",
      defaultsFromSamples: false,
    },
  },
  {
    id: "strict",
    label: "Strict config",
    description: "Conservative u64; enums off; observed scalar values become Zig defaults — best for TOML/YAML configs.",
    options: {
      intStrategy: "u64",
      enums: "off",
      unions: "off",
      defaultsFromSamples: true,
    },
  },
  {
    id: "loose",
    label: "Loose schema",
    description: "Wide u64; everything that's ambiguous falls back to std.json.Value.",
    options: {
      intStrategy: "u64",
      enums: "off",
      unions: "off",
      defaultsFromSamples: false,
    },
  },
  {
    id: "xml",
    label: "XML document",
    description: "XML-friendly defaults: u64 widths, aliases on, no enum guessing — keeps the generated struct close to the wire form.",
    options: {
      format: "xml",
      intStrategy: "u64",
      enums: "off",
      unions: "off",
      aliases: "auto",
      defaultsFromSamples: false,
    },
  },
];

export const DEFAULT_PRESET: PresetId = "api";
