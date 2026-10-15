import { decode } from "@toon-format/toon";
import { DiagnosticBag } from "../diagnostics";
import type { SrcRef, ZField, ZValue } from "../value";
import type { ParseResult } from "./types";

/** TOON (Token-Oriented Object Notation), decoded with the reference
 *  implementation into the JSON data model.  The decoder doesn't expose
 *  positions, so source ranges cover the whole document. */
export function parseToon(input: string, sampleIndex: number): ParseResult {
  const diagnostics = new DiagnosticBag();
  const src: SrcRef = { sample: sampleIndex, offset: 0, length: input.length };
  let decoded: unknown;
  try {
    decoded = decode(input);
  } catch (e) {
    diagnostics.error("parse.toon_error", e instanceof Error ? e.message : String(e), { src });
    return { value: null, diagnostics };
  }
  return { value: fromJs(decoded, src), diagnostics };
}

function fromJs(value: unknown, src: SrcRef): ZValue {
  if (value === null || value === undefined) return { kind: "null", src };
  if (typeof value === "boolean") return { kind: "bool", value, src };
  if (typeof value === "string") return { kind: "string", value, src };
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? { kind: "int", value: BigInt(value), src } : { kind: "float", value, src };
  }
  if (Array.isArray(value)) return { kind: "array", items: value.map((v) => fromJs(v, src)), src };
  const fields = new Map<string, ZField>();
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    fields.set(key, { key, keySrc: src, value: fromJs(v, src) });
  }
  return { kind: "object", fields, src };
}
