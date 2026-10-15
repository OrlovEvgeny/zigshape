import type { DiagnosticBag } from "../diagnostics";
import type { ZValue } from "../value";

export type ParseResult = {
  value: ZValue | null;
  diagnostics: DiagnosticBag;
  /** Set by the XML parser only.  The root element's tag name (e.g. "user")
   *  so the serde-zig decorator can emit `.xml_root = "<name>"`. */
  xmlRoot?: string;
};

export type Format = "json" | "ndjson" | "yaml" | "toml" | "xml" | "csv" | "zon" | "toon";

export const SUPPORTED_FORMATS: readonly Format[] = ["json", "ndjson", "yaml", "toml", "xml", "csv", "zon", "toon"];

/** Formats whose document is a list of records, each observed as its own
 *  sample: NDJSON lines and CSV rows. */
export function isRecordFormat(format: Format): boolean {
  return format === "ndjson" || format === "csv";
}
