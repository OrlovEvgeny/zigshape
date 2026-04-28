// Minimal Zig syntax highlighter for CodeMirror 6 via StreamLanguage.
// Tokenises just enough to keep the generated output readable: keywords,
// builtin scalar types, @builtins, strings (regular + multi-line), char
// literals, numbers (hex/oct/bin/dec/float), comments (line + ///doc), and
// PascalCase type references. No semantic analysis — pure regex stream.

import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type StringStream,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const KEYWORDS = new Set([
  "addrspace", "align", "allowzero", "and", "anyframe", "anytype", "asm",
  "async", "await", "break", "callconv", "catch", "comptime", "const",
  "continue", "defer", "else", "enum", "errdefer", "error", "export",
  "extern", "fn", "for", "if", "inline", "linksection", "noalias",
  "noinline", "nosuspend", "opaque", "or", "orelse", "packed", "pub",
  "resume", "return", "struct", "suspend", "switch", "test", "threadlocal",
  "try", "union", "unreachable", "usingnamespace", "var", "volatile",
  "while",
]);

const BUILTIN_TYPES = new Set([
  "bool", "void", "noreturn", "type", "anyerror", "anyopaque",
  "comptime_int", "comptime_float",
  "u0", "u1", "u8", "u16", "u32", "u64", "u128", "usize",
  "i8", "i16", "i32", "i64", "i128", "isize",
  "f16", "f32", "f64", "f80", "f128",
  "c_char", "c_short", "c_int", "c_long", "c_longlong", "c_longdouble",
  "c_ushort", "c_uint", "c_ulong", "c_ulonglong",
]);

const ATOMS = new Set(["true", "false", "null", "undefined"]);

type ZigState = {
  // Inside a `\\` raw multiline string segment that already started; only
  // ends at end of line.  StreamLanguage processes one line at a time, so
  // we don't actually persist this — it's recomputed per line.
  // (Reserved for future stateful needs.)
};

export const zigLanguage = StreamLanguage.define<ZigState>({
  name: "zig",
  startState: () => ({}),
  token(stream: StringStream): string | null {
    // Skip whitespace. Tokens never span lines (raw strings restart per
    // line), so we don't carry doc-level state.
    if (stream.eatSpace()) return null;

    // ///doc, //!module-doc, // line comment
    if (stream.match(/^\/\/[!/].*/)) return "docComment";
    if (stream.match(/^\/\/.*/)) return "comment";

    // Multi-line raw string: \\...rest of line
    if (stream.match(/^\\\\.*/)) return "string";

    // String literal "..." with simple \" escape handling
    if (stream.match(/^"(?:\\.|[^"\\])*"/)) return "string";
    if (stream.match(/^"(?:\\.|[^"\\])*$/)) return "string"; // unterminated → still highlight

    // Char literal '...'
    if (stream.match(/^'(?:\\.|[^'\\])'/)) return "character";

    // @builtin or @"escaped ident"
    if (stream.match(/^@"(?:\\.|[^"\\])*"/)) return "variableName";
    if (stream.match(/^@[A-Za-z_][A-Za-z0-9_]*/)) return "macroName";

    // Numbers: hex / oct / bin / decimal (with optional float exponent)
    if (stream.match(/^0x[0-9a-fA-F_]+(?:\.[0-9a-fA-F_]+)?(?:[pP][+-]?[0-9_]+)?/)) return "number";
    if (stream.match(/^0o[0-7_]+/)) return "number";
    if (stream.match(/^0b[01_]+/)) return "number";
    if (stream.match(/^[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?/)) return "number";

    // Identifier
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current();
      if (KEYWORDS.has(word)) return "keyword";
      if (ATOMS.has(word)) return "atom";
      if (BUILTIN_TYPES.has(word)) return "typeName";
      // PascalCase → type reference; everything else is a plain ident.
      if (/^[A-Z][A-Za-z0-9_]*$/.test(word)) return "typeName";
      return "variableName";
    }

    // Operators / punctuation: consume one char so the stream advances.
    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: "//" },
    closeBrackets: { brackets: ["(", "[", "{", "'", '"'] },
    indentOnInput: /^\s*[}\]]$/,
  },
});

// Dark-friendly palette tuned for the readonly output editor
// (background #1e1e1e). Avoids purple keywords and red strings; greens,
// oranges, cyan, and yellow read well over the dark background.
const zigHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#ff9b50" },
  { tag: t.controlKeyword, color: "#ff9b50" },
  { tag: t.atom, color: "#61afef" },
  { tag: t.bool, color: "#61afef" },
  { tag: t.null, color: "#61afef" },
  { tag: t.number, color: "#d19a66" },
  { tag: t.string, color: "#98c379" },
  { tag: t.character, color: "#98c379" },
  { tag: t.comment, color: "#7a8694", fontStyle: "italic" },
  { tag: t.docComment, color: "#7a8694", fontStyle: "italic" },
  { tag: t.typeName, color: "#56b6c2" },
  { tag: t.macroName, color: "#e5c07b" },
  { tag: t.variableName, color: "#d4d4d4" },
]);

export function zig() {
  return [zigLanguage, syntaxHighlighting(zigHighlightStyle)];
}
