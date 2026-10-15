import type { Format } from "../parsers/types";

export type SnippetTarget = "plain" | "serde-zig";

/** serde.zig release the snippets are written against. */
export const SERDE_ZIG_VERSION = "1.2.3";

/** Module name that lives under `serde.<module>` in serde.zig per format. */
const SERDE_MODULE: Record<Format, string> = {
  json: "json",
  ndjson: "json",
  yaml: "yaml",
  toml: "toml",
  xml: "xml",
  csv: "csv",
  zon: "zon",
  toon: "toon",
};

/** The type a whole document parses into: serde.zig reads CSV as a slice
 *  of rows, every other format as the root type itself. */
function documentType(rootName: string, format: Format): string {
  return format === "csv" ? `[]const ${rootName}` : rootName;
}

/** Formats where every top-level record is one sample of `rootName`: the
 *  helper parses one line at a time. */
function isLineFormat(format: Format): boolean {
  return format === "ndjson";
}

/** A `pub fn parse<Root>(allocator, input)` helper.  The serde target uses
 *  `serde.<format>.fromSliceManaged`, whose `serde.Parsed(T)` owns an arena
 *  the caller releases with one `deinit`.  The plain target wraps
 *  `std.json.parseFromSlice`; YAML/TOML/XML aren't in std, so it emits a
 *  pointer to the serde target instead. */
export function emitParserHelper(
  rootName: string,
  target: SnippetTarget,
  format: Format,
): string {
  const line = isLineFormat(format);
  const arg = line ? "line" : "input";
  if (target === "plain") {
    if (format === "json" || format === "ndjson") {
      return [
        "",
        line
          ? `/// Parses one NDJSON line. Call \`deinit\` on the result to free it.`
          : `/// Call \`deinit\` on the result to free it.`,
        `pub fn parse${rootName}(allocator: std.mem.Allocator, ${arg}: []const u8) !std.json.Parsed(${rootName}) {`,
        `    return std.json.parseFromSlice(${rootName}, allocator, ${arg}, .{});`,
        "}",
        "",
      ].join("\n");
    }
    if (format === "zon") {
      return [
        "",
        "// std.zon.parse reads this file into the generated struct; its",
        "// signature changes between Zig releases, so call it directly.",
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
  const doc_t = documentType(rootName, format);
  const doc = line
    ? [
        `/// Parses one NDJSON line. Call \`deinit\` on the result to free it.`,
        `/// For a stream, use serde.helpers.StreamingDeserializer(${rootName}).`,
      ]
    : [`/// Call \`deinit\` on the result to free everything it allocated.`];
  return [
    "",
    ...doc,
    `pub fn parse${rootName}(allocator: std.mem.Allocator, ${arg}: []const u8) !serde.Parsed(${doc_t}) {`,
    `    return serde.${mod}.fromSliceManaged(${doc_t}, allocator, ${arg});`,
    "}",
    "",
  ].join("\n");
}

/** A minimal parse test using the first sample as input.  The sample is
 *  embedded inside a Zig multi-line raw string so any quoting in the wire
 *  format is preserved verbatim (no escaping required).  It parses with
 *  `std.testing.allocator`, so a leak fails the test.  No assertions about
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
  lines.push("    const input =");
  for (const l of sample.split("\n")) {
    lines.push(`        \\\\${l}`);
  }
  lines.push("    ;");

  let call: string | null = null;
  if (target === "plain") {
    if (format === "json" || format === "ndjson") {
      call = `std.json.parseFromSlice(${rootName}, std.testing.allocator, INPUT, .{})`;
    }
  } else {
    call = `serde.${SERDE_MODULE[format]}.fromSliceManaged(${documentType(rootName, format)}, std.testing.allocator, INPUT)`;
  }

  if (call === null) {
    lines.push(`    // std doesn't ship a ${format.toUpperCase()} parser; supply your own here.`);
    lines.push("    _ = input;");
  } else if (isLineFormat(format)) {
    lines.push("    var it = std.mem.splitScalar(u8, input, '\\n');");
    lines.push("    while (it.next()) |line| {");
    lines.push("        if (std.mem.trim(u8, line, \" \\t\\r\").len == 0) continue;");
    lines.push(`        var parsed = try ${call.replace("INPUT", "line")};`);
    lines.push("        defer parsed.deinit();");
    lines.push("    }");
  } else {
    const binding = target === "plain" ? "const" : "var";
    lines.push(`    ${binding} parsed = try ${call.replace("INPUT", "input")};`);
    lines.push("    defer parsed.deinit();");
  }
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

/** A Zig comment block describing what the generated struct expects from
 *  `build.zig`.  For the plain target there's nothing to wire (std comes
 *  for free); for serde-zig it's the fetch command and module import from
 *  serde.zig's README. */
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
    "// Add serde.zig to build.zig.zon:",
    "//",
    `//   zig fetch --save https://github.com/OrlovEvgeny/serde.zig/archive/refs/tags/v${SERDE_ZIG_VERSION}.tar.gz`,
    "//",
    "// Then import the module in build.zig:",
    "//",
    "//   const serde_dep = b.dependency(\"serde\", .{ .target = target, .optimize = optimize });",
    "//   exe.root_module.addImport(\"serde\", serde_dep.module(\"serde\"));",
    "//",
    "// serde.zig supports Zig 0.15.2, 0.16.0 and 0.17.0.",
    "",
  ].join("\n");
}
