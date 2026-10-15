import { parseTree, printParseErrorCode, type Node, type ParseError } from "jsonc-parser";
import type { SrcRef, ZField, ZValue } from "../value";
import { DiagnosticBag } from "../diagnostics";
import type { ParseResult } from "./types";

export function parseJson(input: string, sampleIndex: number): ParseResult {
  const diagnostics = new DiagnosticBag();
  const errors: ParseError[] = [];
  const tree = parseTree(input, errors, {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: false,
  });

  for (const e of errors) {
    const code = printParseErrorCode(e.error);
    diagnostics.error("parse." + code, describeParseError(code), {
      src: { sample: sampleIndex, offset: e.offset, length: e.length },
    });
  }

  if (!tree) return { value: null, diagnostics };

  const value = nodeToZValue(tree, input, sampleIndex, diagnostics);
  return { value, diagnostics };
}

// jsonc-parser reports bare enum names (`CloseBraceExpected`); turn them
// into a sentence a person can act on.
function describeParseError(code: string): string {
  switch (code) {
    case "CloseBraceExpected": return "Expected '}'";
    case "CloseBracketExpected": return "Expected ']'";
    case "ColonExpected": return "Expected ':' after property name";
    case "CommaExpected": return "Expected ','";
    case "PropertyNameExpected": return "Expected a property name";
    case "ValueExpected": return "Expected a value";
    case "EndOfFileExpected": return "Unexpected content after the end of the document";
    case "InvalidSymbol": return "Invalid symbol";
    case "InvalidNumberFormat": return "Invalid number";
    case "UnexpectedEndOfString": return "Unterminated string";
    case "UnexpectedEndOfComment": return "Unterminated comment";
    case "UnexpectedEndOfNumber": return "Unterminated number";
    case "InvalidUnicode": return "Invalid unicode escape";
    case "InvalidEscapeCharacter": return "Invalid escape character";
    case "InvalidCharacter": return "Invalid character";
    case "InvalidCommentToken": return "Invalid comment";
    default: return code;
  }
}

function nodeToZValue(node: Node, input: string, sample: number, diag: DiagnosticBag): ZValue | null {
  const src: SrcRef = { sample, offset: node.offset, length: node.length };

  switch (node.type) {
    case "null":
      return { kind: "null", src };
    case "boolean":
      return { kind: "bool", value: node.value as boolean, src };
    case "string":
      return { kind: "string", value: node.value as string, src };
    case "number": {
      const text = input.slice(node.offset, node.offset + node.length);
      if (isIntegerLiteral(text)) {
        try {
          return { kind: "int", value: BigInt(text), src };
        } catch {
          // fall through to float
        }
      }
      return { kind: "float", value: node.value as number, src };
    }
    case "array": {
      const items: ZValue[] = [];
      for (const child of node.children ?? []) {
        const v = nodeToZValue(child, input, sample, diag);
        if (v) items.push(v);
      }
      return { kind: "array", items, src };
    }
    case "object": {
      const fields = new Map<string, ZField>();
      for (const prop of node.children ?? []) {
        if (prop.type !== "property") continue;
        const [keyNode, valueNode] = prop.children ?? [];
        if (!keyNode || keyNode.type !== "string" || !valueNode) continue;
        const key = keyNode.value as string;
        const keySrc: SrcRef = { sample, offset: keyNode.offset, length: keyNode.length };
        const value = nodeToZValue(valueNode, input, sample, diag);
        if (!value) continue;
        if (fields.has(key)) {
          diag.warn("parse.duplicate_key", `Duplicate object key "${key}" — first occurrence kept`, {
            src: keySrc,
          });
          continue;
        }
        fields.set(key, { key, keySrc, value });
      }
      return { kind: "object", fields, src };
    }
    default:
      return null;
  }
}

function isIntegerLiteral(text: string): boolean {
  return /^-?\d+$/.test(text);
}
