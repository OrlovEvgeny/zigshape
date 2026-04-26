<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import { XML_DEFAULT } from "$lib/format-examples";
</script>

<svelte:head>
  <title>XML to Zig Struct — zigshape</title>
  <meta
    name="description"
    content="Convert XML documents to idiomatic Zig structs. Attributes, child elements, mixed content, and namespace warnings all flow through. Runs in your browser."
  />
  <meta property="og:title" content="XML to Zig Struct" />
  <meta property="og:description" content="Generate idiomatic Zig structs from XML, in your browser." />
  <link rel="canonical" href="https://zigshape.dev/xml-to-zig-struct" />
</svelte:head>

<main>
  <header>
    <h1>XML to Zig Struct</h1>
    <p class="tagline">
      Paste an XML document and zigshape produces an idiomatic Zig struct.
      Switch to the <strong>serde.zig</strong> target to get <code>xml_root</code> and <code>xml_attribute</code>
      decoration alongside the type.
    </p>
  </header>

  <Playground initialFormat="xml" initialTarget="serde-zig" initialPreset="api" initialExample={XML_DEFAULT} />

  <section class="explainer">
    <h2>What zigshape does with XML</h2>
    <ul>
      <li>Attributes are tagged separately from child elements; the inspector shows which is which.</li>
      <li>Mixed content (attributes + text body) emits a <code>value</code> field with a <code>TODO</code> comment because <code>serde.zig</code> doesn't yet document an <code>xml_text</code> mapping.</li>
      <li>Namespace prefixes are stripped (e.g. <code>x:item</code> → <code>item</code>) and a warning fires.</li>
      <li>The serde target attaches <code>.xml_root = "tag"</code> and <code>.xml_attribute = .&lbrace; ... &rbrace;</code> automatically.</li>
    </ul>
    <p>For a plain Zig struct without serde decoration, just switch the toolbar's <em>Target</em> to <em>plain</em>.</p>
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
