import { DiagnosticBag } from "../diagnostics";
import type { SrcRef, ZValue } from "../value";
import { parseJson } from "./json";
import type { ParseResult } from "./types";

/** NDJSON: newline-delimited JSON.  Each non-empty line is parsed as an
 *  independent JSON value; the resulting `ZValue` is a `ZArray` whose `items`
 *  are the per-line values, with their `src` ranges pointing at the line's
 *  position in the source text.
 *
 *  The pipeline turns this back into multiple samples when
 *  `treatRootArrayAsSamples` is set (which the NDJSON format auto-sets) — so
 *  each line ends up observed independently for inference purposes, exactly
 *  as the NDJSON convention implies. */
export function parseNdjson(input: string, sampleIndex: number): ParseResult {
  const diagnostics = new DiagnosticBag();
  const items: ZValue[] = [];
  let offset = 0;

  for (const rawLine of input.split(/\r?\n/)) {
    const lineStart = offset;
    offset += rawLine.length + 1; // +1 for the consumed newline

    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("#")) {
      continue;
    }

    // Parse the line as a single JSON sample.  We use parseJson (which already
    // handles BigInt-safe integer parsing) and then shift its `src` ranges by
    // `lineStart` so they reference offsets within the full NDJSON input.
    const r = parseJson(rawLine, sampleIndex);
    for (const d of r.diagnostics.toArray()) {
      diagnostics.push({
        ...d,
        src: d.src ? shiftSrc(d.src, lineStart) : undefined,
      });
    }
    if (r.value && !r.diagnostics.hasErrors()) {
      items.push(shiftZValue(r.value, lineStart));
    }
  }

  if (items.length === 0) {
    diagnostics.error("parse.ndjson_empty", "no NDJSON records found");
    return { value: null, diagnostics };
  }

  const wholeDoc: SrcRef = { sample: sampleIndex, offset: 0, length: input.length };
  return {
    value: { kind: "array", items, src: wholeDoc },
    diagnostics,
  };
}

function shiftSrc(src: SrcRef, by: number): SrcRef {
  return { sample: src.sample, offset: src.offset + by, length: src.length };
}

function shiftZValue(value: ZValue, by: number): ZValue {
  const src = shiftSrc(value.src, by);
  switch (value.kind) {
    case "null":
    case "bool":
    case "int":
    case "float":
    case "string":
      return { ...value, src } as ZValue;
    case "array":
      return { kind: "array", src, items: value.items.map((v) => shiftZValue(v, by)) };
    case "object": {
      const fields = new Map<string, typeof value.fields extends Map<string, infer F> ? F : never>();
      for (const [k, f] of value.fields) {
        fields.set(k, {
          key: f.key,
          keySrc: shiftSrc(f.keySrc, by),
          value: shiftZValue(f.value, by),
          xml: f.xml,
        });
      }
      return { kind: "object", src, fields };
    }
  }
}
