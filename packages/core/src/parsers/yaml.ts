import {
  isAlias,
  isMap,
  isPair,
  isScalar,
  isSeq,
  parseAllDocuments,
  type Alias,
  type Document,
  type Node,
  type Scalar,
} from "yaml";
import { DiagnosticBag } from "../diagnostics";
import type { SrcRef, ZField, ZValue } from "../value";
import type { ParseResult } from "./types";

export function parseYaml(input: string, sampleIndex: number): ParseResult {
  const diagnostics = new DiagnosticBag();
  const docs = parseAllDocuments(input, { merge: true });

  if (docs.length === 0) {
    diagnostics.error("parse.empty", "no YAML document found");
    return { value: null, diagnostics };
  }

  const doc = docs[0]!;

  if (docs.length > 1) {
    diagnostics.warn(
      "parse.yaml_multi_document",
      `${docs.length} YAML documents found; only the first is used`,
    );
  }

  for (const e of doc.errors) {
    diagnostics.error("parse." + (e.code ?? "yaml_error"), e.message, {
      src: srcOfRange(sampleIndex, e.pos),
    });
  }
  for (const w of doc.warnings) {
    diagnostics.warn("parse." + (w.code ?? "yaml_warning"), w.message);
  }

  if (doc.errors.length > 0 || doc.contents === null) {
    return { value: null, diagnostics };
  }

  const value = nodeToZ(doc.contents as Node, input, sampleIndex, doc, diagnostics);
  return { value, diagnostics };
}

function srcOfRange(sample: number, range: readonly number[] | undefined): SrcRef | undefined {
  if (!range) return undefined;
  const start = range[0] ?? 0;
  const end = range[1] ?? start;
  return { sample, offset: start, length: Math.max(0, end - start) };
}

function srcOf(sample: number, node: Node | undefined): SrcRef {
  const start = node?.range?.[0] ?? 0;
  const end = node?.range?.[1] ?? start;
  return { sample, offset: start, length: Math.max(0, end - start) };
}

function nodeToZ(
  node: Node,
  input: string,
  sample: number,
  doc: Document,
  diag: DiagnosticBag,
): ZValue | null {
  if (isAlias(node)) {
    const resolved = (node as Alias).resolve(doc);
    if (!resolved) {
      diag.warn("parse.yaml_unresolved_alias", `Alias *${node.source} could not be resolved`, {
        src: srcOf(sample, node),
      });
      return null;
    }
    // Reuse the alias's location for src so warnings/highlights point to the
    // usage site, not the definition.
    return retagSrc(nodeToZ(resolved as Node, input, sample, doc, diag), srcOf(sample, node));
  }

  if (isScalar(node)) {
    return scalarToZ(node, input, sample, diag);
  }

  if (isSeq(node)) {
    const items: ZValue[] = [];
    for (const item of node.items) {
      const v = nodeToZ(item as Node, input, sample, doc, diag);
      if (v) items.push(v);
    }
    return { kind: "array", items, src: srcOf(sample, node) };
  }

  if (isMap(node)) {
    const fields = new Map<string, ZField>();
    const mergeNodes: Node[] = [];
    // First pass: explicit keys.  Merge sources are deferred so explicit
    // overrides win regardless of textual order.
    for (const pair of node.items) {
      if (!isPair(pair)) continue;
      const keyNode = pair.key as Node | null;
      if (!keyNode || !isScalar(keyNode)) continue;

      // YAML merge keys (`<<: *anchor` or `<<: [*a, *b]`): the yaml library
      // surfaces these as Scalars whose value is Symbol.for('<<').
      if (typeof keyNode.value === "symbol" && keyNode.value.description === "<<") {
        if (pair.value) mergeNodes.push(pair.value as Node);
        continue;
      }

      if (typeof keyNode.value !== "string") {
        diag.warn(
          "parse.yaml_non_string_key",
          "Non-string mapping key skipped — only string keys are supported in v0.2",
          { src: srcOf(sample, keyNode) },
        );
        continue;
      }
      const key = keyNode.value;
      const keySrc = srcOf(sample, keyNode);

      const docComment = extractDocComment(pair, keyNode);

      if (!pair.value) {
        fields.set(key, { key, keySrc, value: { kind: "null", src: keySrc }, docComment });
        continue;
      }
      const value = nodeToZ(pair.value as Node, input, sample, doc, diag);
      if (!value) continue;
      if (fields.has(key)) {
        diag.warn(
          "parse.duplicate_key",
          `Duplicate mapping key "${key}" — first occurrence kept`,
          { src: keySrc },
        );
        continue;
      }
      fields.set(key, { key, keySrc, value, docComment });
    }
    // Second pass: merge sources, only filling keys not already explicit.
    for (const m of mergeNodes) spreadMerge(m, input, sample, doc, diag, fields);
    return { kind: "object", fields, src: srcOf(sample, node) };
  }

  const unsupported = node as { constructor?: { name?: string } } | undefined;
  diag.warn(
    "parse.yaml_unsupported_node",
    `Unsupported YAML node kind: ${unsupported?.constructor?.name ?? "unknown"}`,
    { src: srcOf(sample, node as Node) },
  );
  return null;
}

