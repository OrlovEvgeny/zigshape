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

<main class="page">
  <header class="intro">
    <h1>XML to serde.zig</h1>
    <p>
      XML documents convert to Zig structs annotated for
      <a href="https://github.com/OrlovEvgeny/serde.zig">serde.zig</a> — including
      <code>xml_root</code> for the document tag and <code>xml_attribute</code> for fields that came in
      as attributes rather than child elements.
    </p>
  </header>

  <Playground initialFormat="xml" initialTarget="serde-zig" initialPreset="api" initialExample={XML_DEFAULT} />
</main>

