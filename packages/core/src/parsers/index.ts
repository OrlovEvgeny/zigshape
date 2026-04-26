import { detectFormat } from "./detect";
import { parseJson } from "./json";
import { parseToml } from "./toml";
import { parseXml } from "./xml";
import { parseYaml } from "./yaml";
import type { Format, ParseResult } from "./types";

export type { Format, ParseResult } from "./types";
export { SUPPORTED_FORMATS } from "./types";
export { detectFormat, type DetectResult } from "./detect";
export { parseJson } from "./json";
export { parseToml } from "./toml";
export { parseXml } from "./xml";
export { parseYaml } from "./yaml";

export function parseSample(
  input: string,
  sampleIndex: number,
  format: Format | "auto" = "json",
): ParseResult {
  const resolved = format === "auto" ? detectFormat(input).format : format;
  switch (resolved) {
    case "json":
      return parseJson(input, sampleIndex);
    case "yaml":
      return parseYaml(input, sampleIndex);
    case "toml":
      return parseToml(input, sampleIndex);
    case "xml":
      return parseXml(input, sampleIndex);
  }
}
