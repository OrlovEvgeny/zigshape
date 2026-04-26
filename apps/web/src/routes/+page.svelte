<script lang="ts">
  import Playground from "$lib/Playground.svelte";
</script>

<svelte:head>
  <title>zigshape — JSON / YAML / TOML / XML to Zig structs</title>
  <meta
    name="description"
    content="Generate idiomatic Zig structs from JSON, YAML, TOML, and XML. Multi-sample inference, explainable per-field decisions, first-class serde.zig output. Local-first, runs in your browser."
  />
  <meta property="og:title" content="zigshape — Zig struct generator" />
  <meta
    property="og:description"
    content="JSON / YAML / TOML / XML → Zig structs with serde.zig support."
  />
</svelte:head>

<main>
  <header>
    <h1>zigshape</h1>
    <p class="tagline">Generate idiomatic Zig structs from JSON, YAML, TOML, and XML. Built for serde.zig.</p>
  </header>

  <Playground />

  <footer>
    <small>Local-first. Your input never leaves the browser.</small>
    <nav>
      <a href="/json-to-zig-struct">JSON</a>
      <a href="/yaml-to-zig-struct">YAML</a>
      <a href="/toml-to-zig-struct">TOML</a>
      <a href="/xml-to-zig-struct">XML</a>
      ·
      <a href="/json-to-serde-zig">JSON serde.zig</a>
      <a href="/yaml-to-serde-zig">YAML serde.zig</a>
      <a href="/toml-to-serde-zig">TOML serde.zig</a>
      <a href="/xml-to-serde-zig">XML serde.zig</a>
    </nav>
  </footer>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #222;
    background: #fafafa;
  }
  main { max-width: 1200px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; min-height: 100vh; box-sizing: border-box; }
  header h1 { margin: 0; font-size: 1.5rem; }
  .tagline { margin: 0.25rem 0 1rem; color: #666; }
  footer { margin-top: 2rem; color: #888; }
  footer nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 0.5rem;
    font-size: 0.8rem;
  }
  footer nav a { color: #2a6; text-decoration: none; }
  footer nav a:hover { text-decoration: underline; }
</style>
