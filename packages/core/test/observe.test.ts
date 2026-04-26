import { describe, expect, test } from "bun:test";
import { parseSample } from "../src/parse";
import { observeSamples, ROOT_PATH } from "../src/observe";
import type { ZValue } from "../src/value";

function parseAll(...samples: string[]): ZValue[] {
  return samples.map((s, i) => {
    const r = parseSample(s, i);
    if (!r.value) throw new Error("parse failed");
    return r.value;
  });
}

describe("observeSamples", () => {
  test("counts root kind", () => {
    const obs = observeSamples(parseAll('{"a": 1}', '{"a": 2}'));
    const root = obs.get(ROOT_PATH)!;
    expect(root.total).toBe(2);
    expect(root.countByKind.get("object")).toBe(2);
  });

  test("missing field shows up as smaller child total", () => {
    const obs = observeSamples(parseAll('{"a": 1, "b": 2}', '{"a": 3}'));
    const root = obs.get(ROOT_PATH)!;
    expect(root.total).toBe(2);
    const a = obs.get("$.a")!;
    const b = obs.get("$.b")!;
    expect(a.total).toBe(2);
    expect(b.total).toBe(1);
  });

  test("null vs missing both reduce countByKind for non-null kinds", () => {
    const obs = observeSamples(
      parseAll('{"x": "hi"}', '{"x": null}', "{}"),
    );
    const x = obs.get("$.x")!;
    expect(x.total).toBe(2); // missing in 1 of 3
    expect(x.countByKind.get("string")).toBe(1);
    expect(x.countByKind.get("null")).toBe(1);
  });

  test("int min/max tracked across observations", () => {
    const obs = observeSamples(parseAll("[1, 2, 3]"));
    const o = obs.get("$[*]")!;
    expect(o.intMin).toBe(1n);
    expect(o.intMax).toBe(3n);

    const obs2 = observeSamples(parseAll("[1, -2, 5]"));
    const o2 = obs2.get("$[*]")!;
    expect(o2.intMin).toBe(-2n);
    expect(o2.intMax).toBe(5n);
  });

  test("array length range tracked", () => {
    const obs = observeSamples(parseAll("[1]", "[1, 2, 3]"));
    const root = obs.get(ROOT_PATH)!;
    expect(root.arrayMinLen).toBe(1);
    expect(root.arrayMaxLen).toBe(3);
  });

  test("object child key order is first-seen across samples", () => {
    const obs = observeSamples(
      parseAll('{"a": 1, "b": 2}', '{"b": 3, "c": 4}'),
    );
    const root = obs.get(ROOT_PATH)!;
    expect(root.childKeyOrder).toEqual(["a", "b", "c"]);
  });

  test("non-identifier keys flagged", () => {
    const obs = observeSamples(parseAll('{"first-name": "A"}'));
    expect(obs.get(ROOT_PATH)!.childKeyHasNonIdent).toBe(true);
    const obs2 = observeSamples(parseAll('{"firstName": "A"}'));
    expect(obs2.get(ROOT_PATH)!.childKeyHasNonIdent).toBe(false);
  });

  test("nested arrays of objects", () => {
    const obs = observeSamples(
      parseAll('{"users": [{"id": 1}, {"id": 2}]}'),
    );
    expect(obs.get("$.users")!.countByKind.get("array")).toBe(1);
    expect(obs.get("$.users[*]")!.countByKind.get("object")).toBe(2);
    expect(obs.get("$.users[*].id")!.total).toBe(2);
  });

  test("first src ref captured", () => {
    const input = '{"a": 1}';
    const obs = observeSamples(parseAll(input));
    expect(obs.get("$.a")!.firstSrc).toBeDefined();
    expect(obs.get("$.a")!.firstSrc!.sample).toBe(0);
  });

  test("bool true/false counts tracked separately", () => {
    const obs = observeSamples(
      parseAll('{"a": true, "b": false}', '{"a": true, "b": true}'),
    );
    const a = obs.get("$.a")!;
    expect(a.boolTrue).toBe(2);
    expect(a.boolFalse).toBeUndefined();
    const b = obs.get("$.b")!;
    expect(b.boolTrue).toBe(1);
    expect(b.boolFalse).toBe(1);
  });
});
