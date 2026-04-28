export type ZigIntWidth =
  | "u8"
  | "u16"
  | "u32"
  | "u64"
  | "usize"
  | "i8"
  | "i16"
  | "i32"
  | "i64"
  | "isize";
export type ZigStringRepr = "slice" | "mut" | "sentinel";

export type ZigType =
  | { kind: "bool" }
  | { kind: "int"; width: ZigIntWidth }
  | { kind: "f64" }
  | { kind: "string"; repr?: ZigStringRepr }
  | { kind: "slice"; element: ZigType }
  | { kind: "arraylist"; element: ZigType }
  | { kind: "fixedArray"; length: number; element: ZigType }
  | { kind: "ref"; structName: string }
  | { kind: "stringMap"; value: ZigType }
  | { kind: "json" }
  /** `serde.Value` from serde.zig — needs the serde module imported. */
  | { kind: "serdeValue" }
  /** `@compileError("...")` placeholder — file refuses to compile until the
   *  user replaces the type. */
  | { kind: "compileError"; message: string }
  | { kind: "optional"; inner: ZigType }
  /** User-provided Zig type expression — bypasses the inference-driven
   *  rendering.  Set by the override mechanism (CLI --config or web inspector
   *  field editor); never produced by normal inference. */
  | { kind: "raw"; text: string };

export function renderZigType(t: ZigType): string {
  switch (t.kind) {
    case "bool":
      return "bool";
    case "int":
      return t.width;
    case "f64":
      return "f64";
    case "string":
      switch (t.repr ?? "slice") {
        case "mut":
          return "[]u8";
        case "sentinel":
          return "[:0]const u8";
        default:
          return "[]const u8";
      }
    case "slice":
      return "[]const " + renderZigType(t.element);
    case "arraylist":
      return "std.ArrayList(" + renderZigType(t.element) + ")";
    case "fixedArray":
      return "[" + t.length + "]" + renderZigType(t.element);
    case "ref":
      return t.structName;
    case "stringMap":
      return "std.StringHashMap(" + renderZigType(t.value) + ")";
    case "json":
      return "std.json.Value";
    case "serdeValue":
      return "serde.Value";
    case "compileError":
      return `@compileError(${JSON.stringify(t.message)})`;
    case "optional":
      return "?" + renderZigType(t.inner);
    case "raw":
      return t.text;
  }
}

export function pickIntWidth(
  min: bigint,
  max: bigint,
  strategy: "smallest" | "u64" | "i64" | "usize",
): ZigIntWidth {
  if (strategy === "i64") return "i64";
  if (strategy === "u64") return min < 0n ? "i64" : "u64";
  // usize/isize is the platform-pointer-width strategy: pick isize if any
  // observation was negative, usize otherwise.  Useful for index/length
  // fields that round-trip with std.mem APIs.
  if (strategy === "usize") return min < 0n ? "isize" : "usize";
  // smallest
  if (min >= 0n) {
    if (max <= 0xffn) return "u8";
    if (max <= 0xffffn) return "u16";
    if (max <= 0xffff_ffffn) return "u32";
    return "u64";
  }
  if (min >= -0x80n && max <= 0x7fn) return "i8";
  if (min >= -0x8000n && max <= 0x7fffn) return "i16";
  if (min >= -0x8000_0000n && max <= 0x7fff_ffffn) return "i32";
  return "i64";
}
