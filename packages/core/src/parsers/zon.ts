import { DiagnosticBag } from "../diagnostics";
import type { SrcRef, ZField, ZValue } from "../value";
import type { ParseResult } from "./types";

class ZonError extends Error {
  constructor(message: string, readonly offset: number) {
    super(message);
  }
}

/** ZON (Zig Object Notation), e.g. build.zig.zon.  `.{ .a = 1 }` is a
 *  struct, `.{ 1, 2 }` a tuple (read as an array), `.name` an enum literal.
 *  Every value keeps its source range so the inspector can jump to it. */
export function parseZon(input: string, sampleIndex: number): ParseResult {
  const diagnostics = new DiagnosticBag();
  const p = new Parser(input, sampleIndex);
  try {
    p.skipTrivia();
    const value = p.value();
    p.skipTrivia();
    if (!p.eof()) throw new ZonError("Unexpected content after the top-level value", p.pos);
    const unsupported = [
      p.sawComment && "comments",
      p.sawNonDecimal && "hex/octal/binary integers",
      p.sawMultiline && "\\\\ multiline strings",
    ].filter(Boolean);
    if (unsupported.length > 0) {
      diagnostics.warn(
        "parse.zon_serde_compat",
        `This ZON uses ${unsupported.join(", ")}: valid for std.zon.parse, but serde.zig 1.2.3's ZON reader rejects them`,
        { src: { sample: sampleIndex, offset: 0, length: input.length } },
      );
    }
    if (p.emptyStructs > 0) {
      diagnostics.push({
        severity: "info",
        code: "parse.zon_empty_struct",
        message: "Empty .{} literals are read as structs with no fields; override the type if one is a list",
        src: { sample: sampleIndex, offset: 0, length: input.length },
      });
    }
    return { value, diagnostics };
  } catch (e) {
    if (!(e instanceof ZonError)) throw e;
    const { line, col } = lineCol(input, e.offset);
    diagnostics.error("parse.zon_error", `${e.message} (line ${line}, col ${col})`, {
      src: { sample: sampleIndex, offset: e.offset, length: 1 },
    });
    return { value: null, diagnostics };
  }
}

class Parser {
  pos = 0;
  emptyStructs = 0;
  sawComment = false;
  sawNonDecimal = false;
  sawMultiline = false;

  constructor(
    readonly src: string,
    readonly sample: number,
  ) {
    if (src.charCodeAt(0) === 0xfeff) this.pos = 1;
  }

  eof(): boolean {
    return this.pos >= this.src.length;
  }

  ref(start: number): SrcRef {
    return { sample: this.sample, offset: start, length: this.pos - start };
  }

  skipTrivia(): void {
    for (;;) {
      while (!this.eof() && /\s/.test(this.src[this.pos]!)) this.pos++;
      if (this.src.startsWith("//", this.pos)) {
        this.sawComment = true;
        while (!this.eof() && this.src[this.pos] !== "\n") this.pos++;
        continue;
      }
      return;
    }
  }

