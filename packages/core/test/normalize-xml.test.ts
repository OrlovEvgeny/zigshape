import { describe, expect, test } from "bun:test";
import { runPipeline } from "../src/pipeline";
import { generateZig } from "../src/generate";

function plain(rootName: string, xml: string) {
  const r = runPipeline({ samples: [xml], rootName, inferOptions: { format: "xml" } });
  if (!r.normalized) throw new Error("pipeline failed: " + JSON.stringify(r.warnings));
  return { code: generateZig(r.normalized), result: r.normalized, warnings: r.warnings };
}

describe("XML normalize → ZigField propagation", () => {
  test("attributes propagate xml: \"attribute\" through the field tree", () => {
    const { result } = plain(
      "User",
      '<user id="42" name="Alice"><role>admin</role></user>',
    );
    const root = result.decls.find((d) => d.kind === "struct" && d.name === "User");
    if (!root || root.kind !== "struct") throw new Error("root struct missing");
    const id = root.fields.find((f) => f.name === "id");
    const name = root.fields.find((f) => f.name === "name");
    const role = root.fields.find((f) => f.name === "role");
    expect(id?.xml).toBe("attribute");
    expect(name?.xml).toBe("attribute");
    expect(role?.xml).toBeUndefined();
  });

  test("xml_root element name flows through normalize", () => {
    const { result } = plain("User", '<person id="1"/>');
    expect(result.xmlRootElement).toBe("person");
  });

  test("mixed content (attribute + text) emits a `value` field with xml: \"text\"", () => {
    const { result, warnings } = plain(
      "Description",
      '<description lang="en">Hello</description>',
    );
    const root = result.decls.find((d) => d.kind === "struct" && d.name === "Description");
    if (!root || root.kind !== "struct") throw new Error("root struct missing");
    const value = root.fields.find((f) => f.name === "value");
    expect(value?.xml).toBe("text");
    // The xml_mixed_content warning fires from the parser.
    expect(warnings.some((w) => w.code === "parse.xml_mixed_content")).toBe(true);
  });

  test("namespace prefixes are stripped and a warning fires", () => {
    const { result, warnings } = plain(
      "Doc",
      '<doc xmlns:x="urn:x"><x:item>v</x:item></doc>',
    );
    const root = result.decls.find((d) => d.kind === "struct" && d.name === "Doc");
    if (!root || root.kind !== "struct") throw new Error("root struct missing");
    expect(root.fields.some((f) => f.name === "item")).toBe(true);
    expect(warnings.some((w) => w.code === "parse.xml_namespace")).toBe(true);
  });
});
