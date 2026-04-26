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

<main>
  <header>
    <h1>TOML to Zig Struct</h1>
    <p class="tagline">
      TOML configs convert into idiomatic Zig structs.  Use the <em>Strict config</em> preset
      to turn observed scalar values into Zig defaults, so missing config keys still produce
      a usable struct.
    </p>
  </header>

  <Playground initialFormat="toml" initialTarget="plain" initialPreset="strict" initialExample={TOML_DEFAULT} />

  <section class="explainer">
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