  value(): ZValue {
    const start = this.pos;
    const c = this.src[this.pos];
    if (c === undefined) throw new ZonError("Expected a value", this.pos);
    if (this.src.startsWith(".{", this.pos)) return this.container();
    if (c === ".") {
      this.pos++;
      const name = this.identifier();
      return { kind: "string", value: name, src: this.ref(start), enumLiteral: true };
    }
    if (c === '"') return { kind: "string", value: this.string(), src: this.ref(start) };
    if (this.src.startsWith("\\\\", this.pos)) return { kind: "string", value: this.multiline(), src: this.ref(start) };
    if (c === "'") return { kind: "int", value: BigInt(this.char()), src: this.ref(start) };
    if (c === "-" || /[0-9]/.test(c)) return this.number();
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.src.slice(this.pos))?.[0];
    if (word === "true" || word === "false") {
      this.pos += word.length;
      return { kind: "bool", value: word === "true", src: this.ref(start) };
    }
    if (word === "null") {
      this.pos += 4;
      return { kind: "null", src: this.ref(start) };
    }
    if (word === "inf" || word === "nan") {
      this.pos += 3;
      return { kind: "float", value: word === "inf" ? Infinity : NaN, src: this.ref(start) };
    }
    throw new ZonError(`Unexpected '${c}'`, this.pos);
  }

  container(): ZValue {
    const start = this.pos;
    this.pos += 2; // .{
    this.skipTrivia();
    if (this.src[this.pos] === "}") {
      this.pos++;
      this.emptyStructs++;
      return { kind: "object", fields: new Map(), src: this.ref(start) };
    }
    // `.name =` starts a struct; anything else is a tuple.
    const isStruct = /^\.\s*(@"(?:\\.|[^"\\])*"|[A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.test(this.src.slice(this.pos));
    if (isStruct) {
      const fields = new Map<string, ZField>();
      for (;;) {
        this.skipTrivia();
        if (this.src[this.pos] === "}") break;
        const keyStart = this.pos;
        if (this.src[this.pos] !== ".") throw new ZonError("Expected .field_name", this.pos);
        this.pos++;
        const key = this.identifier();
        const keySrc = this.ref(keyStart);
        this.skipTrivia();
        if (this.src[this.pos] !== "=") throw new ZonError("Expected '=' after field name", this.pos);
        this.pos++;
        this.skipTrivia();
        const value = this.value();
        if (fields.has(key)) throw new ZonError(`Duplicate field '${key}'`, keyStart);
        fields.set(key, { key, keySrc, value });
        this.skipTrivia();
        if (this.src[this.pos] === ",") {
          this.pos++;
          continue;
        }
        if (this.src[this.pos] === "}") break;
        throw new ZonError("Expected ',' or '}'", this.pos);
      }
      this.pos++;
      return { kind: "object", fields, src: this.ref(start) };
    }
    const items: ZValue[] = [];
    for (;;) {
      this.skipTrivia();
      if (this.src[this.pos] === "}") break;
      items.push(this.value());
      this.skipTrivia();
      if (this.src[this.pos] === ",") {
        this.pos++;
        continue;
      }
      if (this.src[this.pos] === "}") break;
      throw new ZonError("Expected ',' or '}'", this.pos);
    }
    this.pos++;
    return { kind: "array", items, src: this.ref(start) };
  }

  identifier(): string {
    if (this.src.startsWith('@"', this.pos)) {
      this.pos++;
      return this.string();
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.src.slice(this.pos));
    if (!m) throw new ZonError("Expected an identifier", this.pos);
    this.pos += m[0].length;
    return m[0];
  }

  string(): string {
    this.pos++; // opening quote
    let out = "";
    for (;;) {
      const c = this.src[this.pos];
      if (c === undefined || c === "\n") throw new ZonError("Unterminated string", this.pos);
      if (c === '"') {
        this.pos++;
        return out;
      }
      if (c === "\\") {
        out += this.escape();
        continue;
      }
      out += c;
      this.pos++;
    }
  }

  char(): number {
    this.pos++;
    let cp: number;
    if (this.src[this.pos] === "\\") {
      cp = this.escape().codePointAt(0)!;
    } else {
      cp = this.src.codePointAt(this.pos)!;
      this.pos += cp > 0xffff ? 2 : 1;
    }
    if (this.src[this.pos] !== "'") throw new ZonError("Unterminated character literal", this.pos);
    this.pos++;
    return cp;
  }

  escape(): string {
    const at = this.pos;
    this.pos++; // backslash
    const e = this.src[this.pos++];
    switch (e) {
      case "n": return "\n";
      case "r": return "\r";
      case "t": return "\t";
      case "\\": return "\\";
      case "'": return "'";
      case '"': return '"';
      case "x": {
        const hex = this.src.slice(this.pos, this.pos + 2);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new ZonError("Invalid \\x escape", at);
        this.pos += 2;
        return String.fromCharCode(parseInt(hex, 16));
      }
      case "u": {
        const m = /^\{([0-9a-fA-F]{1,6})\}/.exec(this.src.slice(this.pos));
        if (!m) throw new ZonError("Invalid \\u{...} escape", at);
        this.pos += m[0].length;
        return String.fromCodePoint(parseInt(m[1]!, 16));
      }
      default:
        throw new ZonError("Invalid escape sequence", at);
    }
  }

  /** Consecutive `\\` lines form one string joined with newlines. */
  multiline(): string {
    this.sawMultiline = true;
    const lines: string[] = [];
    for (;;) {
      this.pos += 2;
      const end = this.src.indexOf("\n", this.pos);
      const stop = end === -1 ? this.src.length : end;
      lines.push(this.src.slice(this.pos, stop).replace(/\r$/, ""));
      this.pos = stop;
      const next = /^\n[ \t]*\\\\/.exec(this.src.slice(this.pos));
      if (!next) return lines.join("\n");
      this.pos += next[0].length - 2;
    }
  }

  number(): ZValue {
    const start = this.pos;
    const m =
      /^-?(0x[0-9a-fA-F_]+(\.[0-9a-fA-F_]+)?([pP][+-]?[0-9_]+)?|0o[0-7_]+|0b[01_]+|[0-9][0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9_]+)?)/.exec(
        this.src.slice(this.pos),
      );
    if (!m) throw new ZonError("Invalid number", this.pos);
    this.pos += m[0].length;
    const text = m[0].replace(/_/g, "");
    const negative = text.startsWith("-");
    const body = negative ? text.slice(1) : text;
    const isFloat = /^0x/i.test(body) ? /[.pP]/.test(body) : /[.eE]/.test(body);
    if (isFloat) {
      const v = /^0x/i.test(body) ? hexFloat(body) : Number(body);
      return { kind: "float", value: negative ? -v : v, src: this.ref(start) };
    }
    if (/^0[xob]/i.test(body)) this.sawNonDecimal = true;
    const v = BigInt(body.replace(/^0o/i, "0o").replace(/^0b/i, "0b"));
    return { kind: "int", value: negative ? -v : v, src: this.ref(start) };
  }
}

function hexFloat(body: string): number {
  const m = /^0x([0-9a-f]*)(?:\.([0-9a-f]*))?(?:p([+-]?\d+))?$/i.exec(body);
  if (!m) return NaN;
  const int = parseInt(m[1] || "0", 16);
  const frac = m[2] ? parseInt(m[2], 16) / 16 ** m[2].length : 0;
  return (int + frac) * 2 ** Number(m[3] ?? 0);
}

function lineCol(src: string, offset: number): { line: number; col: number } {
  const before = src.slice(0, offset);
  const line = before.split("\n").length;
  return { line, col: offset - before.lastIndexOf("\n") };
}
