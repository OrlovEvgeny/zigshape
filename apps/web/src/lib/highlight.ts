// One syntax palette for every editor (JSON, YAML, XML, TOML input and the
// Zig output).  Colours are CSS variables from app.css, so the same style
// follows the light/dark theme without reconfiguring CodeMirror.

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const codeHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.modifier, t.operatorKeyword], color: "var(--syn-keyword)" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--syn-type)" },
  { tag: [t.string, t.special(t.string), t.character, t.attributeValue], color: "var(--syn-string)" },
  { tag: [t.number, t.integer, t.float], color: "var(--syn-number)" },
  { tag: [t.atom, t.bool, t.null], color: "var(--syn-atom)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment, t.meta, t.processingInstruction], color: "var(--syn-comment)" },
  { tag: t.macroName, color: "var(--syn-builtin)" },
  { tag: [t.propertyName, t.definition(t.propertyName), t.attributeName], color: "var(--syn-property)" },
  { tag: t.tagName, color: "var(--syn-tag)" },
  { tag: [t.punctuation, t.bracket, t.separator, t.brace, t.angleBracket], color: "var(--syn-punct)" },
  { tag: t.invalid, color: "var(--error)" },
]);

export const codeHighlighting = syntaxHighlighting(codeHighlightStyle);
