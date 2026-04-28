import { XMLParser, XMLValidator } from "fast-xml-parser";
import { DiagnosticBag } from "../diagnostics";
import type { SrcRef, ZField, ZValue } from "../value";
import type { ParseResult } from "./types";

const ATTR_PREFIX = "@_";
const TEXT_KEY = "#text";

const NS_DETECT_RE = /<[A-Za-z_][\w.-]*:|xmlns:/;

export function parseXml(input: string, sampleIndex: number): ParseResult {
  const diagnostics = new DiagnosticBag();
  const wholeDoc: SrcRef = { sample: sampleIndex, offset: 0, length: input.length };

  // Validate first so malformed XML produces a clean diagnostic with line/col
  // rather than a parser exception.
  const validation = XMLValidator.validate(input, { allowBooleanAttributes: true });
  if (validation !== true) {
    const err = validation.err;
    diagnostics.error(
      "parse.xml_error",
      `${err.msg} (line ${err.line}, col ${err.col})`,
      { src: wholeDoc },
    );
    return { value: null, diagnostics };
  }

  if (NS_DETECT_RE.test(input)) {
    diagnostics.warn(
      "parse.xml_namespace",
      "XML namespace prefixes detected and stripped; original prefix is not preserved in the generated struct",
      { src: wholeDoc },
    );
  }

  // fast-xml-parser merges CDATA sections into the surrounding text node
  // without a marker, so the CDATA boundary disappears from the inferred
  // shape.  We can't recover it after parsing — surface a warning so the
  // user knows the wire content (which may contain XML reserved characters
  // intentionally preserved by CDATA) won't round-trip through the
  // generated struct.
  if (input.includes("<![CDATA[")) {
    diagnostics.warn(
      "parse.xml_cdata",
      "XML CDATA sections detected; content was merged into surrounding text and the CDATA markers are not preserved by the generated struct",
      { src: wholeDoc },
    );
  }

  let parsed: unknown;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: ATTR_PREFIX,
      textNodeName: TEXT_KEY,
      removeNSPrefix: true,
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
      allowBooleanAttributes: true,
    }).parse(input);
  } catch (err) {
    diagnostics.error(
      "parse.xml_error",
      err instanceof Error ? err.message : String(err),
      { src: wholeDoc },
    );
    return { value: null, diagnostics };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    diagnostics.error("parse.xml_error", "XML did not produce a root element", { src: wholeDoc });
    return { value: null, diagnostics };
  }

  // After stripping the XML declaration, fast-xml-parser returns a single
  // top-level key whose name is the root element's tag.  If there's more than
  // one (extremely rare and invalid for well-formed XML), use the first.
  const entries = Object.entries(parsed as Record<string, unknown>).filter(
    ([k]) => !k.startsWith("?"),
  );
  if (entries.length === 0) {
    diagnostics.error("parse.xml_error", "XML produced no element", { src: wholeDoc });
    return { value: null, diagnostics };
  }
  const [rootName, body] = entries[0]!;

  const value = jsToZ(body, wholeDoc, diagnostics);
  if (!value) return { value: null, diagnostics };
  return { value, diagnostics, xmlRoot: rootName };
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
    const keys = Object.keys(value as Record<string, unknown>);
    const hasText = keys.includes(TEXT_KEY);
    const otherKeys = keys.filter((k) => k !== TEXT_KEY);
    if (hasText && otherKeys.length > 0) {
      diag.warn(
        "parse.xml_mixed_content",
        "Element has both attributes / child elements and a text node; serde.zig does not document an xml_text mapping — generated `value` field is a fallback",
        { src },
      );
    }
    for (const key of keys) {
      const raw = (value as Record<string, unknown>)[key];
      const v = jsToZ(raw, src, diag);
      if (!v) continue;
      if (key === TEXT_KEY) {
        // Mixed content fallback: surface the text node as a `value` field.
        // The serde decorator will attach a TODO comment.
        fields.set("value", { key: "value", keySrc: src, value: v, xml: { kind: "text" } });
      } else if (key.startsWith(ATTR_PREFIX)) {
        const stripped = key.slice(ATTR_PREFIX.length);
        fields.set(stripped, {
          key: stripped,
          keySrc: src,
          value: v,
          xml: { kind: "attribute" },
        });
      } else {
        fields.set(key, { key, keySrc: src, value: v });
      }
    }
    return { kind: "object", fields, src };
  }

  diag.warn(
    "parse.xml_unknown",
    `Unsupported XML value of type ${typeof value}`,
    { src },
  );
  return null;
}
