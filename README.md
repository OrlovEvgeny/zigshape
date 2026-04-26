# zigshape

Zig schema/struct generator for real-world data formats. Generates idiomatic Zig structs from JSON, YAML and TOML, with first-class `serde.zig` support. Web playground + CLI.

> **Status: v0.2 — multi-format input, smarter inference.** XML is roadmap (v0.3); VS Code extension is v0.4.

## Layout

```
apps/
  web/          SvelteKit playground (browser, all client-side)
  cli/          Bun CLI binary
packages/
  core/         Inference pipeline + plain-Zig emitter
  serde-zig/    serde.zig output adapter
```

## Supported formats (v0.2)

| Format | Status | Notes |
|--------|--------|-------|
| JSON   | full   | JSONC tolerated. Source ranges plumbed through to the field inspector. |
| YAML   | full   | Anchors, aliases and `<<` merge keys resolved. Multi-document warns + uses first. |
| TOML   | full   | Tables, arrays of tables, inline tables. Source ranges are whole-document only (smol-toml limitation). |
| XML    | v0.3   | Planned with `xml_root` / `xml_attribute` mapping. |

Auto-detection works for all three; pass `--format` to override.

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
  [--format auto|json|yaml|toml]      input format; default auto
  [--int smallest|u64|i64]            integer width strategy; default smallest
  [--enums auto|off|always]           enum suggestion; default auto
  [--unions off|tagged]               tagged-union inference; default off
  [--defaults-from-samples]           emit observed scalar values as defaults
  [--zig-fmt]                         pipe output through WASM zig fmt
  [--root NAME]                       root struct name; default Root
  [--target plain|serde-zig]          codegen target; default plain
  [--out PATH]                        write to PATH instead of stdout
  [--stdin]                           read sample from stdin
```

Several files merge as samples of the same shape — fields appearing in only some samples become `?T = null`.

## Web playground

The toolbar exposes the same options as **presets**: *API response* (smallest int + auto enums), *Strict config* (u64 + defaults-from-samples), *Loose schema* (everything wide). Format auto-detect runs as you type; the dropdown shows what was picked.

WASM zig fmt is CLI-only in v0.2 (Vite bundling for the `@wasm-fmt/zig_fmt` source-phase WASM import is unresolved).

## Pipeline

```
inputs ─► parse ─► observe ─► infer ─► normalize ─► generate ─► decorate ─► explain
```

`packages/core` owns parse → observe → infer → normalize → generate. `packages/serde-zig` is one decorator target; future targets (e.g. `std.json` builder, schema reports) plug in alongside.

See `docs/inference.md` for what triggers each shape decision.

## Roadmap

- v0.3 — XML input with `xml_root` / `xml_attribute`, mixed-content warnings.
- v0.4 — VS Code extension ("Paste JSON as Zig").
- v1.0 — alias detection across samples, schema drift CI, hosted share links, per-field overrides.

Plan files live in `.claude/plans/`.
