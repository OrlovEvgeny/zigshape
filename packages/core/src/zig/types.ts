export type ZigType =
  | { kind: "bool" }
  | { kind: "u64" }
  | { kind: "i64" }
  | { kind: "f64" }
  | { kind: "string" }
  | { kind: "slice"; element: ZigType }
  | { kind: "ref"; structName: string }
  | { kind: "stringMap"; value: ZigType }
  | { kind: "json" }
  | { kind: "optional"; inner: ZigType };

export function renderZigType(t: ZigType): string {
  switch (t.kind) {
    case "bool":
      return "bool";
    case "u64":
      return "u64";
    case "i64":
      return "i64";
    case "f64":
      return "f64";
    case "string":
      return "[]const u8";
    case "slice":
      return "[]const " + renderZigType(t.element);
    case "ref":
      return t.structName;
    case "stringMap":
      return "std.StringHashMap(" + renderZigType(t.value) + ")";
    case "json":
      return "std.json.Value";
    case "optional":
      return "?" + renderZigType(t.inner);
  }
}
