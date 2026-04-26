# zigshape

Zig schema/struct generator for real-world data formats. Generates idiomatic Zig structs from JSON, YAML, TOML and XML, with first-class `serde.zig` support. Web playground + CLI + VS Code extension.

> **Status: v1.0 — alias detection, schema-drift CI, editable per-field overrides, share links, VS Code extension, per-format SEO pages.**

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

## Supported formats (v0.3)

| Format | Status | Notes |
|--------|--------|-------|
| JSON   | full   | JSONC tolerated. Source ranges plumbed through to the field inspector. |
| YAML   | full   | Anchors, aliases and `<<` merge keys resolved. Multi-document warns + uses first. |
| TOML   | full   | Tables, arrays of tables, inline tables. Source ranges are whole-document only (smol-toml limitation). |
| XML    | full   | Attributes vs child elements distinguished; `xml_root` / `xml_attribute` emitted on the serde-zig target. Namespace prefixes stripped (warns). Mixed content (attributes + text) emits a `value` field with a TODO comment, since serde.zig doesn't document `xml_text`. Whole-document source ranges only. |

Auto-detection works for all four; pass `--format` to override.

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
zigshape [files...]
  [--format auto|json|yaml|toml|xml]  input format; default auto
  [--int smallest|u64|i64]            integer width strategy; default smallest
  [--strings slice|mut|sentinel]      string wire form; default slice
  [--maps auto|struct|hash-map]       map detection override; default auto
  [--enums auto|off|always]           enum suggestion; default auto
  [--unions off|tagged]               tagged-union inference; default off
  [--aliases auto|off]                cross-sample alias detection; default auto
  [--deny-unknown-fields]             emit serde .deny_unknown_fields = true
  [--defaults-from-samples]           emit observed scalar values as defaults
  [--zig-fmt]                         pipe output through WASM zig fmt
  [--root NAME]                       root struct name; default Root
  [--target plain|serde-zig]          codegen target; default plain
  [--out PATH]                        write to PATH instead of stdout
  [--report PATH]                     write a JSON schema report
  [--check-drift PATH]                exit 3 on breaking drift vs the report
  [--config PATH]                     load defaults + per-field overrides
  [--stdin]                           read sample from stdin
```

Several files merge as samples of the same shape — fields appearing in only some samples become `?T = null`.

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
  "serde": { "denyUnknownFields": true }
}
```

CLI flags always win over config; config fills the gaps. Per-field overrides match by JSON path (`$.user.id`).

## Web playground

The toolbar exposes options as **presets**: *API response* (smallest int + auto enums), *Strict config* (u64 + defaults-from-samples), *Loose schema* (everything wide). Format auto-detect runs as you type; the dropdown shows what was picked.

WASM `zig fmt` runs in the browser via a lazy WASM init. Per-field overrides live in the inspector — click "override…" on any field to edit type / name / optional. Share buttons encode either config-only (`#c=…`) or config + samples (`#s=…`, 8 KB guard) into the URL hash; hashes never leave the browser.

Per-format landing pages: `/json-to-zig-struct`, `/yaml-to-zig-struct`, `/toml-to-zig-struct`, `/xml-to-zig-struct`, plus their `…-to-serde-zig` variants. Each pins format + target + preset and ships SEO meta + JSON-LD.

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

v1.0 shipped: alias detection across samples, schema drift CI, share links, editable per-field overrides, VS Code extension, per-format SEO pages.

Future:
- TOML / XML per-key source ranges (currently whole-document fallback).
- `--rename-all` and `--arrays slice|arraylist|fixed` flags.
- vscode-test integration harness for end-to-end command coverage.

Plan files live in `.claude/plans/`.
