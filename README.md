# zigshape

Zig schema/struct generator for real-world data formats. Generates idiomatic Zig structs from JSON, with first-class [`serde.zig`](https://github.com/...) support. Web playground + CLI.

> **Status: v0.1 in progress.** JSON input only. YAML / TOML / XML are roadmap (v0.2 / v0.3).

## Layout

```
apps/
  web/          SvelteKit playground (browser, all client-side)
  cli/          Bun CLI binary
packages/
  core/         Inference pipeline + plain-Zig emitter
  serde-zig/    serde.zig output adapter
```

## Develop

```sh
bun install
bun test               # all packages
bun run dev            # apps/web on http://localhost:5173
bun run cli -- input.json --root User --target serde-zig
```

## Pipeline

```
inputs ─► parse ─► observe ─► infer ─► normalize ─► generate ─► decorate ─► explain
```

See `.claude/plans/` for the v0.1 design notes.
