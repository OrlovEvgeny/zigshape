<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import { JSON_DEFAULT } from "$lib/format-examples";
</script>

<svelte:head>
  <title>JSON to serde.zig — zigshape</title>
  <meta
    name="description"
    content="Generate Zig structs decorated for serde.zig from JSON: rename_all, alias detection across samples, deny_unknown_fields. Runs in your browser."
  />
  <meta property="og:title" content="JSON to serde.zig" />
  <meta property="og:description" content="JSON to Zig structs with first-class serde.zig decoration." />
  <link rel="canonical" href="https://zigshape.dev/json-to-serde-zig" />
</svelte:head>

<main>
  <header>
    <h1>JSON to serde.zig</h1>
    <p class="tagline">
      The same JSON-to-Zig pipeline, but the output carries a <code>pub const serde = .&lbrace; ... &rbrace;</code>
      block so <a href="https://github.com/getty-zig/serde.zig">serde.zig</a> can deserialize it directly:
      auto-detected <code>rename_all</code>, alias collapsing for sibling fields that never co-occur, and an
      optional <code>deny_unknown_fields</code> pass via the toolbar's advanced options.
    </p>
  </header>

  <Playground initialFormat="json" initialTarget="serde-zig" initialPreset="api" initialExample={{ ...JSON_DEFAULT, target: "serde-zig" }} />

  <section class="explainer">
    <h2>serde.zig knobs zigshape emits</h2>
    <ul>
      <li><code>rename_all</code> when one naming convention round-trips every field.</li>
      <li>Per-field <code>rename</code> when conventions don't fit (mixed casing, reserved keywords, escaped identifiers).</li>
      <li><code>alias</code> for sibling fields that share a shape and never co-occur in the same sample.</li>
      <li>Tagged-union <code>tag</code> / <code>tag_field</code> when a discriminator string is present in every variant.</li>
    </ul>
    <p>
      Plain <code>std.json</code>-only output? Use <a href="/json-to-zig-struct">JSON to Zig Struct</a>.
    </p>
  </section>

  <footer><small>Local-first. Your input never leaves the browser.</small></footer>
</main>

<style>
  :global(body) { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #222; background: #fafafa; }
  main { max-width: 1200px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; min-height: 100vh; box-sizing: border-box; }
  header h1 { margin: 0; font-size: 1.5rem; }
  .tagline { margin: 0.25rem 0 1rem; color: #666; max-width: 70ch; }
  .explainer { margin-top: 2rem; max-width: 70ch; color: #333; }
  .explainer h2 { font-size: 1rem; margin: 0 0 0.5rem; }
  .explainer ul { margin: 0 0 1rem 1rem; padding: 0; }
  .explainer li { margin-bottom: 0.35rem; line-height: 1.45; }
  .explainer a { color: #2a6; }
  footer { margin-top: 2rem; color: #888; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.9em; background: #eef; padding: 0 0.25rem; border-radius: 2px; }
</style>
