import { describe, expect, test } from "bun:test";
import { applyEdit, cliCommand, presetOptions } from "../src/lib/options";

describe("web options", () => {
  test("presets fill every knob", () => {
    const strict = presetOptions("strict");
    expect(strict.intStrategy).toBe("u64");
    expect(strict.defaultsFromSamples).toBe(true);
    expect(strict.renameAll).toBe("auto");
    expect(strict.withDocComments).toBe(false);
  });

  test("an edit equal to the preset value is dropped", () => {
    const base = presetOptions("api");
    const edited = applyEdit({}, base, "intStrategy", "u64");
    expect(edited).toEqual({ intStrategy: "u64" });
    expect(applyEdit(edited, base, "intStrategy", "smallest")).toEqual({});
  });

  test("CLI command lists only non-default flags", () => {
    const opts = { ...presetOptions("api"), intStrategy: "u64" as const, denyUnknownFields: true };
    expect(cliCommand(opts, { format: "yaml", target: "serde-zig", rootName: "Config" })).toBe(
      "zigshape sample.yaml --format yaml --root Config --target serde-zig --int u64 --deny-unknown-fields --zig-fmt",
    );
  });

  test("serde-only flags are left out for the plain target", () => {
    const opts = { ...presetOptions("api"), denyUnknownFields: true, renameAll: "camel_case" as const };
    expect(cliCommand(opts, { format: "auto", target: "plain", rootName: "Root" })).toBe(
      "zigshape sample.json --zig-fmt",
    );
  });
});
