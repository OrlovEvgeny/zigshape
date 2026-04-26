<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import { YAML_DEFAULT } from "$lib/format-examples";
</script>

<svelte:head>
  <title>YAML to serde.zig — zigshape</title>
  <meta
    name="description"
    content="Generate Zig structs decorated for serde.zig from YAML: rename_all, deny_unknown_fields, observed defaults. Runs in your browser."
  />
  <meta property="og:title" content="YAML to serde.zig" />
  <meta property="og:description" content="YAML to Zig structs with first-class serde.zig decoration." />
  <link rel="canonical" href="https://zigshape.dev/yaml-to-serde-zig" />
</svelte:head>

<main>
  <header>
    <h1>YAML to serde.zig</h1>
    <p class="tagline">
      YAML configs turn into Zig structs annotated for <a href="https://github.com/getty-zig/serde.zig">serde.zig</a>.
      Anchors, aliases, and merge keys resolve before inference, so the generated decoration reflects
      the effective document, not the raw text.
    </p>
  </header>

  <Playground initialFormat="yaml" initialTarget="serde-zig" initialPreset="strict" initialExample={{ ...YAML_DEFAULT, target: "serde-zig" }} />

  <footer><small>Local-first. Your input never leaves the browser.</small></footer>
</main>

<style>
  :global(body) { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #222; background: #fafafa; }
  main { max-width: 1200px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; min-height: 100vh; box-sizing: border-box; }
  header h1 { margin: 0; font-size: 1.5rem; }
  .tagline { margin: 0.25rem 0 1rem; color: #666; max-width: 70ch; }
  .explainer a { color: #2a6; }
  footer { margin-top: 2rem; color: #888; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.9em; background: #eef; padding: 0 0.25rem; border-radius: 2px; }
</style>
