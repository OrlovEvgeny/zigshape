import type { DiagnosticBag } from "../diagnostics";
import type { ZValue } from "../value";

export type ParseResult = {
  value: ZValue | null;
  diagnostics: DiagnosticBag;
};

export type Format = "json" | "yaml" | "toml";

export const SUPPORTED_FORMATS: readonly Format[] = ["json", "yaml", "toml"];
