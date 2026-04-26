import { parse, TomlDate, TomlError } from "smol-toml";
import { DiagnosticBag } from "../diagnostics";
import type { SrcRef, ZField, ZValue } from "../value";
import type { ParseResult } from "./types";

export function parseToml(input: string, sampleIndex: number): ParseResult {
  const diagnostics = new DiagnosticBag();
  const wholeDoc: SrcRef = { sample: sampleIndex, offset: 0, length: input.length };

  let raw: unknown;
  try {
    raw = parse(input);
  } catch (err) {
    if (err instanceof TomlError) {
      const start = (err as { line?: number; column?: number; codeblock?: string }).line;
      diagnostics.error("parse.toml_error", err.message, {
        src: { sample: sampleIndex, offset: start ?? 0, length: 1 },
      });
    } else {
      diagnostics.error(
        "parse.toml_error",
        err instanceof Error ? err.message : String(err),
        { src: wholeDoc },
      );
    }
    return { value: null, diagnostics };
  }

  const value = jsToZ(raw, wholeDoc, diagnostics);
  return { value, diagnostics };
}

function jsToZ(value: unknown, src: SrcRef, diag: DiagnosticBag): ZValue | null {
  if (value === null || value === undefined) return { kind: "null", src };

  if (typeof value === "boolean") return { kind: "bool", value, src };
  if (typeof value === "string") return { kind: "string", value, src };

  if (typeof value === "bigint") return { kind: "int", value, src };

  if (typeof value === "number") {
    if (Number.isInteger(value) && Number.isSafeInteger(value)) {
      return { kind: "int", value: BigInt(value), src };
    }
    return { kind: "float", value, src };
  }

  if (value instanceof TomlDate) {
    diag.warn(
      "parse.toml_date",
      "TOML date scalar emitted as []const u8; consider a custom adapter",
      { src },
    );
    return { kind: "string", value: value.toISOString(), src };
  }

  if (Array.isArray(value)) {
    const items: ZValue[] = [];
    for (const item of value) {
      const v = jsToZ(item, src, diag);
      if (v) items.push(v);
    }
    return { kind: "array", items, src };
  }

  if (typeof value === "object") {
    const fields = new Map<string, ZField>();
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const v = jsToZ(raw, src, diag);
      if (!v) continue;
      fields.set(key, { key, keySrc: src, value: v });
    }
    return { kind: "object", fields, src };
  }

  diag.warn(
    "parse.toml_unknown",
    `Unsupported TOML value of type ${typeof value}`,
    { src },
  );
  return null;
}
