import { describe, expect, test } from "bun:test";
import { parseCsv } from "../../src/parsers/csv";
import { runPipeline } from "../../src/pipeline";
import type { ZArray, ZObject } from "../../src/value";

describe("parseCsv", () => {
  test("rows become objects keyed by the header", () => {
    const r = parseCsv("id,name\n1,Alice\n2,Bob\n", 0);
    const rows = (r.value as ZArray).items as ZObject[];
    expect(rows).toHaveLength(2);
    expect(rows[1]!.fields.get("name")!.value).toMatchObject({ kind: "string", value: "Bob" });
  });

  test("cells are typed the way serde.zig reads them", () => {
    const r = parseCsv('a,b,c,d,e,f\n42,2.5,TRUE,,"7",007\n', 0);
    const f = ((r.value as ZArray).items[0] as ZObject).fields;
    expect(f.get("a")!.value).toMatchObject({ kind: "int", value: 42n });
    expect(f.get("b")!.value).toMatchObject({ kind: "float", value: 2.5 });
    expect(f.get("c")!.value).toMatchObject({ kind: "bool", value: true });
    expect(f.get("d")!.value).toMatchObject({ kind: "null" });
    expect(f.get("e")!.value).toMatchObject({ kind: "string", value: "7" });
    expect(f.get("f")!.value).toMatchObject({ kind: "string", value: "007" });
  });

  test("quoted cells keep commas, newlines and doubled quotes", () => {
    const r = parseCsv('a,b\n"x, y","say ""hi""\nthere"\n', 0);
    const f = ((r.value as ZArray).items[0] as ZObject).fields;
    expect(f.get("a")!.value).toMatchObject({ value: "x, y" });
    expect(f.get("b")!.value).toMatchObject({ value: 'say "hi"\nthere' });
  });

  test("cell source ranges point at the cell", () => {
    const text = "id,name\n1,Alice\n";
    const f = ((parseCsv(text, 0).value as ZArray).items[0] as ZObject).fields;
    const src = f.get("name")!.value.src;
    expect(text.slice(src.offset, src.offset + src.length)).toBe("Alice");
  });

  test("short rows are errors, duplicate headers too", () => {
    expect(parseCsv("a,b\n1\n", 0).diagnostics.toArray()[0]).toMatchObject({ code: "parse.csv_field_count", severity: "error" });
    expect(parseCsv("a,a\n1,2\n", 0).value).toBeNull();
  });

  test("each row is a sample: a column empty in some rows becomes optional", () => {
    const { normalized } = runPipeline({ samples: ["id,email\n1,a@x.io\n2,\n"], rootName: "Row", inferOptions: { format: "csv" } });
    const row = normalized!.decls[0]!;
    expect(row.kind === "struct" && row.fields.find((f) => f.name === "email")!.defaultExpr).toBe("null");
  });
});
