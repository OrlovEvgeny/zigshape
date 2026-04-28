/** Tiny shell-aware curl parser for clipboard pastes.  Parses the body
 *  payload (`-d` / `--data` / `--data-raw` / `--data-binary`) and the URL,
 *  then suggests a Zig root name from the URL's last path segment.  Returns
 *  `null` when the input doesn't look like curl, or has no inline body. */

export type CurlExtraction = {
  /** The body payload extracted from `-d` etc.  Used as the new sample. */
  sample: string;
  /** Suggested PascalCase root name derived from the URL path's last
   *  identifier-like segment (singularised), or `null` if we can't infer
   *  one.  Caller decides whether to apply it. */
  rootHint: string | null;
};

const DATA_FLAGS = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode"]);

export function tryParseCurl(input: string): CurlExtraction | null {
  // Strip a leading "$ " shell prompt.  Trim because pasted snippets often
  // carry leading newlines/whitespace.
  const trimmed = input.trim().replace(/^\$\s+/, "");
  if (!/^curl\b/.test(trimmed)) return null;

  const tokens = tokenize(trimmed);
  if (tokens.length === 0 || tokens[0] !== "curl") return null;

  let sample: string | null = null;
  let url: string | null = null;
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (DATA_FLAGS.has(t)) {
      const v = tokens[i + 1];
      i++;
      if (v === undefined) continue;
      // `@filename` and `@-` (stdin) aren't real payloads — skip them.
      if (v.startsWith("@")) continue;
      sample = v;
      continue;
    }
    // `--data=...` form — split on the first `=`.
    if (t.startsWith("--data") && t.includes("=")) {
      const eq = t.indexOf("=");
      const flag = t.slice(0, eq);
      if (DATA_FLAGS.has(flag)) {
        const v = t.slice(eq + 1);
        if (!v.startsWith("@")) sample = v;
        continue;
      }
    }
    if (/^https?:\/\//i.test(t) && url === null) {
      url = t;
      continue;
    }
    // Skip flags that take a value we don't care about.  These ones are
    // common in copy-pasted curl: -H, --header, -X, --request, -u, -A,
    // --user-agent, -e, --referer.  Consume their next token.
    if (
      t === "-H" || t === "--header" ||
      t === "-X" || t === "--request" ||
      t === "-u" || t === "--user" ||
      t === "-A" || t === "--user-agent" ||
      t === "-e" || t === "--referer" ||
      t === "-b" || t === "--cookie" ||
      t === "-o" || t === "--output"
    ) {
      i++;
      continue;
    }
  }

  if (sample === null) return null;
  return { sample, rootHint: rootHintFromUrl(url) };
}

function rootHintFromUrl(url: string | null): string | null {
  if (!url) return null;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const segments = path.split("/").filter((s) => s.length > 0);
  // Walk from the end and skip purely-numeric or hex-id segments
  // (e.g. /v1/users/42 → "users").
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!;
    if (/^[0-9]+$/.test(seg)) continue;
    if (/^[0-9a-f]{8,}(-[0-9a-f]+)*$/i.test(seg)) continue;
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(seg)) continue;
    return toPascalSingular(seg);
  }
  return null;
}

function toPascalSingular(s: string): string {
  // kebab/snake → spaces → PascalCase, then drop a trailing s for naive
  // singularisation (matches core's identifier.singularize behaviour for
  // english plurals).
  const parts = s.split(/[-_]/).filter(Boolean);
  let pascal = parts.map((p) => p[0]!.toUpperCase() + p.slice(1).toLowerCase()).join("");
  if (pascal.length > 1 && pascal.endsWith("s") && !pascal.endsWith("ss")) {
    pascal = pascal.slice(0, -1);
  }
  return pascal;
}

/** Shell-style tokenizer.  Handles single / double quotes (no expansion in
 *  singles), `\<newline>` line continuations, and `\<char>` escapes. */
function tokenize(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let started = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === "'" || c === '"') {
      started = true;
      const quote = c;
      i++;
      while (i < s.length && s[i] !== quote) {
        if (quote === '"' && s[i] === "\\" && i + 1 < s.length) {
          cur += s[i + 1];
          i += 2;
          continue;
        }
        cur += s[i];
        i++;
      }
      i++; // skip closing quote (or end of string)
      continue;
    }
    if (c === "\\") {
      if (s[i + 1] === "\n" || s[i + 1] === "\r") {
        // line continuation: skip backslash + newline (and optional \r\n)
        i += 2;
        if (s[i - 1] === "\r" && s[i] === "\n") i++;
        continue;
      }
      if (i + 1 < s.length) {
        cur += s[i + 1];
        i += 2;
        started = true;
        continue;
      }
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      if (started) {
        out.push(cur);
        cur = "";
        started = false;
      }
      i++;
      continue;
    }
    cur += c;
    started = true;
    i++;
  }
  if (started) out.push(cur);
  return out;
}
