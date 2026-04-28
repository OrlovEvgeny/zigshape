import { describe, expect, test } from "bun:test";
import { parseSample } from "../src/parse";
import { suggestRootName } from "../src/zig/root-name";

function suggest(text: string, opts: { xmlRoot?: string; treatRootArrayAsSamples?: boolean } = {}): string | null {
  const r = parseSample(text, 0, "auto");
  if (!r.value) throw new Error("parse failed: " + text);
  return suggestRootName(r.value, { xmlRoot: opts.xmlRoot ?? r.xmlRoot, ...opts });
}

describe("suggestRootName — XML", () => {
  test("uses xml root element", () => {
    const xml = "<user id='1'><name>Alice</name></user>";
    expect(suggest(xml)).toBe("User");
  });

  test("kebab-case XML root → PascalCase", () => {
    expect(suggest("<purchase-order><id>1</id></purchase-order>")).toBe("PurchaseOrder");
  });

  test("namespaced XML root → namespace stripped", () => {
    const xml = '<soap:Envelope xmlns:soap="http://x"><body/></soap:Envelope>';
    expect(suggest(xml)).toBe("Envelope");
  });
});

describe("suggestRootName — single-key wrapper", () => {
  test("nested object: { user: { ... } } → User", () => {
    expect(suggest('{"user": {"id": 1, "name": "Alice"}}')).toBe("User");
  });

  test("kebab-case wrapper → PascalCase", () => {
    expect(suggest('{"purchase-order": {"id": 1}}')).toBe("PurchaseOrder");
  });

  test("array wrapper: { users: [...] } → User (singularised)", () => {
    expect(suggest('{"users": [{"id": 1}]}')).toBe("User");
  });

  test("ignores wrapper when value is a scalar", () => {
    expect(suggest('{"name": "myapp"}')).toBe(null);
  });

  test("ignores when there are sibling keys", () => {
    expect(suggest('{"user": {"id": 1}, "version": 2}')).toBe(null);
  });
});

describe("suggestRootName — discriminator field", () => {
  test("kind: 'Invoice' → Invoice", () => {
    expect(suggest('{"kind": "Invoice", "amount": 100}')).toBe("Invoice");
  });

  test("type field works", () => {
    expect(suggest('{"type": "User", "id": 1}')).toBe("User");
  });

  test("__typename (GraphQL) field works", () => {
    expect(suggest('{"__typename": "BlogPost", "title": "x"}')).toBe("BlogPost");
  });

  test("snake_case discriminator value → PascalCase", () => {
    expect(suggest('{"kind": "blog_post", "title": "x"}')).toBe("BlogPost");
  });

  test("priority: __typename beats kind", () => {
    expect(
      suggest('{"__typename": "User", "kind": "Other", "id": 1}'),
    ).toBe("User");
  });

  test("priority: type beats kind", () => {
    expect(suggest('{"type": "Alpha", "kind": "Beta"}')).toBe("Alpha");
  });

  test("non-string discriminator ignored", () => {
    expect(suggest('{"type": 1, "id": 2}')).toBe(null);
  });

  test("empty-string discriminator ignored", () => {
    expect(suggest('{"kind": "  ", "id": 1}')).toBe(null);
  });
});

describe("suggestRootName — fallthrough", () => {
  test("plain object with no signal → null", () => {
    expect(suggest('{"id": 1, "name": "Alice"}')).toBe(null);
  });

  test("scalar root → null", () => {
    expect(suggest('"hello"')).toBe(null);
  });

  test("array root (no opt-in) → null", () => {
    expect(suggest('[{"id": 1}, {"id": 2}]')).toBe(null);
  });

  test("array root with samplesFromArray opt-in still returns null without per-item signal", () => {
    expect(suggest('[{"id": 1}, {"id": 2}]', { treatRootArrayAsSamples: true })).toBe(
      null,
    );
  });
});

describe("suggestRootName — XML wins over body signals", () => {
  test("XML root preferred even when body has a discriminator-shaped child", () => {
    const xml = "<user><kind>Admin</kind></user>";
    expect(suggest(xml)).toBe("User");
  });
});
