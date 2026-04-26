import type { Format } from "./types";

export type DetectResult = {
  format: Format;
  confidence: number; // 0..1
  alternatives: Format[];
};

/** Inspect input and pick the most likely format.  Heuristic-only — for
 *  ambiguous inputs the user should override via CLI `--format` or the web
 *  format dropdown. */
export function detectFormat(input: string): DetectResult {
  const trimmed = stripBom(input).replace(/^\s+/, "");
  if (trimmed.length === 0) {
    return { format: "json", confidence: 0, alternatives: ["yaml", "toml"] };
  }

  const first = trimmed[0]!;

  if (first === "<") {
    // XML element start or `<?xml ...?>` declaration.  No other supported
    // format begins with `<` at the top of the document.
    return { format: "xml", confidence: 0.95, alternatives: [] };
  }
  if (first === "{") {
    // NDJSON: multiple top-level JSON objects, one per non-empty line.  We
    // require at least 2 objects to avoid mistaking single multiline JSON for
    // NDJSON (which itself can fit on multiple lines if pretty-printed).
    if (looksLikeNdjson(trimmed)) {
      return { format: "ndjson", confidence: 0.85, alternatives: ["json"] };
    }
    return { format: "json", confidence: 0.95, alternatives: ["yaml"] };
  }
  if (first === "[") {
    // `[` is ambiguous: JSON array vs TOML table header (`[server]`) vs
    // TOML array-of-tables (`[[users]]`).  Look at the first line.
    const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
    if (/^\[\[?[A-Za-z_][\w.-]*(\.[A-Za-z_][\w.-]*)*\]?\]\s*$/.test(firstLine.trim())) {
      return { format: "toml", confidence: 0.95, alternatives: ["json"] };
    }
    return { format: "json", confidence: 0.9, alternatives: ["toml"] };
  }

  // YAML document marker
  if (/^---(\s|$)/m.test(trimmed.slice(0, 80))) {
    return { format: "yaml", confidence: 0.9, alternatives: ["toml"] };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.trimStart().startsWith("#"));
  if (lines.length === 0) {
    return { format: "json", confidence: 0, alternatives: ["yaml", "toml"] };
  }

  // TOML signals: [section] header, [[array.of.tables]], or `key = value`
  // (with `=` outside any quoted string at top scope).
  let tomlScore = 0;
  let yamlScore = 0;
  for (const line of lines.slice(0, 50)) {
    const l = line.trim();
    if (/^\[\[?[A-Za-z_][\w.-]*(\.[A-Za-z_][\w.-]*)*\]?\]$/.test(l)) tomlScore += 3;
    else if (looksLikeTomlAssignment(l)) tomlScore += 1;
    if (/^[A-Za-z_][\w.-]*\s*:/.test(l) && !/=/.test(l)) yamlScore += 1;
    if (/^-\s/.test(l)) yamlScore += 1; // YAML sequence item
  }

  if (tomlScore >= 3 && tomlScore > yamlScore) {
    return {
      format: "toml",
      confidence: clamp01(tomlScore / (tomlScore + yamlScore + 1)),
      alternatives: yamlScore > 0 ? ["yaml"] : [],
    };
  }
  if (yamlScore >= 1 && yamlScore >= tomlScore) {
    return {
      format: "yaml",
      confidence: clamp01(yamlScore / (yamlScore + tomlScore + 1)),
      alternatives: tomlScore > 0 ? ["toml"] : [],
    };
  }

  // Fallback: low-confidence JSON (will fail clearly if the user pasted noise).
  return { format: "json", confidence: 0.2, alternatives: ["yaml", "toml"] };
}

function looksLikeNdjson(input: string): boolean {
  // Cheap pass: count lines that start with `{` and end (after trim) with `}`.
  // Two or more top-level lines matching this pattern strongly imply NDJSON.
  // We don't try to fully parse — that's the parser's job — but we want to
  // distinguish `{...}\n{...}\n` (NDJSON) from `{\n  "k": 1\n}` (regular JSON).
  let hits = 0;
  for (const raw of input.split(/\r?\n/)) {
    const t = raw.trim();
    if (t.length === 0) continue;
    if (t.startsWith("{") && t.endsWith("}")) hits += 1;
    else return false;
    if (hits >= 2) return true;
  }
  return false;
}

function looksLikeTomlAssignment(line: string): boolean {
  // very rough: LHS is identifier or quoted, then `=`, then anything.
  return /^([A-Za-z_][\w-]*|"[^"]*"|'[^']*')\s*=\s*\S/.test(line);
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