function scalarToZ(node: Scalar, input: string, sample: number, diag: DiagnosticBag): ZValue {
  const src = srcOf(sample, node);
  const v = node.value;

  if (v === null || v === undefined) return { kind: "null", src };
  if (typeof v === "boolean") return { kind: "bool", value: v, src };
  if (typeof v === "string") return { kind: "string", value: v, src };

  if (typeof v === "bigint") return { kind: "int", value: v, src };

  if (typeof v === "number") {
    const text = node.range ? input.slice(node.range[0], node.range[1]) : "";
    if (isFloatLiteral(text, node.format)) {
      return { kind: "float", value: v, src };
    }
    // try BigInt round-trip via the source text to preserve precision and
    // handle hex / octal / binary YAML literals.
    const bigInt = tryBigInt(text);
    if (bigInt !== null) return { kind: "int", value: bigInt, src };
    if (Number.isInteger(v)) return { kind: "int", value: BigInt(v), src };
    return { kind: "float", value: v, src };
  }

  // Dates / timestamps come through as Date objects from the yaml library.
  if (v instanceof Date) {
    diag.warn(
      "parse.yaml_date",
      "YAML date scalar emitted as []const u8; consider a custom adapter",
      { src },
    );
    return { kind: "string", value: v.toISOString(), src };
  }

  diag.warn(
    "parse.yaml_unknown_scalar",
    `Unsupported YAML scalar value of type ${typeof v}`,
    { src },
  );
  return { kind: "string", value: String(v), src };
}

/** Pull the YAML comment that immediately precedes a mapping pair, if any.
 *  Comments are normalised: leading whitespace and the `#` marker are
 *  stripped per line, multi-line comments are joined with a single space so
 *  the result fits one `///` line in the generated struct. */
function extractDocComment(pair: unknown, keyNode: Node): string | undefined {
  const candidates: Array<string | null | undefined> = [
    (pair as { commentBefore?: string | null }).commentBefore,
    (keyNode as { commentBefore?: string | null }).commentBefore,
  ];
  for (const c of candidates) {
    if (typeof c !== "string" || c.length === 0) continue;
    const cleaned = c
      .split("\n")
      .map((l) => l.replace(/^\s*#?\s?/, "").trimEnd())
      .filter((l) => l.length > 0)
      .join(" ");
    if (cleaned.length > 0) return cleaned;
  }
  return undefined;
}

function isFloatLiteral(text: string, format?: string): boolean {
  if (format === "EXP") return true;
  if (format === "HEX" || format === "OCT" || format === "BIN") return false;
  if (/[.]/.test(text)) return true;
  if (/[eE][+-]?\d/.test(text)) return true;
  if (/^[+-]?\.?(inf|nan)$/i.test(text.trim())) return true;
  return false;
}

function tryBigInt(text: string): bigint | null {
  const t = text.trim().replace(/^['"]|['"]$/g, "");
  // Plain decimal (with optional sign)
  if (/^[+-]?\d+$/.test(t)) {
    try { return BigInt(t.startsWith("+") ? t.slice(1) : t); } catch { return null; }
  }
  // Hex
  if (/^0x[0-9a-f]+$/i.test(t)) {
    try { return BigInt(t); } catch { return null; }
  }
  // Octal: YAML 1.2 uses 0o prefix; 1.1 used leading 0
  if (/^0o[0-7]+$/i.test(t)) {
    try { return BigInt(t); } catch { return null; }
  }
  if (/^0b[01]+$/i.test(t)) {
    try { return BigInt(t); } catch { return null; }
  }
  return null;
}

function retagSrc(value: ZValue | null, src: SrcRef): ZValue | null {
  if (!value) return null;
  return { ...value, src } as ZValue;
}

function spreadMerge(
  source: Node,
  input: string,
  sample: number,
  doc: Document,
  diag: DiagnosticBag,
  into: Map<string, ZField>,
): void {
  // Resolve aliases first.
  let resolved: Node | null = source;
  if (isAlias(source)) {
    resolved = (source as Alias).resolve(doc) as Node | null;
    if (!resolved) {
      diag.warn(
        "parse.yaml_unresolved_alias",
        `Merge alias *${(source as Alias).source} could not be resolved`,
        { src: srcOf(sample, source) },
      );
      return;
    }
  }
  // `<<: [*a, *b]` — spread each in order.
  if (resolved && isSeq(resolved)) {
    for (const item of resolved.items) {
      spreadMerge(item as Node, input, sample, doc, diag, into);
    }
    return;
  }
  if (!resolved || !isMap(resolved)) {
    diag.warn(
      "parse.yaml_merge_target",
      "<< merge target is not a mapping; ignored",
      { src: srcOf(sample, source) },
    );
    return;
  }
  for (const pair of resolved.items) {
    if (!isPair(pair)) continue;
    const k = pair.key as Node | null;
    if (!k || !isScalar(k) || typeof k.value !== "string") continue;
    const key = k.value;
    if (into.has(key)) continue; // explicit key wins over merge
    const keySrc = srcOf(sample, k);
    if (!pair.value) {
      into.set(key, { key, keySrc, value: { kind: "null", src: keySrc } });
      continue;
    }
    const value = nodeToZ(pair.value as Node, input, sample, doc, diag);
    if (value) into.set(key, { key, keySrc, value });
  }
}
