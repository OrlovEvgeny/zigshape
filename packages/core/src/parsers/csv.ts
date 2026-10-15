import { DiagnosticBag } from "../diagnostics";
import type { SrcRef, ZField, ZValue } from "../value";
import type { ParseResult } from "./types";

type Cell = { text: string; quoted: boolean; offset: number; length: number };
type Row = { cells: Cell[]; offset: number; length: number };

/** CSV with a header row (RFC 4180 quoting).  The result is an array with
 *  one object per data row; the pipeline then observes every row as its own
 *  sample, like NDJSON, because serde.zig reads CSV into `[]const Row`.
 *
 *  Cells are typed the way serde.zig's CSV reader parses them back: an
 *  unquoted empty cell is null (only an optional field accepts it), quoted
 *  cells stay strings, and an unquoted cell is an integer, float or bool
 *  only when its text parses as one. */
export function parseCsv(input: string, sampleIndex: number): ParseResult {
  const diagnostics = new DiagnosticBag();
  const rows = splitRows(input, sampleIndex, diagnostics);
  if (rows === null) return { value: null, diagnostics };

  const nonEmpty = rows.filter((r) => !(r.cells.length === 1 && r.cells[0]!.text === "" && !r.cells[0]!.quoted));
  if (nonEmpty.length === 0) {
    diagnostics.error("parse.csv_empty", "CSV has no header row", {
      src: { sample: sampleIndex, offset: 0, length: input.length },
    });
    return { value: null, diagnostics };
  }

  const [header, ...data] = nonEmpty;
  const names = header!.cells.map((c) => c.text.trim());
  const seen = new Set<string>();
  names.forEach((name, i) => {
    const cell = header!.cells[i]!;
    const src = { sample: sampleIndex, offset: cell.offset, length: cell.length };
    if (name === "") diagnostics.error("parse.csv_header", `Header column ${i + 1} is empty`, { src });
    else if (seen.has(name)) diagnostics.error("parse.csv_header", `Duplicate header '${name}'`, { src });
    seen.add(name);
  });
  if (diagnostics.hasErrors()) return { value: null, diagnostics };

  if (data.length === 0) {
    diagnostics.warn("parse.csv_no_rows", "CSV has a header but no data rows; every column is typed from nothing", {
      src: { sample: sampleIndex, offset: header!.offset, length: header!.length },
    });
  }

  const items: ZValue[] = [];
  data.forEach((row, r) => {
    const rowSrc: SrcRef = { sample: sampleIndex, offset: row.offset, length: row.length };
    if (row.cells.length < names.length) {
      diagnostics.error(
        "parse.csv_field_count",
        `Row ${r + 2} has ${row.cells.length} fields, the header has ${names.length}; serde.zig rejects short rows by default`,
        { src: rowSrc },
      );
      return;
    }
    if (row.cells.length > names.length) {
      diagnostics.warn(
        "parse.csv_field_count",
        `Row ${r + 2} has ${row.cells.length} fields, the header has ${names.length}; extra cells are ignored`,
        { src: rowSrc },
      );
    }
    const fields = new Map<string, ZField>();
    names.forEach((name, i) => {
      const cell = row.cells[i]!;
      const src: SrcRef = { sample: sampleIndex, offset: cell.offset, length: cell.length };
      fields.set(name, { key: name, keySrc: src, value: csvScalar(cell, src) });
    });
    items.push({ kind: "object", fields, src: rowSrc });
  });

  return {
    value: { kind: "array", items, src: { sample: sampleIndex, offset: 0, length: input.length } },
    diagnostics,
  };
}

function csvScalar(cell: Cell, src: SrcRef): ZValue {
  if (cell.quoted) return { kind: "string", value: cell.text, src };
  const t = cell.text.trim();
  if (t === "") return { kind: "null", src };
  if (/^-?(0|[1-9]\d*)$/.test(t)) return { kind: "int", value: BigInt(t), src };
  if (/^-?(0|[1-9]\d*)(\.\d+([eE][+-]?\d+)?|[eE][+-]?\d+)$/.test(t)) {
    return { kind: "float", value: Number(t), src };
  }
  const lower = t.toLowerCase();
  if (lower === "true" || lower === "false") return { kind: "bool", value: lower === "true", src };
  return { kind: "string", value: cell.text, src };
}

/** Split into rows of cells, tracking offsets.  Quoted cells may contain
 *  commas, newlines and doubled quotes. */
function splitRows(input: string, sample: number, diag: DiagnosticBag): Row[] | null {
  const rows: Row[] = [];
  let cells: Cell[] = [];
  let rowStart = 0;
  let i = input.charCodeAt(0) === 0xfeff ? 1 : 0;
  rowStart = i;

  const endRow = (end: number) => {
    rows.push({ cells, offset: rowStart, length: end - rowStart });
    cells = [];
  };

  while (i <= input.length) {
    const start = i;
    if (input[i] === '"') {
      let text = "";
      i++;
      for (;;) {
        if (i >= input.length) {
          diag.error("parse.csv_quote", "Unterminated quoted field", {
            src: { sample, offset: start, length: input.length - start },
          });
          return null;
        }
        if (input[i] === '"') {
          if (input[i + 1] === '"') {
            text += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        text += input[i];
        i++;
      }
      cells.push({ text, quoted: true, offset: start, length: i - start });
    } else {
      while (i < input.length && input[i] !== "," && input[i] !== "\n" && input[i] !== "\r") i++;
      cells.push({ text: input.slice(start, i), quoted: false, offset: start, length: i - start });
    }

    if (i >= input.length) {
      endRow(i);
      break;
    }
    if (input[i] === ",") {
      i++;
      continue;
    }
    if (input[i] === "\r" || input[i] === "\n") {
      const end = i;
      if (input[i] === "\r" && input[i + 1] === "\n") i++;
      i++;
      endRow(end);
      rowStart = i;
      if (i >= input.length) break;
      continue;
    }
    // Text after a closing quote, e.g. "a"b — keep it and move on.
    diag.warn("parse.csv_quote", "Unexpected characters after a closing quote", {
      src: { sample, offset: i, length: 1 },
    });
    while (i < input.length && input[i] !== "," && input[i] !== "\n" && input[i] !== "\r") i++;
  }
  return rows;
}
