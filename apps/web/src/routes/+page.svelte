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

<main class="page">
  <header class="intro">
    <h1>Zig structs from real-world data</h1>
    <p>
      Paste JSON, YAML, TOML or XML. zigshape infers types across every sample, explains each decision,
      and emits plain Zig or structs ready for
      <a href="https://github.com/OrlovEvgeny/serde.zig" target="_blank" rel="noopener noreferrer">serde.zig</a>.
    </p>
  </header>

  <Playground />

  <section class="prose features">
    <div>
      <h2>Inference across samples</h2>
      <p>Add several payloads of the same shape. Fields missing or null in any of them become optional, and integer widths fit the observed range.</p>
    </div>
    <div>
      <h2>Every decision explained</h2>
      <p>The field table shows how often each key appeared, which value kinds were seen, and where it sits in the input. Override any type in place.</p>
    </div>
    <div>
      <h2>serde.zig aware</h2>
      <p>Detects <code>rename_all</code>, collapses aliases, tags unions and marks XML attributes, so the output parses without hand edits.</p>
    </div>
  </section>
</main>

<style>
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px 32px;
    max-width: none;
  }
  .features p {
    margin: 0;
    font-size: 13px;
  }
</style>
