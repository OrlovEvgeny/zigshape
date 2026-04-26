import { describe, expect, test } from "bun:test";
import {
  decodeShareHash,
  encodeShareConfig,
  encodeShareWithSamples,
  ShareTooLargeError,
  SIZE_GUARD_BYTES,
  type SharedConfig,
} from "../src/lib/share";

const baseConfig: SharedConfig = {
  rootName: "User",
  target: "serde-zig",
  format: "auto",
  presetId: "api",
};

describe("share encoding", () => {
  test("config round-trips via #c=", () => {
    const hash = encodeShareConfig(baseConfig);
    expect(hash.startsWith("#c=")).toBe(true);
    const decoded = decodeShareHash(hash);
    expect(decoded).toEqual({ ...baseConfig });
  });

  test("samples round-trip via #s=", () => {
    const s = encodeShareWithSamples({
      ...baseConfig,
      samples: ['{"id": 1}', '{"id": 2}'],
    });
    expect(s.startsWith("#s=")).toBe(true);
    const decoded = decodeShareHash(s);
    expect(decoded?.samples).toEqual(['{"id": 1}', '{"id": 2}']);
    expect(decoded?.rootName).toBe("User");
  });

  test("size guard throws when above 8 KB", () => {
    const big = "x".repeat(SIZE_GUARD_BYTES + 1);
    expect(() =>
      encodeShareWithSamples({ ...baseConfig, samples: [big] }),
    ).toThrow(ShareTooLargeError);
  });

  test("malformed hash returns null", () => {
    expect(decodeShareHash("")).toBeNull();
    expect(decodeShareHash("#nope")).toBeNull();
    expect(decodeShareHash("#x=abc")).toBeNull();
    expect(decodeShareHash("#c=!!!not-base64!!!")).toBeNull();
  });

  test("hash without # prefix is tolerated", () => {
    const hash = encodeShareConfig(baseConfig).slice(1);
    expect(decodeShareHash(hash)).toEqual({ ...baseConfig });
  });

  test("rejects garbage shapes", () => {
    const fake = "#c=" + btoa('{"rootName": 7}').replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShareHash(fake)).toBeNull();
  });

  test("non-string samples are dropped", () => {
    const json = JSON.stringify({ ...baseConfig, samples: ["ok", 42] });
    const fake =
      "#s=" +
      btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const decoded = decodeShareHash(fake);
    expect(decoded?.rootName).toBe("User");
    expect(decoded?.samples).toBeUndefined();
  });
});
