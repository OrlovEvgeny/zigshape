<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import { JSON_DEFAULT } from "$lib/format-examples";
</script>

<svelte:head>
  <title>JSON to Zig Struct — zigshape</title>
  <meta
    name="description"
    content="Convert JSON to idiomatic Zig structs. Multi-sample inference, optional fields where data is missing, std.json.Value fallback for heterogeneous data. Runs in your browser."
  />
  <meta property="og:title" content="JSON to Zig Struct" />
  <meta property="og:description" content="Generate idiomatic Zig structs from JSON, in your browser." />
  <link rel="canonical" href="https://zigshape.dev/json-to-zig-struct" />
</svelte:head>

<main>
  <header>
    <h1>JSON to Zig Struct</h1>
    <p class="tagline">
      Paste a JSON document or several samples and zigshape produces an idiomatic Zig struct.
      Fields missing from some samples become <code>?T = null</code>; integer widths fit the observed range.
    </p>
  </header>

  <Playground initialFormat="json" initialTarget="plain" initialPreset="api" initialExample={JSON_DEFAULT} />

  <section class="explainer">
    <h2>What zigshape decides</h2>
    <ul>
      <li>Smallest unsigned int width that fits every observed value (override with the <em>Strict</em> preset for <code>u64</code>).</li>
      <li>Optional fields when data is missing or <code>null</code> in any sample.</li>
      <li><code>std.StringHashMap</code> when an object's keys look dynamic and values share a shape.</li>
      <li><code>std.json.Value</code> fallback for heterogeneous fields, with a warning explaining why.</li>
    </ul>
    <p>
      For the <code>serde.zig</code>-decorated form (with <code>rename_all</code>, <code>alias</code>, <code>deny_unknown_fields</code>),
      see <a href="/json-to-serde-zig">JSON to serde.zig</a>.
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
