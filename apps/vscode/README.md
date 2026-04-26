# ZigShape for VS Code

Generate idiomatic Zig structs from JSON, YAML, TOML, and XML — with first-class `serde.zig` support.

## Commands

| Command | What it does |
|---------|--------------|
| **ZigShape: Paste Clipboard as Zig Struct** | Reads the clipboard, infers a Zig struct, and inserts it at the cursor. |
| **ZigShape: Generate Zig Struct from Current File** | Infers from the active file (or a file picked from the explorer context menu) and opens a new untitled `.zig` document with the result. |
| **ZigShape: Generate Zig Struct from Multiple Files** | Pick multiple files via a dialog. They're merged as samples of the same shape, so fields that appear in only some samples become `?T = null`. |

## Settings

- `zigshape.target` — `plain` (default) or `serde-zig`. Plain emits `std.json`-compatible structs; `serde-zig` adds `rename`, `alias`, `xml_root`, `xml_attribute`, and union-tag decoration.
- `zigshape.preset` — `api` (default) / `strict` / `loose`. Bundles inference knobs for typical use cases.
- `zigshape.rootName` — root struct name. Default `Root`.
- `zigshape.intStrategy` — `smallest` (default) / `u64` / `i64`.
- `zigshape.aliases` — `auto` (default) / `off`. Cross-sample alias detection.
- `zigshape.denyUnknownFields` — emit `.deny_unknown_fields = true` on every struct (serde-zig target only).

## Privacy

Every conversion runs locally inside the extension host. No data leaves your machine.
