<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import { TOML_DEFAULT } from "$lib/format-examples";
</script>

<svelte:head>
  <title>TOML to serde.zig — zigshape</title>
  <meta
    name="description"
    content="Generate Zig structs decorated for serde.zig from TOML: rename_all, deny_unknown_fields, observed defaults. Runs in your browser."
  />
  <meta property="og:title" content="TOML to serde.zig" />
  <meta property="og:description" content="TOML to Zig structs with first-class serde.zig decoration." />
  <link rel="canonical" href="https://zigshape.dev/toml-to-serde-zig" />
</svelte:head>

<main class="page">
  <header class="intro">
    <h1>TOML to serde.zig</h1>
    <p>
      TOML configs turn into Zig structs annotated for <a href="https://github.com/OrlovEvgeny/serde.zig">serde.zig</a>.
      Use the <em>Strict config</em> preset to bake observed scalar values into struct defaults, so
      missing config keys still produce a usable struct.
    </p>
  </header>

  <Playground initialFormat="toml" initialTarget="serde-zig" initialPreset="strict" initialExample={{ ...TOML_DEFAULT, target: "serde-zig" }} />
</main>

