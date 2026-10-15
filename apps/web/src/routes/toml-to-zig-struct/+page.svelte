<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import { TOML_DEFAULT } from "$lib/format-examples";
</script>

<svelte:head>
  <title>TOML to Zig Struct — zigshape</title>
  <meta
    name="description"
    content="Convert TOML configs to idiomatic Zig structs. Tables, arrays of tables, inline tables; observed values become Zig defaults. Runs in your browser."
  />
  <meta property="og:title" content="TOML to Zig Struct" />
  <meta property="og:description" content="Generate idiomatic Zig structs from TOML, in your browser." />
  <link rel="canonical" href="https://zigshape.dev/toml-to-zig-struct" />
</svelte:head>

<main class="page">
  <header class="intro">
    <h1>TOML to Zig Struct</h1>
    <p>
      TOML configs convert into idiomatic Zig structs.  Use the <em>Strict config</em> preset
      to turn observed scalar values into Zig defaults, so missing config keys still produce
      a usable struct.
    </p>
  </header>

  <Playground initialFormat="toml" initialTarget="plain" initialPreset="strict" initialExample={TOML_DEFAULT} />

  <section class="prose">
    <h2>TOML structures zigshape handles</h2>
    <ul>
      <li>Top-level keys and tables become struct fields and nested structs.</li>
      <li>Inline tables flatten into nested structs.</li>
      <li>Arrays of tables become slices of generated structs.</li>
      <li>Date scalars come through as <code>[]const u8</code>.  Custom adapters welcome.</li>
    </ul>
    <p>
      Need rename / deny-unknown-fields? See <a href="/toml-to-serde-zig">TOML to serde.zig</a>.
    </p>
  </section>
</main>

