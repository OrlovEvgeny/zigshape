import { ZIG_KEYWORDS } from "./keywords";

const PLAIN_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type SanitizedIdentifier = {
  /** The text to write in Zig source (may include `@"…"` escaping). */
  text: string;
  /** True iff the identifier is escaped via `@"…"`. */
  escaped: boolean;
  /** True iff the resulting identifier differs from the input key. */
  changed: boolean;
};

export function toSnakeCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toLowerCase()
    .replace(/^_+|_+$/g, "");
}

export function toPascalCase(input: string): string {
  const snake = toSnakeCase(input);
  if (!snake) return "";
  return snake
    .split("_")
    .filter((p) => p.length > 0)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join("");
}

/** Sanitize a JSON object key into a valid Zig field identifier. */
export function sanitizeFieldName(key: string): SanitizedIdentifier {
  const snake = toSnakeCase(key);
  if (snake && PLAIN_IDENT_RE.test(snake)) {
    if (ZIG_KEYWORDS.has(snake)) {
      return { text: snake + "_", escaped: false, changed: true };
    }
    return { text: snake, escaped: false, changed: snake !== key };
  }
  return { text: `@"${escapeZigString(key)}"`, escaped: true, changed: true };
}

/** Sanitize into a struct/type name (PascalCase). */
export function sanitizeStructName(input: string): string {
  const pascal = toPascalCase(input);
  if (pascal && PLAIN_IDENT_RE.test(pascal) && !ZIG_KEYWORDS.has(pascal)) {
    return pascal;
  }
  if (pascal && PLAIN_IDENT_RE.test(pascal)) return pascal + "_";
  return "Auto";
}

/** Drop a trailing 's' for naming a struct from a plural field name. */
export function singularize(name: string): string {
  if (name.length > 3 && /ies$/i.test(name)) return name.slice(0, -3) + "y";
  if (name.length > 2 && /[^s]s$/i.test(name) && !/us$/i.test(name)) {
    return name.slice(0, -1);
  }
  return name;
}

export function escapeZigString(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) {
      out += "\\x" + code.toString(16).padStart(2, "0");
    } else {
      out += ch;
    }
  }
  return out;
}
