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

<main class="page">
  <header class="intro">
    <h1>JSON to serde.zig</h1>
    <p>
      The same JSON-to-Zig pipeline, but the output carries a <code>pub const serde = .&lbrace; ... &rbrace;</code>
      block so <a href="https://github.com/OrlovEvgeny/serde.zig">serde.zig</a> can deserialize it directly:
      auto-detected <code>rename_all</code>, alias collapsing for sibling fields that never co-occur, and an
      optional <code>deny_unknown_fields</code> pass from the <em>Options</em> panel.
    </p>
  </header>

  <Playground initialFormat="json" initialTarget="serde-zig" initialPreset="api" initialExample={{ ...JSON_DEFAULT, target: "serde-zig" }} />

  <section class="prose">
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
</main>

