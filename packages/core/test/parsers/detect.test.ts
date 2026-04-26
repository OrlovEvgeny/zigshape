import { describe, expect, test } from "bun:test";
import { detectFormat } from "../../src/parsers/detect";

describe("detectFormat", () => {
  test("JSON object", () => {
    expect(detectFormat('{"a": 1}').format).toBe("json");
  });
  test("JSON array", () => {
    expect(detectFormat("[1, 2, 3]").format).toBe("json");
  });
  test("JSON with leading whitespace and BOM", () => {
    expect(detectFormat("﻿\n  { \"a\": 1 }").format).toBe("json");
  });
  test("YAML document marker", () => {
    expect(detectFormat("---\nname: hi").format).toBe("yaml");
  });
  test("YAML by colon-key style", () => {
    expect(detectFormat("name: hi\nport: 80").format).toBe("yaml");
  });
  test("YAML by block sequence", () => {
    expect(detectFormat("- a\n- b\n- c").format).toBe("yaml");
  });
  test("TOML by section header", () => {
    expect(detectFormat("[server]\nhost = \"x\"").format).toBe("toml");
  });
  test("TOML by array-of-tables header", () => {
    expect(detectFormat("[[users]]\nname = \"alice\"").format).toBe("toml");
  });
  test("TOML by key = value", () => {
    expect(detectFormat("title = \"x\"\nport = 3000\nratio = 1.5").format).toBe("toml");
  });
  test("TOML wins over YAML when assignments dominate", () => {
    const r = detectFormat("title = \"x\"\nname = \"y\"\nratio = 1.0\nflag = true");
    expect(r.format).toBe("toml");
  });
  test("ambiguous input falls back to JSON with low confidence", () => {
    const r = detectFormat("just plain text");
    expect(r.format).toBe("json");
    expect(r.confidence).toBeLessThan(0.5);
  });
  test("empty input", () => {
    const r = detectFormat("");
    expect(r.confidence).toBe(0);
  });
  test("comments-only YAML still recognized", () => {
    // After stripping comments + blank, we have `port: 80` left
    const r = detectFormat("# config\nport: 80");
    expect(r.format).toBe("yaml");
  });
});
