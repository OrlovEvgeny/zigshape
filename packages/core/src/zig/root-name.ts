import { sanitizeStructName, singularize } from "./identifier";
import type { ZValue } from "../value";

/** Heuristics for picking a root struct name from a parsed sample so users
 *  don't have to invent one.  Returns null when no signal is strong enough
 *  — the caller should fall back to its existing default ("Root", an
 *  example's hard-coded name, etc).
 *
 *  Strategy, first match wins:
 *    1. XML root element wins (passed by the parser, namespace already
 *       stripped).
 *    2. Single-key wrapper objects: `{ "user": {...} }` → `User`.  Common
 *       in REST envelopes.  Inner value must be an object or array.
 *    3. Top-level discriminator field: `{ "kind": "Invoice", ... }` →
 *       `Invoice`.  Recognised keys: `__typename`, `_type`, `type`,
 *       `kind` (in priority order).  Value must be a non-empty string.
 *    4. Array of objects at the root: pluralised → singularised.  Only
 *       when (1)–(3) didn't fire and the user opted into samples-from-
 *       array — otherwise we can't tell whether to use the array's
 *       *element* shape or wrap the array.
 *
 *  The return value goes through `sanitizeStructName` so it's always a
 *  legal Zig identifier (PascalCase, no keyword collision). */
export function suggestRootName(
  root: ZValue,
  opts: { xmlRoot?: string; treatRootArrayAsSamples?: boolean } = {},
): string | null {
  if (opts.xmlRoot) {
    const name = sanitizeStructName(opts.xmlRoot);
    if (name && name !== "Auto") return name;
  }

  if (root.kind !== "object" && root.kind !== "array") return null;

  if (root.kind === "object") {
    // Single-key wrapper.
    if (root.fields.size === 1) {
      const [key, field] = [...root.fields.entries()][0]!;
      if (field.value.kind === "object" || field.value.kind === "array") {
        const name = sanitizeStructName(
          field.value.kind === "array" ? singularize(key) : key,
        );
        if (name && name !== "Auto") return name;
      }
    }

    // Discriminator field.
    const DISCRIMINATORS = ["__typename", "_type", "type", "kind"] as const;
    for (const d of DISCRIMINATORS) {
      const f = root.fields.get(d);
      if (!f || f.value.kind !== "string") continue;
      const v = f.value.value.trim();
      if (v.length === 0) continue;
      const name = sanitizeStructName(v);
      if (name && name !== "Auto") return name;
    }

    return null;
  }

  // Top-level array.  Only volunteer a name when the user already opted in
  // to treating items as samples (samplesFromArray / NDJSON) — otherwise we
  // can't tell whether they want the array element type or the array itself
  // as the root.
  if (opts.treatRootArrayAsSamples && root.items.length > 0) {
    // Without context, we have nothing to base the name on.  Return null;
    // the caller's default ("Root") is fine for "list of T" shapes.
    return null;
  }

  return null;
}
