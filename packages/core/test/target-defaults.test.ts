import { describe, expect, test } from "bun:test";
import { targetDefaults } from "../src/options";

describe("targetDefaults", () => {
  test("plain output is what std.json can parse", () => {
    expect(targetDefaults("plain")).toEqual({
      unknown: "std-json-value",
      mapType: "json-array-hash-map",
      fieldNames: "wire",
      aliases: "off",
    });
  });

  test("serde.zig output uses its own map, names and fallback", () => {
    expect(targetDefaults("serde-zig")).toEqual({
      unknown: "serde-value",
      mapType: "string-hash-map",
      fieldNames: "snake_case",
      aliases: "auto",
    });
  });
});
