import { describe, expect, test } from "bun:test";
import { tryParseCurl } from "../src/lib/curl";

describe("tryParseCurl", () => {
  test("returns null for non-curl text", () => {
    expect(tryParseCurl('{"id": 1}')).toBe(null);
    expect(tryParseCurl("plain text without anything")).toBe(null);
    expect(tryParseCurl("")).toBe(null);
  });

  test("returns null when curl has no inline body", () => {
    expect(tryParseCurl("curl https://example.com/users")).toBe(null);
  });

  test("strips leading $ shell prompt", () => {
    const r = tryParseCurl("$ curl -d '{\"id\":1}' https://example.com/users");
    expect(r).not.toBe(null);
    expect(r!.sample).toBe('{"id":1}');
  });

  test("extracts -d single-quoted JSON payload", () => {
    const r = tryParseCurl(
      'curl -X POST https://api.example.com/v1/users -d \'{"id": 1, "name": "Alice"}\'',
    );
    expect(r).not.toBe(null);
    expect(r!.sample).toBe('{"id": 1, "name": "Alice"}');
    expect(r!.rootHint).toBe("User");
  });

  test("extracts --data-raw payload", () => {
    const r = tryParseCurl(
      "curl 'https://example.com/api/posts' --data-raw '{\"title\":\"x\"}'",
    );
    expect(r).not.toBe(null);
    expect(r!.sample).toBe('{"title":"x"}');
    expect(r!.rootHint).toBe("Post");
  });

  test("extracts --data=payload (single-token form)", () => {
    const r = tryParseCurl('curl --data=\'{"id":1}\' https://example.com/things');
    expect(r).not.toBe(null);
    expect(r!.sample).toBe('{"id":1}');
    expect(r!.rootHint).toBe("Thing");
  });

  test("ignores @file payload references", () => {
    const r = tryParseCurl("curl --data @body.json https://example.com/users");
    expect(r).toBe(null);
  });

  test("skips numeric and UUID path segments when picking root hint", () => {
    expect(
      tryParseCurl("curl -d '{}' https://api.x.com/v1/users/42")!.rootHint,
    ).toBe("User");
    expect(
      tryParseCurl(
        "curl -d '{}' https://api.x.com/users/550e8400-e29b-41d4-a716-446655440000",
      )!.rootHint,
    ).toBe("User");
  });

  test("rootHint is null when path has no usable segment", () => {
    const r = tryParseCurl("curl -d '{\"x\":1}' https://example.com/");
    expect(r).not.toBe(null);
    expect(r!.rootHint).toBe(null);
  });

  test("handles backslash line continuation typical of pasted commands", () => {
    const r = tryParseCurl(
      "curl -X POST 'https://api.example.com/v2/articles' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"slug\":\"hi\"}'",
    );
    expect(r).not.toBe(null);
    expect(r!.sample).toBe('{"slug":"hi"}');
    expect(r!.rootHint).toBe("Article");
  });

  test("handles double-quoted payload with escaped quotes", () => {
    const r = tryParseCurl(
      'curl https://example.com/users -d "{\\"id\\": 1}"',
    );
    expect(r).not.toBe(null);
    expect(r!.sample).toBe('{"id": 1}');
  });

  test("kebab-case path segment becomes PascalCase singular", () => {
    const r = tryParseCurl(
      "curl -d '{\"x\":1}' https://api.example.com/v1/blog-posts",
    );
    expect(r!.rootHint).toBe("BlogPost");
  });

  test("snake_case path segment becomes PascalCase singular", () => {
    const r = tryParseCurl(
      "curl -d '{\"x\":1}' https://api.example.com/v1/user_profiles",
    );
    expect(r!.rootHint).toBe("UserProfile");
  });
});
