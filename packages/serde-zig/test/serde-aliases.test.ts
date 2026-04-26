import { describe, expect, test } from "bun:test";
import {
  generateZig,
  infer,
  normalize,
  observeSamples,
  parseSample,
} from "@zigshape/core";
import { serdeDecorator, type SerdeDecorateOptions } from "../src";

function gen(
  rootName: string,
  samples: string[],
  decorateOpts: SerdeDecorateOptions = {},
  inferOpts: Parameters<typeof infer>[1] = {},
): string {
  const values = samples.map((s, i) => {
    const r = parseSample(s, i);
    if (!r.value) throw new Error("parse fail");
    return r.value;
  });
  const { root } = infer(observeSamples(values), inferOpts);
  const result = normalize(root, { rootName });
  return generateZig(result, serdeDecorator(result, decorateOpts));
}

describe("serdeDecorator + aliases", () => {
  test("aliases produce .alias = .{ ... } block", () => {
    const code = gen("Config", [
      '{"url": "x"}',
      '{"uri": "y"}',
      '{"endpoint": "z"}',
    ]);
    expect(code).toContain(".alias = .{");
    // canonical is whichever appeared first in the field map; check
    // structure rather than name
    expect(code).toMatch(/\.\w+ = &\.\{ "[^"]+", "[^"]+" \},/);
    expect(code).toContain('const serde = @import("serde");');
  });

  test("aliases='off' yields plain optional struct", () => {
    const code = gen(
      "Config",
      ['{"url": "x"}', '{"uri": "y"}'],
      {},
      { aliases: "off" },
    );
    expect(code).not.toContain(".alias = .{");
    expect(code).toContain("url:");
    expect(code).toContain("uri:");
  });

  test("denyUnknownFields adds .deny_unknown_fields = true", () => {
    const code = gen("X", ['{"id": 1}'], { denyUnknownFields: true });
    expect(code).toContain(".deny_unknown_fields = true");
    expect(code).toContain('const serde = @import("serde");');
  });

  test("denyUnknownFields combined with rename_all yields both", () => {
    const code = gen(
      "X",
      ['{"userId": 1, "firstName": "A"}'],
      { denyUnknownFields: true },
    );
    expect(code).toContain("rename_all = serde.NamingConvention.camel_case");
    expect(code).toContain(".deny_unknown_fields = true");
  });

  test("aliases coexist with rename_all", () => {
    const code = gen("X", [
      '{"userId": 1, "primaryUrl": "x"}',
      '{"userId": 2, "secondaryUrl": "y"}',
    ]);
    expect(code).toContain("rename_all = serde.NamingConvention.camel_case");
    expect(code).toContain(".alias = .{");
  });
});
