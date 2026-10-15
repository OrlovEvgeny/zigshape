// Per-format landing pages: one record drives the route, its <head>, the
// visible copy, the FAQ (and its FAQPage schema), the sitemap and the
// footer.  Answers and bullets may contain inline <code>/<a> markup.

import type { Format } from "@zigshape/core";
import type { Example } from "./examples";
import type { PresetId } from "./presets";

export type LandingPage = {
  slug: string;
  format: Format;
  target: "plain" | "serde-zig";
  preset: PresetId;
  /** Short label for breadcrumbs and link lists. */
  name: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  example: Example;
  pointsTitle: string;
  points: string[];
  faq: { q: string; a: string }[];
  related: string[];
};

const SERDE = '<a href="https://github.com/OrlovEvgeny/serde.zig" target="_blank" rel="noopener noreferrer">serde.zig</a>';

const userJson = `{
  "id": 42,
  "name": "Alice",
  "email": "alice@example.com",
  "roles": ["admin", "user"],
  "profile": { "createdAt": "2026-01-01T10:00:00Z", "active": true }
}`;

const configYaml = `# Service name shown in logs
name: myapp
replicas: 3
labels:
  app: api
  tier: backend
ports:
  - 8080
  - 8443
`;

const configToml = `title = "myapp"
port = 3000
debug = false

[database]
host = "localhost"
name = "main"
`;

const userXml = `<user id="42">
  <name>Alice</name>
  <role>admin</role>
</user>
`;

