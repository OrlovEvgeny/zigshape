import type { SrcRef } from "./value";

export type Severity = "error" | "warning" | "info";

export type Diagnostic = {
  severity: Severity;
  code: string;
  message: string;
  src?: SrcRef;
  path?: string;
};

export class DiagnosticBag {
  private items: Diagnostic[] = [];

  push(d: Diagnostic): void {
    this.items.push(d);
  }

  warn(code: string, message: string, opts: { src?: SrcRef; path?: string } = {}): void {
    this.items.push({ severity: "warning", code, message, ...opts });
  }

  error(code: string, message: string, opts: { src?: SrcRef; path?: string } = {}): void {
    this.items.push({ severity: "error", code, message, ...opts });
  }

  hasErrors(): boolean {
    return this.items.some((d) => d.severity === "error");
  }

  toArray(): Diagnostic[] {
    return [...this.items];
  }
}
