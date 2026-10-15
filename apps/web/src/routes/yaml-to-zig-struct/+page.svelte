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

<main class="page">
  <header class="intro">
    <h1>YAML to Zig Struct</h1>
    <p>
      Paste a YAML config and zigshape produces an idiomatic Zig struct.
      Anchors, aliases, and <code>&lt;&lt;</code> merge keys are resolved; the <em>Strict config</em> preset turns
      observed scalars into <code>const</code> defaults.
    </p>
  </header>

  <Playground initialFormat="yaml" initialTarget="plain" initialPreset="strict" initialExample={YAML_DEFAULT} />

  <section class="prose">
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
</main>