export const PAGES: LandingPage[] = [
  {
    slug: "json-to-zig-struct",
    format: "json",
    target: "plain",
    preset: "api",
    name: "JSON to Zig struct",
    title: "JSON to Zig Struct Converter (std.json) · zigshape",
    description:
      "Convert JSON to Zig structs that std.json.parseFromSlice reads as-is. Optional fields, integer widths and maps inferred from your samples. Free, in-browser.",
    h1: "JSON to Zig struct",
    lede:
      "Paste one JSON document or several samples of the same payload. zigshape writes Zig structs that <code>std.json.parseFromSlice</code> reads without changes, and explains every type it picked.",
    example: { id: "seo-json", label: "JSON sample", format: "json", rootName: "User", target: "plain", samples: [userJson] },
    pointsTitle: "What zigshape decides for std.json",
    points: [
      "Field names stay exactly as the JSON keys (<code>@\"first-name\"</code> where needed), because std.json matches names literally and has no rename.",
      "A key missing or <code>null</code> in any sample becomes <code>?T = null</code>.",
      "Integers get the smallest width that fits every observed value; the <em>Strict</em> preset switches to <code>u64</code>.",
      "Objects with dynamic keys become <code>std.json.ArrayHashMap(V)</code>, the map type std.json can parse.",
      "Fields with no usable signal fall back to <code>std.json.Value</code>, with a warning that says why.",
    ],
    faq: [
      {
        q: "How do I parse JSON into the generated struct?",
        a: "Call <code>std.json.parseFromSlice(User, allocator, input, .{})</code> and <code>deinit()</code> the result. The <em>More</em> menu copies a ready <code>parseUser</code> helper and a test that parses your sample.",
      },
      {
        q: "Why are the field names camelCase instead of snake_case?",
        a: "std.json maps JSON keys to field names one to one, so renaming a field breaks parsing. Switch the target to serde.zig to get snake_case fields with <code>rename_all</code>.",
      },
      {
        q: "Can I generate one struct from several JSON responses?",
        a: "Yes. Add every response as a sample. Keys that are missing from some samples become optional, and the field table shows how often each key appeared.",
      },
      {
        q: "Does my JSON leave the browser?",
        a: "No. Parsing, inference and zig fmt all run locally; share links keep the data in the URL hash, which browsers never send to a server.",
      },
    ],
    related: ["json-to-serde-zig", "ndjson-to-zig-struct", "yaml-to-zig-struct"],
  },
  {
    slug: "json-to-serde-zig",
    format: "json",
    target: "serde-zig",
    preset: "api",
    name: "JSON to serde.zig",
    title: "JSON to serde.zig Structs: rename_all, aliases · zigshape",
    description:
      "Generate Zig structs for serde.zig from JSON: snake_case fields with rename_all, aliases across samples, tagged unions and deny_unknown_fields. Runs in your browser.",
    h1: "JSON to serde.zig",
    lede: `zigshape writes idiomatic snake_case Zig structs with a <code>pub const serde</code> block that ${SERDE} reads directly, so camelCase or kebab-case JSON maps without hand-written renames.`,
    example: { id: "seo-json-serde", label: "JSON sample", format: "json", rootName: "User", target: "serde-zig", samples: [userJson] },
    pointsTitle: "serde.zig options zigshape emits",
    points: [
      "<code>.rename_all = .camel_case</code> (or kebab, Pascal, SCREAMING_SNAKE) when one convention round-trips every key; per-field <code>.rename</code> otherwise.",
      "<code>.alias</code> for sibling keys that share a shape and never appear in the same sample.",
      "Tagged unions with <code>.tag</code> and <code>.tag_field</code> when objects carry a discriminator, in any of serde.zig's four tagging styles.",
      "<code>.deny_unknown_fields</code>, <code>.flatten</code> and <code>.skip</code> from the Options panel or the CLI config, with defaults added for skipped fields.",
    ],
    faq: [
      {
        q: "How do I parse JSON with the generated serde.zig struct?",
        a: "<code>var parsed = try serde.json.fromSliceManaged(User, allocator, input);</code> then <code>defer parsed.deinit();</code>. The result owns one arena, so a single <code>deinit</code> frees everything.",
      },
      {
        q: "Which serde.zig version does the output target?",
        a: "serde.zig 1.2.3, which supports Zig 0.15.2, 0.16 and 0.17. The <em>More</em> menu copies the <code>zig fetch</code> command for that release.",
      },
      {
        q: "What happens with fields whose type can't be inferred?",
        a: "They become <code>?serde.Value = null</code>. serde.zig reads <code>null</code> into it but doesn't parse arbitrary input into <code>serde.Value</code>, so zigshape warns and suggests setting a concrete type.",
      },
    ],
    related: ["json-to-zig-struct", "yaml-to-serde-zig", "toon-to-zig-struct"],
  },
  {
    slug: "yaml-to-zig-struct",
    format: "yaml",
    target: "plain",
    preset: "strict",
    name: "YAML to Zig struct",
    title: "YAML to Zig Struct Converter · zigshape",
    description:
      "Turn YAML configs into Zig structs. Anchors, aliases and merge keys are resolved, comments become doc comments and observed values can become defaults.",
    h1: "YAML to Zig struct",
    lede:
      "Paste a YAML config and zigshape produces a Zig struct for it. The <em>Strict config</em> preset turns observed scalars into field defaults, so a missing key still yields a usable value.",
    example: { id: "seo-yaml", label: "YAML sample", format: "yaml", rootName: "Config", target: "plain", samples: [configYaml] },
    pointsTitle: "YAML details zigshape handles",
    points: [
      "Anchors, aliases and <code>&lt;&lt;</code> merge keys resolve before inference, so the struct reflects the effective document.",
      "YAML 1.2 scalars: <code>yes</code> and <code>no</code> stay strings, matching serde.zig's default reader.",
      "Key comments become <code>///</code> doc comments with <em>Doc comments from YAML</em> in Options.",
      "Multi-document YAML uses the first document and says so.",
    ],
    faq: [
      {
        q: "How do I read YAML in Zig?",
        a: `The standard library has no YAML parser. Use ${SERDE}: switch the target to serde.zig and call <code>serde.yaml.fromSliceManaged(Config, allocator, input)</code>.`,
      },
      {
        q: "Are YAML anchors and merge keys supported?",
        a: "Yes. They are resolved before types are inferred, so a merged map produces one struct with every inherited field.",
      },
      {
        q: "Can I keep the comments from my YAML?",
        a: "Turn on <em>Doc comments from YAML</em> in Options (or pass <code>--with-doc-comments</code> to the CLI) and each commented key gets a <code>///</code> line.",
      },
    ],
    related: ["yaml-to-serde-zig", "toml-to-zig-struct", "zon-to-zig-struct"],
  },
  {
    slug: "yaml-to-serde-zig",
    format: "yaml",
    target: "serde-zig",
    preset: "strict",
    name: "YAML to serde.zig",
    title: "YAML to serde.zig Structs · zigshape",
    description:
      "Generate serde.zig-ready Zig structs from YAML, with rename rules, observed defaults and a serde.yaml parse helper. Free and local.",
    h1: "YAML to serde.zig",
    lede: `YAML configs become Zig structs annotated for ${SERDE}. Anchors and merge keys resolve first, so the decoration reflects the document serde.zig will actually read.`,
    example: { id: "seo-yaml-serde", label: "YAML sample", format: "yaml", rootName: "Config", target: "serde-zig", samples: [configYaml] },
    pointsTitle: "What you get",
    points: [
      "snake_case fields with <code>.rename_all</code> for camelCase or kebab-case keys.",
      "Observed values as defaults with the <em>Strict config</em> preset.",
      "A <code>serde.yaml.fromSliceManaged</code> helper and a test scaffold from the <em>More</em> menu.",
    ],
    faq: [
      {
        q: "Does serde.zig treat yes/no as booleans?",
        a: "Not by default: it follows YAML 1.2, where <code>yes</code> and <code>no</code> are strings. zigshape infers them the same way.",
      },
      {
        q: "Why are integers typed u8 or u16?",
        a: "The API preset picks the smallest width that fits the samples. The Strict preset used here picks <code>u64</code>; you can also choose the strategy in Options.",
      },
    ],
    related: ["yaml-to-zig-struct", "json-to-serde-zig", "toml-to-serde-zig"],
  },
  {
    slug: "toml-to-zig-struct",
    format: "toml",
    target: "plain",
    preset: "strict",
    name: "TOML to Zig struct",
    title: "TOML to Zig Struct Converter · zigshape",
    description:
      "Convert TOML config files to Zig structs: tables become nested structs, arrays of tables become slices, observed values become defaults. In your browser.",
    h1: "TOML to Zig struct",
    lede:
      "TOML configs convert into Zig structs. The <em>Strict config</em> preset turns observed scalar values into Zig defaults, so missing keys still produce a usable struct.",
    example: { id: "seo-toml", label: "TOML sample", format: "toml", rootName: "Config", target: "plain", samples: [configToml] },
    pointsTitle: "TOML structures zigshape handles",
    points: [
      "Top-level keys and <code>[tables]</code> become fields and nested structs.",
      "Inline tables become nested structs too.",
      "<code>[[arrays of tables]]</code> become slices of a generated struct.",
      "Dates come through as <code>[]const u8</code>.",
    ],
    faq: [
      {
        q: "How do I parse TOML in Zig?",
        a: `Use ${SERDE}: <code>serde.toml.fromSliceManaged(Config, allocator, input)</code>. serde.zig expects a table at the root, which is what a TOML file is.`,
      },
      {
        q: "Are large integers supported?",
        a: "serde.zig parses TOML integers as <code>i64</code>, so values above its range can't be read even when the field is <code>u64</code>.",
      },
    ],
    related: ["toml-to-serde-zig", "zon-to-zig-struct", "yaml-to-zig-struct"],
  },
  {
    slug: "toml-to-serde-zig",
    format: "toml",
    target: "serde-zig",
    preset: "strict",
    name: "TOML to serde.zig",
    title: "TOML to serde.zig Structs · zigshape",
    description:
      "Generate Zig structs decorated for serde.zig from TOML: rename rules, deny_unknown_fields and observed defaults, with a serde.toml parse helper.",
    h1: "TOML to serde.zig",
    lede: `TOML configs turn into Zig structs annotated for ${SERDE}. Use <code>deny_unknown_fields</code> from Options to reject typos in config keys.`,
    example: { id: "seo-toml-serde", label: "TOML sample", format: "toml", rootName: "Config", target: "serde-zig", samples: [configToml] },
    pointsTitle: "What you get",
    points: [
      "Nested structs for every table, slices for arrays of tables.",
      "Defaults from observed values with the Strict preset.",
      "<code>.deny_unknown_fields = true</code> on every struct when you turn it on.",
    ],
    faq: [
      {
        q: "Can serde.zig reject unknown config keys?",
        a: "Yes. Enable <em>deny_unknown_fields</em> in Options and parsing fails with <code>error.UnknownField</code> on any key the struct doesn't declare.",
      },
    ],
    related: ["toml-to-zig-struct", "yaml-to-serde-zig", "zon-to-zig-struct"],
  },
  {
    slug: "xml-to-zig-struct",
    format: "xml",
    target: "serde-zig",
    preset: "api",
    name: "XML to Zig struct",
    title: "XML to Zig Struct Converter · zigshape",
    description:
      "Convert XML documents to Zig structs: attributes vs elements, xml_root and namespace prefixes for serde.zig, numbers typed only when they round-trip.",
    h1: "XML to Zig struct",
    lede: `Paste an XML document and zigshape produces Zig structs with <code>xml_root</code> and <code>xml_attribute</code> decoration for ${SERDE}.`,
    example: { id: "seo-xml", label: "XML sample", format: "xml", rootName: "User", target: "serde-zig", samples: [userXml] },
    pointsTitle: "What zigshape does with XML",
    points: [
      "Attributes are listed in <code>.xml_attribute</code>; child elements become fields.",
      "Namespace prefixes stay on the wire: <code>soap:Body</code> becomes a <code>body</code> field with <code>.rename</code>.",
      "Text is typed as a number only when it parses back (<code>2.0</code> is a float, <code>02134</code> stays a string).",
      "Text inside an element that also has attributes becomes an optional <code>value</code> field, because serde.zig skips that text.",
    ],
    faq: [
      {
        q: "How do I parse XML in Zig?",
        a: "With serde.zig: <code>serde.xml.fromSliceManaged(User, allocator, input)</code>. The root element is matched against <code>.xml_root</code>.",
      },
      {
        q: "Are XML namespaces supported?",
        a: "Prefixed names are kept as the wire names serde.zig matches, and <code>xmlns</code> declarations are ignored rather than turned into fields.",
      },
    ],
    related: ["xml-to-serde-zig", "json-to-serde-zig", "csv-to-zig-struct"],
  },
  {
    slug: "xml-to-serde-zig",
    format: "xml",
    target: "serde-zig",
    preset: "api",
    name: "XML to serde.zig",
    title: "XML to serde.zig Structs: xml_root, xml_attribute · zigshape",
    description:
      "Generate serde.zig structs from XML with xml_root for the document element and xml_attribute for attributes. Free, runs in your browser.",
    h1: "XML to serde.zig",
    lede: `XML documents convert to Zig structs annotated for ${SERDE}, including <code>xml_root</code> for the document element and <code>xml_attribute</code> for fields that came from attributes.`,
    example: { id: "seo-xml-serde", label: "XML sample", format: "xml", rootName: "User", target: "serde-zig", samples: [userXml] },
    pointsTitle: "serde.zig XML options zigshape emits",
    points: [
      "<code>.xml_root = \"user\"</code> on the root struct.",
      "<code>.xml_attribute = .{ .id }</code> for attribute fields.",
      "<code>.rename</code> for prefixed or non-snake_case element names.",
    ],
    faq: [
      {
        q: "Does serde.zig read mixed content?",
        a: "No. serde.zig 1.2.3 skips text in an element that also has attributes or children, so zigshape makes that field optional and adds a note.",
      },
    ],
    related: ["xml-to-zig-struct", "toon-to-zig-struct", "json-to-serde-zig"],
  },
  {
    slug: "csv-to-zig-struct",
    format: "csv",
    target: "serde-zig",
    preset: "api",
    name: "CSV to Zig struct",
    title: "CSV to Zig Struct Converter (serde.zig) · zigshape",
    description:
      "Turn a CSV file with a header row into a Zig row struct. Column types come from every row; empty cells make a column optional. Parse with serde.csv.",
    h1: "CSV to Zig struct",
    lede: `Paste a CSV with a header row. Every row is treated as a sample, so column types reflect the whole file, and the result parses with ${SERDE} as a slice of rows.`,
    example: {
      id: "seo-csv",
      label: "CSV sample",
      format: "csv",
      rootName: "Order",
      target: "serde-zig",
      samples: [`id,customer,total,paid,shipped_at
1001,Alice,49.90,true,2026-03-02
1002,"Bob, Jr.",12.5,false,
1003,Carol,230,true,2026-03-04
`],
    },
    pointsTitle: "How CSV columns become fields",
    points: [
      "The header row names the fields; each data row is one observation.",
      "An empty unquoted cell makes the column optional, which is what serde.zig's CSV reader needs to accept it.",
      "Quoted cells stay strings; unquoted cells become integers, floats or booleans only when every value parses.",
      "Rows shorter than the header are reported, because serde.zig rejects them by default.",
    ],
    faq: [
      {
        q: "How do I read a CSV file in Zig?",
        a: "With serde.zig: <code>serde.csv.fromSliceManaged([]const Order, allocator, input)</code> returns every row. The <em>More</em> menu copies this helper.",
      },
      {
        q: "Why is a column optional?",
        a: "At least one row left it empty. Click the field in the table to see how many rows had a value.",
      },
    ],
    related: ["json-to-zig-struct", "toon-to-zig-struct", "ndjson-to-zig-struct"],
  },
  {
    slug: "zon-to-zig-struct",
    format: "zon",
    target: "plain",
    preset: "api",
    name: "ZON to Zig struct",
    title: "ZON to Zig Struct: types for build.zig.zon and configs · zigshape",
    description:
      "Generate Zig types for ZON files such as build.zig.zon or app configs. Enum literals become enums, tuples become slices; read them with std.zon.parse.",
    h1: "ZON to Zig struct",
    lede:
      "Paste a ZON file and zigshape writes the Zig type that <code>std.zon.parse</code> reads it into. Enum literals like <code>.info</code> become a Zig enum, so the struct stays typed end to end.",
    example: {
      id: "seo-zon",
      label: "ZON sample",
      format: "zon",
      rootName: "Config",
      target: "plain",
      samples: [`.{
    .name = "invoice-worker",
    .log_level = .info,
    .concurrency = 4,
    .queues = .{ "invoices", "receipts" },
    .database = .{ .host = "localhost", .port = 5432 },
}
`],
    },
    pointsTitle: "How ZON maps to Zig",
    points: [
      "<code>.{ .field = value }</code> becomes a struct, <code>.{ a, b }</code> a slice.",
      "Enum literals become an enum whose variants keep their exact spelling.",
      "Hex, octal and binary integers, character literals and <code>\\\\</code> multiline strings are all understood.",
      "With the serde.zig target, zigshape warns about comments, non-decimal integers and multiline strings, which serde.zig 1.2.3's ZON reader rejects.",
    ],
    faq: [
      {
        q: "How do I parse ZON at runtime?",
        a: "Call <code>std.zon.parse.fromSlice</code> with the generated type. Its options changed between Zig releases, so check the signature for your version.",
      },
      {
        q: "Can I generate types for build.zig.zon?",
        a: "Yes. Paste it as is; <code>.name = .my_package</code> becomes an enum and <code>.dependencies</code> a nested struct.",
      },
    ],
    related: ["toml-to-zig-struct", "yaml-to-zig-struct", "json-to-zig-struct"],
  },
  {
    slug: "toon-to-zig-struct",
    format: "toon",
    target: "serde-zig",
    preset: "api",
    name: "TOON to Zig struct",
    title: "TOON to Zig Struct Converter (serde.zig) · zigshape",
    description:
      "Generate Zig structs from TOON (Token-Oriented Object Notation). Tabular arrays become slices of structs; parse with serde.toon. Runs in your browser.",
    h1: "TOON to Zig struct",
    lede: `Paste a TOON document. zigshape decodes it with the reference implementation and writes Zig structs that ${SERDE} reads with <code>serde.toon</code>.`,
    example: {
      id: "seo-toon",
      label: "TOON sample",
      format: "toon",
      rootName: "Directory",
      target: "serde-zig",
      samples: [`users[3]{id,name,role,active}:
  1,Alice,admin,true
  2,Bob,editor,false
  3,Carol,viewer,true
page: 1
`],
    },
    pointsTitle: "How TOON maps to Zig",
    points: [
      "Tabular arrays like <code>users[3]{id,name}:</code> become a slice of a generated struct.",
      "Inline arrays like <code>tags[2]: a,b</code> become slices of scalars.",
      "Indented objects become nested structs, as with YAML.",
    ],
    faq: [
      {
        q: "How do I parse TOON in Zig?",
        a: "<code>serde.toon.fromSliceManaged(Directory, allocator, input)</code> from serde.zig.",
      },
      {
        q: "How is TOON told apart from YAML?",
        a: "By its array headers such as <code>items[2]:</code>. A TOON document without one reads the same as YAML, so either format gives the same struct.",
      },
    ],
    related: ["json-to-serde-zig", "csv-to-zig-struct", "yaml-to-serde-zig"],
  },
  {
    slug: "ndjson-to-zig-struct",
    format: "ndjson",
    target: "plain",
    preset: "api",
    name: "NDJSON to Zig struct",
    title: "NDJSON / JSON Lines to Zig Struct · zigshape",
    description:
      "Generate one Zig struct from NDJSON or JSON Lines logs. Every line is a sample, so fields missing on some lines become optional.",
    h1: "NDJSON to Zig struct",
    lede:
      "Paste newline-delimited JSON such as log lines or event streams. Every line counts as a sample, so one struct covers all of them.",
    example: {
      id: "seo-ndjson",
      label: "NDJSON sample",
      format: "ndjson",
      rootName: "Event",
      target: "plain",
      samples: [`{"level":"info","msg":"started","ts":1767225600}
{"level":"warn","msg":"slow query","ts":1767225601,"ms":840}
{"level":"info","msg":"done","ts":1767225602}
`],
    },
    pointsTitle: "How lines become one struct",
    points: [
      "Each line is parsed and observed on its own.",
      "Keys present on only some lines become <code>?T = null</code>.",
      "The parse helper reads one line; serde.zig's <code>StreamingDeserializer</code> handles whole streams.",
    ],
    faq: [
      {
        q: "How do I parse NDJSON in Zig?",
        a: "Split the input on newlines and parse each line with <code>std.json.parseFromSlice(Event, allocator, line, .{})</code>, or use <code>serde.helpers.StreamingDeserializer(Event)</code> with a reader.",
      },
    ],
    related: ["json-to-zig-struct", "csv-to-zig-struct", "json-to-serde-zig"],
  },
];

export const PAGE_BY_SLUG = new Map(PAGES.map((p) => [p.slug, p]));
