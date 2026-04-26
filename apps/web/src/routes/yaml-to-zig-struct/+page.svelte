<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import { YAML_DEFAULT } from "$lib/format-examples";
</script>

<svelte:head>
  <title>YAML to Zig Struct — zigshape</title>
  <meta
    name="description"
    content="Convert YAML configs to idiomatic Zig structs. Anchors, aliases, and merge keys are resolved; observed scalar values become Zig defaults. Runs in your browser."
  />
  <meta property="og:title" content="YAML to Zig Struct" />
  <meta property="og:description" content="Generate idiomatic Zig structs from YAML, in your browser." />
  <link rel="canonical" href="https://zigshape.dev/yaml-to-zig-struct" />
</svelte:head>

<main>
  <header>
    <h1>YAML to Zig Struct</h1>
    <p class="tagline">
      Paste a YAML config and zigshape produces an idiomatic Zig struct.
      Anchors, aliases, and <code>&lt;&lt;</code> merge keys are resolved; the <em>Strict config</em> preset turns
      observed scalars into <code>const</code> defaults.
    </p>
  </header>

  <Playground initialFormat="yaml" initialTarget="plain" initialPreset="strict" initialExample={YAML_DEFAULT} />

  <section class="explainer">
    <h2>YAML quirks zigshape handles</h2>
    <ul>
      <li>Multi-document YAML uses the first document, with a warning.</li>
      <li>Anchors and aliases are resolved; merge keys (<code>&lt;&lt;: *anchor</code>) flatten into the parent map.</li>
      <li>Date scalars come through as <code>[]const u8</code>; switch to a custom adapter if you need a typed datetime.</li>
      <li>Per-node source ranges flow through to the inspector — click a field to jump to its position in the YAML.</li>
    </ul>
    <p>
      Need <code>serde.zig</code> decoration (rename rules, aliases, <code>deny_unknown_fields</code>)?
      See <a href="/yaml-to-serde-zig">YAML to serde.zig</a>.
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
