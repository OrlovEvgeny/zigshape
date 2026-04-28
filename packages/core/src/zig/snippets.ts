import type { Format } from "../parsers/types";

export type SnippetTarget = "plain" | "serde-zig";

/** Module name that lives under `serde.<module>` in serde.zig per format. */
const SERDE_MODULE: Record<Format, string> = {
  json: "json",
  ndjson: "json",
  yaml: "yaml",
  toml: "toml",
  xml: "xml",
};

/** A `pub fn parse<Root>(allocator, input) !T { ... }` helper.  For the plain
 *  target the helper wraps `std.json.parseFromSlice` (NDJSON falls back to
 *  JSON because std doesn't ship a stream parser).  YAML/TOML/XML aren't in
 *  std, so the plain target emits a TODO comment instead.  The serde target
 *  always has a matching `serde.<format>.fromSlice`. */
export function emitParserHelper(
  rootName: string,
  target: SnippetTarget,
  format: Format,
): string {
  if (target === "plain") {
    if (format === "json" || format === "ndjson") {
      return [
        "",
        `pub fn parse${rootName}(allocator: std.mem.Allocator, input: []const u8) !std.json.Parsed(${rootName}) {`,
        `    return std.json.parseFromSlice(${rootName}, allocator, input, .{});`,
        "}",
        "",
      ].join("\n");
    }
    return [
      "",
      `// std doesn't ship a ${format.toUpperCase()} parser.  Use the serde-zig`,
      `// target (--target serde-zig --with-parser) or wire your own.`,
      "",
    ].join("\n");
  }
  const mod = SERDE_MODULE[format];
  return [
    "",
    `pub fn parse${rootName}(allocator: std.mem.Allocator, input: []const u8) !${rootName} {`,
    `    return serde.${mod}.fromSlice(${rootName}, allocator, input);`,
    "}",
    "",
  ].join("\n");
}

/** A minimal round-trip test using the first sample as input.  The sample is
 *  embedded inside a Zig multi-line raw string so any quoting in the wire
 *  format is preserved verbatim (no escaping required).  No assertions about
 *  field values — generated tests are scaffolds, not contracts. */
export function emitTestScaffold(
  rootName: string,
  sample: string,
  target: SnippetTarget,
  format: Format,
): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`test "parse ${rootName}" {`);
  lines.push("    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);");
  lines.push("    defer arena.deinit();");
  lines.push("    const input =");
  for (const l of sample.split("\n")) {
    lines.push(`        \\\\${l}`);
  }
  lines.push("    ;");
  if (target === "plain") {
    if (format === "json" || format === "ndjson") {
      lines.push("    const parsed = try std.json.parseFromSlice(");
      lines.push(`        ${rootName},`);
      lines.push("        arena.allocator(),");
      lines.push("        input,");
      lines.push("        .{},");
      lines.push("    );");
      lines.push("    defer parsed.deinit();");
      lines.push("    _ = parsed.value;");
    } else {
      lines.push(`    // std doesn't ship a ${format.toUpperCase()} parser; supply your own here.`);
      lines.push("    _ = input;");
    }
  } else {
    const mod = SERDE_MODULE[format];
    lines.push(`    const parsed = try serde.${mod}.fromSlice(`);
    lines.push(`        ${rootName},`);
    lines.push("        arena.allocator(),");
    lines.push("        input,");
    lines.push("    );");
    lines.push("    _ = parsed;");
  }
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

/** A Zig comment block describing what the generated struct expects from
 *  `build.zig`.  For the plain target there's nothing to wire (std comes
 *  for free); for serde-zig we point at the package and module-import
 *  pattern that ships in serde.zig's README. */
export function emitBuildSnippet(target: SnippetTarget): string {
  if (target === "plain") {
    return [
      "",
      "// build.zig: nothing to add — the generated struct only depends on std.",
      "",
    ].join("\n");
  }
  return [
    "",
    "// build.zig — wire serde.zig as a dependency:",
    "//",
    "//   const serde = b.dependency(\"serde\", .{",
    "//       .target = target,",
    "//       .optimize = optimize,",
    "//   });",
    "//   exe.root_module.addImport(\"serde\", serde.module(\"serde\"));",
    "//",
    "// build.zig.zon — add to .dependencies:",
    "//",
    "//   .serde = .{ .url = \"…\", .hash = \"…\" },",
    "",
  ].join("\n");
}
