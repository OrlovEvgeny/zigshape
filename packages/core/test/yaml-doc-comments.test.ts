import { describe, expect, test } from "bun:test";
import { generateZig, runPipeline } from "../src";

function gen(yaml: string, withDocComments: boolean): string {
  const r = runPipeline({
    samples: [yaml],
    rootName: "Cfg",
    inferOptions: { format: "yaml" },
  });
  if (!r.normalized) throw new Error("pipeline failed");
  return generateZig(r.normalized, { withDocComments });
}

describe("YAML comments → /// doc comments", () => {
  test("comment-before-key surfaces as /// when withDocComments is on", () => {
    const yaml = "# server hostname\nhost: localhost\n# bind port\nport: 80\n";
    const code = gen(yaml, true);
    expect(code).toContain("/// server hostname");
    expect(code).toContain("/// bind port");
  });

  test("withDocComments off -> no /// even when comments are present", () => {
    const yaml = "# server hostname\nhost: localhost\n";
    const code = gen(yaml, false);
    expect(code).not.toContain("///");
  });

  test("multi-line comment joins with single space", () => {
    const yaml = "# first line\n# second line\nkey: value\n";
    const code = gen(yaml, true);
    expect(code).toContain("/// first line second line");
  });

  test("keys without preceding comments leave the field unchanged", () => {
    const yaml = "# only this one is documented\na: 1\nb: 2\n";
    const code = gen(yaml, true);
    expect(code).toContain("/// only this one is documented");
    // 'b' has no comment.  Confirm exactly one /// line in output.
    expect((code.match(/\/\/\//g) ?? []).length).toBe(1);
  });

  test("JSON input is unaffected (no comments to surface)", () => {
    const r = runPipeline({
      samples: ['{"host": "x", "port": 80}'],
      rootName: "Cfg",
    });
    if (!r.normalized) throw new Error("pipeline failed");
    const code = generateZig(r.normalized, { withDocComments: true });
    expect(code).not.toContain("///");
  });
});
