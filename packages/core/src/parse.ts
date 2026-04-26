import { parseTree, printParseErrorCode, type Node, type ParseError } from "jsonc-parser";
import type { SrcRef, ZField, ZValue } from "./value";
import { DiagnosticBag } from "./diagnostics";

export type ParseResult = {
  value: ZValue | null;
  diagnostics: DiagnosticBag;
};

export function parseSample(input: string, sampleIndex: number): ParseResult {
  const diagnostics = new DiagnosticBag();
  const errors: ParseError[] = [];
  const tree = parseTree(input, errors, {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: false,
  });

  for (const e of errors) {
    diagnostics.error("parse." + printParseErrorCode(e.error), printParseErrorCode(e.error), {
      src: { sample: sampleIndex, offset: e.offset, length: e.length },
    });
  }

  if (!tree) return { value: null, diagnostics };

  const value = nodeToZValue(tree, input, sampleIndex, diagnostics);
  return { value, diagnostics };
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
      // "property" never reaches here at top level; fall through.
      return null;
  }
}

function isIntegerLiteral(text: string): boolean {
  return /^-?\d+$/.test(text);
}
