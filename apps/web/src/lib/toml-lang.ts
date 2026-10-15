// Minimal TOML highlighter for CodeMirror 6 via StreamLanguage, in the same
// spirit as zig-lang.ts: table headers, keys, strings (basic, literal and
// both multi-line forms), numbers and dates, booleans, comments.  Colours
// come from the shared palette in highlight.ts.

import { StreamLanguage, type StringStream } from "@codemirror/language";

type TomlState = {
  /** Open multi-line string delimiter carried across lines. */
  multi: '"""' | "'''" | null;
  /** True where a key is expected (line start, after `{` or `,` in an
   *  inline table); false once `=` has been seen. */
  expectKey: boolean;
  /** Open `[` and `{` inside a value, innermost last.  Multi-line arrays
   *  must not read their items as keys; a `,` starts a new key only when
   *  the innermost open bracket is an inline table. */
  nest: string;
};

function readMulti(stream: StringStream, state: TomlState): string {
  const delim = state.multi!;
  while (!stream.eol()) {
    if (delim === '"""' && stream.match("\\", true)) {
      stream.next();
      continue;
    }
    if (stream.match(delim)) {
      // `""""` closes with one quote of content; eat any extra quotes.
      while (stream.peek() === delim[0]) stream.next();
      state.multi = null;
      return "string";
    }
    stream.next();
  }
  return "string";
}

export const tomlLanguage = StreamLanguage.define<TomlState>({
  name: "toml",
  startState: () => ({ multi: null, expectKey: true, nest: "" }),
  copyState: (s) => ({ ...s }),
  token(stream, state) {
    if (state.multi) return readMulti(stream, state);

    if (stream.sol() && state.nest === "") {
      state.expectKey = true;
    }
    if (stream.eatSpace()) return null;

    if (stream.match(/^#.*/)) return "comment";

    // [table] / [[array.of.tables]] at the start of a line.
    if (state.expectKey && state.nest === "" && stream.match(/^\[\[?[^\]\n]*\]\]?/)) {
      return "typeName";
    }

    if (stream.match('"""')) {
      state.multi = '"""';
      return readMulti(stream, state);
    }
    if (stream.match("'''")) {
      state.multi = "'''";
      return readMulti(stream, state);
    }

    if (state.expectKey) {
      if (stream.match(/^"(?:\\.|[^"\\])*"/) || stream.match(/^'[^']*'/) || stream.match(/^[A-Za-z0-9_-]+/)) {
        return "propertyName";
      }
      if (stream.eat(".")) return "punctuation";
    }

    if (stream.eat("=")) {
      state.expectKey = false;
      return "operator";
    }

    if (stream.match(/^"(?:\\.|[^"\\])*"?/)) return "string";
    if (stream.match(/^'[^']*'?/)) return "string";

    // Offset date-times, local dates and times before plain numbers.
    if (stream.match(/^\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:\d{2})?)?/)) return "number";
    if (stream.match(/^\d{2}:\d{2}:\d{2}(?:\.\d+)?/)) return "number";
    if (stream.match(/^[+-]?0x[0-9A-Fa-f_]+/) || stream.match(/^[+-]?0o[0-7_]+/) || stream.match(/^[+-]?0b[01_]+/)) return "number";
    if (stream.match(/^[+-]?(?:inf|nan)\b/)) return "number";
    if (stream.match(/^[+-]?\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?/)) return "number";
    if (stream.match(/^(?:true|false)\b/)) return "bool";

    const ch = stream.next();
    if (ch === "[" || ch === "{") {
      state.nest += ch;
      if (ch === "{") state.expectKey = true;
      return ch === "[" ? "bracket" : "brace";
    }
    if (ch === "]" || ch === "}") {
      state.nest = state.nest.slice(0, -1);
      return ch === "]" ? "bracket" : "brace";
    }
    if (ch === ",") {
      if (state.nest.endsWith("{")) state.expectKey = true;
      return "separator";
    }
    return null;
  },
  languageData: {
    commentTokens: { line: "#" },
  },
});

export function toml() {
  return tomlLanguage;
}
