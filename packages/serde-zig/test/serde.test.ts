import { describe, expect, test } from "bun:test";
import {
  generateZig,
  infer,
  normalize,
  observeSamples,
  parseSample,
  runPipeline,
  type NormalizeResult,
} from "@zigshape/core";
import { serdeCompatWarnings, serdeDecorator } from "../src";

function gen(rootName: string, ...samples: string[]): { result: NormalizeResult; code: string } {
  const values = samples.map((s, i) => {
    const r = parseSample(s, i);
    if (!r.value) throw new Error("parse fail");
    return r.value;
  });
  const { root } = infer(observeSamples(values));
  const result = normalize(root, { rootName });
  const code = generateZig(result, serdeDecorator(result));
  return { result, code };
}

describe("serdeDecorator", () => {
  test("no renames -> no serde block, module still imported for helpers", () => {
    const { code } = gen("User", '{"id": 1, "name": "Alice"}');
    expect(code).not.toContain("pub const serde");
    expect(code).toContain('const serde = @import("serde");');
  });

  test("all camelCase -> rename_all = camel_case", () => {
    const { code } = gen("User", '{"userId": 1, "firstName": "Alice"}');
    expect(code).toContain('const serde = @import("serde");');
    expect(code).toContain("rename_all = .camel_case");
    expect(code).not.toContain(".rename = .{");
  });

  test("all kebab-case -> rename_all = kebab_case", () => {
    const { code } = gen("Cfg", '{"server-port": 3000, "max-connections": 10}');
    expect(code).toContain("rename_all = .kebab_case");
  });

  test("PascalCase keys -> rename_all = pascal_case", () => {
    const { code } = gen("User", '{"FirstName": "A", "LastName": "B"}');
    expect(code).toContain("rename_all = .pascal_case");
  });

  test("mixed conventions -> explicit renames", () => {
    const { code } = gen("X", '{"userId": 1, "first-name": "A"}');
    expect(code).not.toContain("rename_all");
    expect(code).toContain('.user_id = "userId"');
    expect(code).toContain('.first_name = "first-name"');
  });

  test("reserved keyword key -> explicit rename (not rename_all)", () => {
    const { code } = gen("Thing", '{"type": "x", "pub": "y"}');
    expect(code).not.toContain("rename_all");
    expect(code).toContain('.type_ = "type"');
    expect(code).toContain('.pub_ = "pub"');
  });

  test("escaped key spells the wire name, so no rename", () => {
    const { code } = gen("Thing", '{"2fa_enabled": true}');
    expect(code).toContain('@"2fa_enabled": bool');
    expect(code).not.toContain("pub const serde");
  });

  test("qualified key -> local field name + rename to the full key", () => {
    const { code } = gen("Doc", '{"dc:creator": "a", "id": 1}');
    expect(code).toContain("creator: []const u8");
    expect(code).toContain('.creator = "dc:creator"');
  });

  test("convention only emitted if at least one field actually renames", () => {
    // single 'id' key - no rename needed, no convention
    const { code } = gen("X", '{"id": 1}');
    expect(code).not.toContain("rename_all");
    expect(code).not.toContain("pub const serde");
  });

  test("non-renamed snake field with renamed camel sibling -> explicit (mixed)", () => {
    // 'id' is neutral; 'userId' is camel. Convention would round-trip both:
    // camel('id') = 'id', camel('user_id') = 'userId'. So convention IS valid.
    const { code } = gen("U", '{"id": 1, "userId": 2}');
    expect(code).toContain("rename_all = .camel_case");
  });

  test("multi-segment snake non-renamed sibling blocks rename_all", () => {
    // camel('user_name') = 'userName' which differs from original 'user_name'.
    // So under strict round-trip, camel doesn't fit.  But user_name is NOT renamed
    // (input key matches Zig name).  Result: no convention works; explicit only.
    const { code } = gen("U", '{"user_name": "A", "userId": 1}');
    expect(code).not.toContain("rename_all");
    expect(code).toContain('.user_id = "userId"');
  });
});

describe("serdeCompatWarnings", () => {
  const run = (sample: string, options: Record<string, unknown> = {}) => {
    const { normalized } = runPipeline({ samples: [sample], rootName: "R", inferOptions: options });
    return serdeCompatWarnings(normalized!);
  };

  test("std.json.Value can't be read by serde.zig", () => {
    const w = run('{"a": null}', { unknown: "std-json-value" });
    expect(w.map((d) => d.code)).toContain("serde.unsupported_json_value");
  });

  test("serde.Value seen only as null is informational", () => {
    const w = run('{"a": null}', { unknown: "serde-value" });
    expect(w).toEqual([expect.objectContaining({ code: "serde.value_null_only", severity: "info" })]);
  });

  test("serde.Value for mixed data is a warning", () => {
    const w = run('{"b": [1, "x"]}', { unknown: "serde-value" });
    expect(w).toEqual([expect.objectContaining({ code: "serde.value_unparseable", severity: "warning" })]);
  });

  test("[]u8 and [:0]const u8 strings are flagged", () => {
    expect(run('{"a": "x"}', { strings: "mut" }).map((d) => d.code)).toEqual(["serde.unsupported_string"]);
    expect(run('{"a": "x"}', { strings: "sentinel" }).map((d) => d.code)).toEqual(["serde.unsupported_string"]);
  });

  test("plain slices produce no warnings", () => {
    expect(run('{"a": "x", "n": 1}')).toEqual([]);
  });
});

describe("skipped fields", () => {
  test("get a zero default so serde.zig can build the struct", () => {
    const { normalized } = runPipeline({ samples: ['{"token": "t", "n": 1, "tags": ["a"]}'], rootName: "R" });
    const code = generateZig(normalized!, serdeDecorator(normalized!, { skipPaths: ["$.token", "$.n", "$.tags"] }));
    expect(code).toContain('token: []const u8 = "",');
    expect(code).toContain("n: u8 = 0,");
    expect(code).toContain("tags: []const []const u8 = &.{},");
    expect(code).toContain(".token = .always,");
  });
});

describe("field named serde", () => {
  test("is renamed so it can't clash with the serde options decl", () => {
    const { code } = gen("Deps", '{"serde": {"url": "x"}}');
    expect(code).toContain("serde_: Serde,");
    expect(code).toContain('.serde_ = "serde"');
  });
});
