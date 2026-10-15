import { describe, expect, test } from "bun:test";
import {
  emitBuildSnippet,
  emitParserHelper,
  emitTestScaffold,
} from "../src/zig/snippets";

describe("emitParserHelper", () => {
  test("plain + json wraps std.json.parseFromSlice", () => {
    const s = emitParserHelper("User", "plain", "json");
    expect(s).toContain("pub fn parseUser");
    expect(s).toContain("std.json.parseFromSlice(User");
    expect(s).toContain("std.json.Parsed(User)");
  });

  test("plain + ndjson collapses to JSON", () => {
    const s = emitParserHelper("Row", "plain", "ndjson");
    expect(s).toContain("std.json.parseFromSlice(Row");
  });

  test("plain + yaml emits a TODO instead of fictional std API", () => {
    const s = emitParserHelper("Cfg", "plain", "yaml");
    expect(s).toContain("std doesn't ship a YAML parser");
    expect(s).not.toContain("std.yaml");
  });

  test("serde-zig + json -> managed serde.json parse", () => {
    const s = emitParserHelper("User", "serde-zig", "json");
    expect(s).toContain("serde.json.fromSliceManaged(User");
    expect(s).toContain("!serde.Parsed(User)");
  });

  test("serde-zig + yaml -> managed serde.yaml parse", () => {
    const s = emitParserHelper("Cfg", "serde-zig", "yaml");
    expect(s).toContain("serde.yaml.fromSliceManaged(Cfg");
  });

  test("serde-zig + toml -> managed serde.toml parse", () => {
    const s = emitParserHelper("Cfg", "serde-zig", "toml");
    expect(s).toContain("serde.toml.fromSliceManaged(Cfg");
  });

  test("serde-zig + xml -> managed serde.xml parse", () => {
    const s = emitParserHelper("Doc", "serde-zig", "xml");
    expect(s).toContain("serde.xml.fromSliceManaged(Doc");
  });

  test("serde-zig + ndjson parses one line and points at the stream helper", () => {
    const s = emitParserHelper("Row", "serde-zig", "ndjson");
    expect(s).toContain("line: []const u8");
    expect(s).toContain("serde.json.fromSliceManaged(Row, allocator, line)");
    expect(s).toContain("serde.helpers.StreamingDeserializer(Row)");
  });
});

describe("emitTestScaffold", () => {
  test("plain + json parses with the leak-checking testing allocator", () => {
    const s = emitTestScaffold("User", '{"id":1}', "plain", "json");
    expect(s).toContain('test "parse User"');
    expect(s).not.toContain("ArenaAllocator");
    expect(s).toContain("std.json.parseFromSlice(User, std.testing.allocator, input, .{})");
    expect(s).toContain("defer parsed.deinit();");
    expect(s).toContain('\\\\{"id":1}');
  });

  test("serde-zig + yaml uses the managed parse and deinit", () => {
    const s = emitTestScaffold("Cfg", "host: localhost", "serde-zig", "yaml");
    expect(s).toContain("var parsed = try serde.yaml.fromSliceManaged(Cfg, std.testing.allocator, input);");
    expect(s).toContain("defer parsed.deinit();");
  });

  test("ndjson parses each non-empty line", () => {
    const s = emitTestScaffold("Row", '{"a":1}\n{"a":2}', "serde-zig", "ndjson");
    expect(s).toContain("std.mem.splitScalar(u8, input, '\\n')");
    expect(s).toContain("serde.json.fromSliceManaged(Row, std.testing.allocator, line)");
  });

  test("plain + toml leaves a parser-not-shipped comment", () => {
    const s = emitTestScaffold("Cfg", "k = 1", "plain", "toml");
    expect(s).toContain("std doesn't ship a TOML parser");
    expect(s).toContain("\\\\k = 1");
  });

  test("multi-line samples preserve linebreaks via raw-string lines", () => {
    const sample = "{\n  \"id\": 1\n}";
    const s = emitTestScaffold("User", sample, "plain", "json");
    expect(s).toContain("\\\\{");
    expect(s).toContain('\\\\  "id": 1');
    expect(s).toContain("\\\\}");
  });
});

describe("emitBuildSnippet", () => {
  test("plain says no-op", () => {
    const s = emitBuildSnippet("plain");
    expect(s).toContain("nothing to add");
  });

  test("serde-zig describes b.dependency wiring", () => {
    const s = emitBuildSnippet("serde-zig");
    expect(s).toContain('b.dependency("serde"');
    expect(s).toContain('addImport("serde", serde_dep.module("serde"))');
    expect(s).toContain("zig fetch --save https://github.com/OrlovEvgeny/serde.zig/archive/refs/tags/v1.2.3.tar.gz");
  });
});
