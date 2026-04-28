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

  test("serde-zig + json -> serde.json.fromSlice", () => {
    const s = emitParserHelper("User", "serde-zig", "json");
    expect(s).toContain("serde.json.fromSlice(User");
  });

  test("serde-zig + yaml -> serde.yaml.fromSlice", () => {
    const s = emitParserHelper("Cfg", "serde-zig", "yaml");
    expect(s).toContain("serde.yaml.fromSlice(Cfg");
  });

  test("serde-zig + toml -> serde.toml.fromSlice", () => {
    const s = emitParserHelper("Cfg", "serde-zig", "toml");
    expect(s).toContain("serde.toml.fromSlice(Cfg");
  });

  test("serde-zig + xml -> serde.xml.fromSlice", () => {
    const s = emitParserHelper("Doc", "serde-zig", "xml");
    expect(s).toContain("serde.xml.fromSlice(Doc");
  });

  test("serde-zig + ndjson -> serde.json.fromSlice", () => {
    const s = emitParserHelper("Row", "serde-zig", "ndjson");
    expect(s).toContain("serde.json.fromSlice(Row");
  });
});

describe("emitTestScaffold", () => {
  test("plain + json uses ArenaAllocator and parsed.deinit()", () => {
    const s = emitTestScaffold("User", '{"id":1}', "plain", "json");
    expect(s).toContain('test "parse User"');
    expect(s).toContain("std.heap.ArenaAllocator");
    expect(s).toContain("std.testing.allocator");
    expect(s).toContain("defer parsed.deinit();");
    expect(s).toContain('\\\\{"id":1}');
  });

  test("serde-zig + yaml uses serde.yaml.fromSlice", () => {
    const s = emitTestScaffold("Cfg", "host: localhost", "serde-zig", "yaml");
    expect(s).toContain("serde.yaml.fromSlice(");
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
    expect(s).toContain('addImport("serde"');
    expect(s).toContain("build.zig.zon");
  });
});
