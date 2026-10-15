import type { Format } from "@zigshape/core";

/** Display names, in the order the Format dropdown lists them. */
export const FORMAT_LABEL: Record<Format, string> = {
  json: "JSON",
  ndjson: "NDJSON",
  yaml: "YAML",
  toml: "TOML",
  xml: "XML",
  csv: "CSV",
  zon: "ZON",
  toon: "TOON",
};

export const FORMATS = Object.keys(FORMAT_LABEL) as Format[];
