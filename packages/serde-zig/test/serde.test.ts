import { describe, expect, test } from "bun:test";
import {
  generateZig,
  infer,
  normalize,
  observeSamples,
  parseSample,
  type NormalizeResult,
} from "@zigshape/core";
import { serdeDecorator } from "../src";

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
  test("no renames -> no serde block, no import", () => {
    const { code } = gen("User", '{"id": 1, "name": "Alice"}');
    expect(code).not.toContain("pub const serde");
    expect(code).not.toContain("@import(\"serde\")");
  });

  test("all camelCase -> rename_all = camel_case", () => {
    const { code } = gen("User", '{"userId": 1, "firstName": "Alice"}');
    expect(code).toContain('const serde = @import("serde");');
    expect(code).toContain("rename_all = serde.NamingConvention.camel_case");
    expect(code).not.toContain(".rename = .{");
  });

  test("all kebab-case -> rename_all = kebab_case", () => {
    const { code } = gen("Cfg", '{"server-port": 3000, "max-connections": 10}');
    expect(code).toContain("rename_all = serde.NamingConvention.kebab_case");
  });

  test("PascalCase keys -> rename_all = pascal_case", () => {
    const { code } = gen("User", '{"FirstName": "A", "LastName": "B"}');
    expect(code).toContain("rename_all = serde.NamingConvention.pascal_case");
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

  test("escaped key -> explicit rename", () => {
    const { code } = gen("Thing", '{"2fa_enabled": true}');
    expect(code).toContain('.@"2fa_enabled" = "2fa_enabled"');
    expect(code).not.toContain("rename_all");
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
    expect(code).toContain("rename_all = serde.NamingConvention.camel_case");
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
