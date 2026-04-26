import type { DiagnosticBag } from "../diagnostics";
import type { ZValue } from "../value";

export type ParseResult = {
  value: ZValue | null;
  diagnostics: DiagnosticBag;
  /** Set by the XML parser only.  The root element's tag name (e.g. "user")
   *  so the serde-zig decorator can emit `.xml_root = "<name>"`. */
  xmlRoot?: string;
};

export type Format = "json" | "yaml" | "toml" | "xml";

export const SUPPORTED_FORMATS: readonly Format[] = ["json", "yaml", "toml", "xml"];
