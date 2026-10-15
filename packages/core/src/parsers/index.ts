import { detectFormat } from "./detect";
import { parseJson } from "./json";
import { parseNdjson } from "./ndjson";
import { parseToml } from "./toml";
import { parseXml } from "./xml";
import { parseYaml } from "./yaml";
import { parseCsv } from "./csv";
import { parseToon } from "./toon";
import { parseZon } from "./zon";
import type { Format, ParseResult } from "./types";

export type { Format, ParseResult } from "./types";
export { SUPPORTED_FORMATS, isRecordFormat } from "./types";
export { detectFormat, type DetectResult } from "./detect";
export { parseJson } from "./json";
export { parseNdjson } from "./ndjson";
export { parseToml } from "./toml";
export { parseXml } from "./xml";
export { parseYaml } from "./yaml";
export { parseCsv } from "./csv";
export { parseToon } from "./toon";
export { parseZon } from "./zon";

export function parseSample(
  input: string,
  sampleIndex: number,
  format: Format | "auto" = "json",
): ParseResult {
  const resolved = format === "auto" ? detectFormat(input).format : format;
  switch (resolved) {
    case "json":
      return parseJson(input, sampleIndex);
    case "ndjson":
      return parseNdjson(input, sampleIndex);
    case "yaml":
      return parseYaml(input, sampleIndex);
    case "toml":
      return parseToml(input, sampleIndex);
    case "xml":
      return parseXml(input, sampleIndex);
    case "csv":
      return parseCsv(input, sampleIndex);
    case "zon":
      return parseZon(input, sampleIndex);
    case "toon":
      return parseToon(input, sampleIndex);
  }
}
