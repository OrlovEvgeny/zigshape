# zigshape

Zig schema/struct generator for real-world data formats. Generates Zig structs from JSON, NDJSON, YAML, TOML, XML, CSV, ZON and TOON that `std.json` (plain target) or [serde.zig](https://github.com/OrlovEvgeny/serde.zig) 1.2.3 (serde-zig target) parse as-is. Web playground + CLI + VS Code extension.

> **Status: serde.zig 1.2.3 compatible output, CSV / ZON / TOON inputs, std.json-parseable plain target.**

## Layout

```
apps/
  web/          SvelteKit playground (browser, all client-side)
  cli/          Bun CLI binary
  vscode/       VS Code extension (apps/vscode/)
packages/
  core/         Inference pipeline + plain-Zig emitter
  serde-zig/    serde.zig output adapter
```

## Supported formats

| Format | Notes |
|--------|-------|
| JSON   | JSONC tolerated. Source ranges plumbed through to the field inspector. |
| NDJSON | Every line is a sample. The parse helper reads one line; serde.zig's `StreamingDeserializer` handles streams. |
| YAML   | Anchors, aliases and `<<` merge keys resolved. YAML 1.2 scalars (`yes`/`no` stay strings, as in serde.zig). Multi-document warns + uses first. |
| TOML   | Tables, arrays of tables, inline tables. Source ranges are whole-document only (smol-toml limitation). |
| XML    | Attributes vs child elements distinguished; `xml_root` / `xml_attribute` on the serde-zig target. Namespace prefixes are kept as wire names (`soap:Body` → field `body` + `.rename`); `xmlns` declarations are ignored. Text becomes a number only when it round-trips (`2.0` → f64, `02134` stays a string). Text in an element that also has attributes becomes an optional `value` field, because serde.zig skips it. |
| CSV    | Header row names the fields; every row is a sample, so a column empty in some rows becomes optional. Typed the way serde.zig reads cells (quoted → string). The document parses as `[]const Row`. |
| ZON    | `.{ .a = 1 }` → struct, `.{ 1, 2 }` → slice, enum literals → an enum with the literal spellings. Hex/octal/binary ints, chars and `\\` multiline strings understood. Plain output reads with `std.zon.parse`. |
| TOON   | Decoded with the reference implementation (`@toon-format/toon`); tabular arrays become slices of structs. Whole-document source ranges only. |

Auto-detection covers every format; pass `--format` to override.

### Targets

- **plain** — `std.json`-compatible: field names are the wire keys (`@"first-name"` when needed), maps are `std.json.ArrayHashMap(V)`, no alias merging, fallback `std.json.Value`. `--field-names snake_case` restores converted names if you map them yourself.
- **serde-zig** — snake_case fields with a `pub const serde = .{ ... }` block (`rename_all`, `rename`, `alias`, `flatten`, `skip`, `tag`, `xml_root`, ...), written with enum literals (`.rename_all = .camel_case`) because a reference to the `serde` module inside a struct that declares `pub const serde` doesn't compile. Maps are `std.StringHashMap(V)`, fallback `?serde.Value`.

### serde.zig 1.2.3 limitations zigshape warns about

- `std.json.Value` fields can't be deserialized (`serde.unsupported_json_value`).
- `[]u8` / `[:0]const u8` fields don't compile: every string is read as `[]const u8` (`serde.unsupported_string`).
- `serde.Value` is built from typed values, not parsed from input: such a field accepts only `null` (`serde.value_null_only` / `serde.value_unparseable`).
- The ZON reader rejects comments, non-decimal integers and multiline strings (`parse.zon_serde_compat`).
- XML text next to attributes or children is skipped (optional `value` field, see above).
- `std.ArrayList` has no built-in mapping in serde.zig or std.json (`normalize.arraylist_unparseable`).

## Develop

```sh
bun install
bun test                                            # all packages
bun run dev                                         # apps/web on http://localhost:5173
bun run build:web                                   # static build to apps/web/build
bun apps/cli/src/main.ts <file> --root User --target serde-zig
```

> `bun --cwd <path> run <script>` (space-separated) is parsed as a script
> literally named `<path>` and just prints help. Use the `=` form
> (`bun --cwd=apps/web run dev`) or the workspace filter
> (`bun run --filter '@zigshape/web' dev`).

## CLI flags

```
zigshape [files-or-urls...]
  [--format auto|json|ndjson|yaml|toml|xml|csv|zon|toon]
                                      input format; default auto
  [--samples-from-array]              treat each top-level array item as a sample
  [--int smallest|u64|i64|usize]      integer width strategy; default smallest
                                      (usize uses isize for negative obs.)
  [--strings slice|mut|sentinel]      string wire form; default slice
  [--maps auto|struct|hash-map]       map detection override; default auto
  [--arrays slice|arraylist|fixed]    array codegen strategy; default slice
  [--unknown CONV]                    fallback for shapes inference can't pin
                                      down (only-null, mixed scalars). CONV
                                      is std-json-value (plain default),
                                      serde-value (serde-zig default),
                                      string, or compile-error.
  [--field-names snake_case|wire]     field identifiers; default wire for
                                      plain (std.json matches keys
                                      literally), snake_case for serde-zig
  [--enums auto|off|always]           enum suggestion; default auto
  [--unions off|internal|external|adjacent|untagged]
                                      tagged-union inference + serde tagging
                                      style; default off
  [--aliases auto|off]                cross-sample alias detection (serde.zig
                                      alias); default auto for serde-zig,
                                      off for plain
  [--rename-all CONV]                 force serde naming convention (auto,
                                      none, snake_case, camel_case,
                                      pascal_case, kebab_case,
                                      screaming_snake); default auto
  [--deny-unknown-fields]             emit serde .deny_unknown_fields = true
  [--defaults-from-samples]           emit observed scalar values as defaults
  [--zig-fmt]                         pipe output through WASM zig fmt
  [--root NAME]                       root struct name; default Root
  [--target plain|serde-zig]          codegen target; default plain
  [--out PATH]                        write to PATH instead of stdout
  [--report PATH]                     write a JSON schema report
  [--check-drift PATH]                exit 3 on breaking drift vs the report
  [--config PATH]                     load defaults + per-field overrides
  [--with-parser]                     append a parse<Root>(allocator, input)
                                      helper that wraps std.json or
                                      serde.<format>.fromSliceManaged
  [--with-tests]                      append a test "parse <Root>" scaffold
  [--with-build-snippet]              prepend a build.zig comment block with
                                      dependency wiring
  [--with-doc-comments]               surface YAML key comments as ///
                                      doc comments above the matching fields
  [--stdin]                           read sample from stdin
```

Several files merge as samples of the same shape — fields appearing in only some samples become `?T = null`. Arguments matching `https?://…` are fetched at runtime, so `zigshape https://api.example.com/user --root User` works directly. Directory args are walked recursively and every file matching the active `--format` extension(s) is added as a sample (`zigshape ./samples/ --format json --root ApiResponse`).

## Schema reports + drift CI

```sh
zigshape samples/api.json --report schema.json
zigshape samples/api-v2.json --check-drift schema.json   # exit 3 on breaking change
```

`--check-drift` treats type changes, removed fields, required → nullable transitions, and alias removals as breaking; additions and nullable → required as compatible.

## Config file (`zigshape.json`)

```json
{
  "options": { "intStrategy": "smallest", "denyUnknownFields": true },
  "overrides": { "$.user.id": { "type": "[]const u8" } },
  "serde": {
    "denyUnknownFields": true,
    "flattenPaths": ["$.profile"],
    "skipPaths": ["$.email"]
  }
}
```

CLI flags always win over config; config fills the gaps. Per-field overrides match by JSON path (`$.user.id`). `serde.flattenPaths` emits `.flatten = .{ … }` and `serde.skipPaths` emits `.skip = .{ … }` on the parent struct.

## Web playground

The toolbar picks a **preset**: *API response* (smallest int + auto enums), *Strict config* (u64 + defaults-from-samples), *Loose schema* (everything wide), *XML document* (XML-friendly defaults). Format auto-detect runs as you type; the Format dropdown and the input status bar show what was picked along with the heuristic confidence (`Auto · YAML 92%`).

**Options** opens a panel with every inference and serde knob the CLI has (`--int`, `--strings`, `--arrays`, `--maps`, `--enums`, `--unions`, `--unknown`, `--aliases`, `--defaults-from-samples`, `--samples-from-array`, `--rename-all`, `--deny-unknown-fields`, `--with-doc-comments`). Changes are recorded relative to the preset, picking another preset resets them, and the panel footer shows the equivalent `zigshape` command.

Generated Zig is auto-formatted with WASM `zig fmt`; no toggle. Below the editors, **Diagnostics** lists errors and warnings with their sample and `line:col`, and **Field decisions** is a table of every field: type, presence (`observed/total`, required or why optional), observed value kinds, and the wire key. Click a row to highlight it in the input; **Edit** opens the override form (type / name / optional) with one-click alternatives. Share encodes either settings only (`#c=…`) or settings + samples (`#s=…`, 8 KB guard) into the URL hash; hashes never leave the browser.

The output panel's **More** menu exposes four output variants that match the CLI's `--with-*` flags: copy a `parse<Root>` helper, copy a `build.zig` dependency snippet, copy a `test "parse <Root>"` scaffold seeded from the active sample, and download the schema report (the same JSON `--report` writes). Files can be dropped anywhere on the input panel, uploaded, or fetched from a CORS-enabled URL.

**Curl paste**: the active editor recognises a pasted `curl …` command (with or without a leading `$ ` prompt). It extracts the `-d` / `--data` / `--data-raw` payload as the new sample and seeds the root struct name from the URL path's last identifier-like segment (`/v1/users/42` → `User`). Numeric and UUID-shaped path segments are skipped automatically.

Per-format landing pages (`/json-to-zig-struct`, `/csv-to-zig-struct`, `/zon-to-zig-struct`, ... ) are generated from `apps/web/src/lib/pages.ts`, which also drives the sitemap, the footer and each page's FAQ / breadcrumb structured data.

## VS Code extension

`apps/vscode/` ships three commands:
- **ZigShape: Paste Clipboard as Zig Struct** — read clipboard, infer, insert at cursor.
- **ZigShape: Generate Zig Struct from Current File** — explorer / editor context menu.
- **ZigShape: Generate Zig Struct from Multiple Files** — file dialog → merged samples.

Settings cover target, preset, root name, int strategy, aliases, deny-unknown-fields. Build and package:

```sh
bun run --filter zigshape-vscode build
cd apps/vscode && bun run package        # produces zigshape-vscode-0.4.0.vsix
```

## Pipeline

```
inputs ─► parse ─► observe ─► infer ─► normalize ─► generate ─► decorate ─► explain
```

`packages/core` owns parse → observe → infer → normalize → generate. `packages/serde-zig` is one decorator target; future targets (e.g. `std.json` builder, schema reports) plug in alongside.

See `docs/inference.md` for what triggers each shape decision.

## Roadmap

v1.0 shipped: alias detection across samples, schema drift CI, share links, editable per-field overrides, VS Code extension, per-format SEO pages, NDJSON + array-as-samples, URL CLI input, serde flatten/skip via config, kind-breakdown inspector.

Future:
- TOML / XML per-key source ranges (currently whole-document fallback).
- vscode-test integration harness for end-to-end command coverage.

See `docs/limitations.md` for known limits.
