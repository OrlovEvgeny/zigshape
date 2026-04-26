<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import { XML_DEFAULT } from "$lib/format-examples";
</script>

<svelte:head>
  <title>XML to serde.zig — zigshape</title>
  <meta
    name="description"
    content="Generate Zig structs decorated for serde.zig from XML: xml_root, xml_attribute, namespace warnings, mixed-content fallback. Runs in your browser."
  />
  <meta property="og:title" content="XML to serde.zig" />
  <meta property="og:description" content="XML to Zig structs with first-class serde.zig decoration." />
  <link rel="canonical" href="https://zigshape.dev/xml-to-serde-zig" />
</svelte:head>

<main>
  <header>
    <h1>XML to serde.zig</h1>
    <p class="tagline">
      XML documents convert to Zig structs annotated for
      <a href="https://github.com/getty-zig/serde.zig">serde.zig</a> — including
      <code>xml_root</code> for the document tag and <code>xml_attribute</code> for fields that came in
      as attributes rather than child elements.
    </p>
  </header>

  <Playground initialFormat="xml" initialTarget="serde-zig" initialPreset="api" initialExample={XML_DEFAULT} />

  <footer><small>Local-first. Your input never leaves the browser.</small></footer>
</main>

<style>
  :global(body) { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #222; background: #fafafa; }
  main { max-width: 1200px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; min-height: 100vh; box-sizing: border-box; }
  header h1 { margin: 0; font-size: 1.5rem; }
  .tagline { margin: 0.25rem 0 1rem; color: #666; max-width: 70ch; }
  .tagline a { color: #2a6; }
  footer { margin-top: 2rem; color: #888; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.9em; background: #eef; padding: 0 0.25rem; border-radius: 2px; }
</style>
