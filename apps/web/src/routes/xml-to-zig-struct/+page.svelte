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

<main class="page">
  <header class="intro">
    <h1>XML to Zig Struct</h1>
    <p>
      Paste an XML document and zigshape produces an idiomatic Zig struct.
      Switch to the <strong>serde.zig</strong> target to get <code>xml_root</code> and <code>xml_attribute</code>
      decoration alongside the type.
    </p>
  </header>

  <Playground initialFormat="xml" initialTarget="serde-zig" initialPreset="api" initialExample={XML_DEFAULT} />

  <section class="prose">
    <h2>What zigshape does with XML</h2>
    <ul>
      <li>Attributes are tagged separately from child elements; the inspector shows which is which.</li>
      <li>Mixed content (attributes + text body) emits a <code>value</code> field with a <code>TODO</code> comment because <code>serde.zig</code> doesn't yet document an <code>xml_text</code> mapping.</li>
      <li>Namespace prefixes are stripped (e.g. <code>x:item</code> → <code>item</code>) and a warning fires.</li>
      <li>The serde target attaches <code>.xml_root = "tag"</code> and <code>.xml_attribute = .&lbrace; ... &rbrace;</code> automatically.</li>
    </ul>
    <p>For a plain Zig struct without serde decoration, just switch the toolbar's <em>Target</em> to <em>plain</em>.</p>
  </section>
</main>

