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

<main class="page">
  <header class="intro">
    <h1>YAML to serde.zig</h1>
    <p>
      YAML configs turn into Zig structs annotated for <a href="https://github.com/OrlovEvgeny/serde.zig">serde.zig</a>.
      Anchors, aliases, and merge keys resolve before inference, so the generated decoration reflects
      the effective document, not the raw text.
    </p>
  </header>

  <Playground initialFormat="yaml" initialTarget="serde-zig" initialPreset="strict" initialExample={{ ...YAML_DEFAULT, target: "serde-zig" }} />
</main>

