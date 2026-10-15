<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import Seo from "$lib/Seo.svelte";
  import { PAGES } from "$lib/pages";
  import { SERDE_URL, softwareApplication, website } from "$lib/seo";
</script>

<Seo
  title="zigshape: Generate Zig Structs from JSON, YAML, TOML, XML"
  description="Paste JSON, YAML, TOML, XML, CSV, ZON or TOON and get idiomatic Zig structs for std.json or serde.zig, with every type decision explained. Runs in your browser."
  path="/"
  schema={[website(), softwareApplication()]}
/>

<main class="page">
  <header class="intro">
    <h1>Zig structs from real-world data</h1>
    <p>
      Paste JSON, YAML, TOML, XML, CSV, ZON or TOON. zigshape infers types across every sample, explains each
      decision, and emits structs for <code>std.json</code> or
      <a href={SERDE_URL} target="_blank" rel="noopener noreferrer">serde.zig</a>.
    </p>
  </header>

  <Playground />

  <section class="prose features" aria-label="Features">
    <div>
      <h2>Inference across samples</h2>
      <p>Add several payloads of the same shape. Fields missing or null in any of them become optional, and integer widths fit the observed range.</p>
    </div>
    <div>
      <h2>Every decision explained</h2>
      <p>The field table shows how often each key appeared, which value kinds were seen, and where it sits in the input. Override any type in place.</p>
    </div>
    <div>
      <h2>Output that parses</h2>
      <p>Plain structs keep wire names for <code>std.json</code>; serde.zig structs get <code>rename_all</code>, aliases and tagged unions. Both read your samples back.</p>
    </div>
  </section>

  <section class="converters" aria-labelledby="converters">
    <h2 id="converters">Converters</h2>
    <ul>
      {#each PAGES as p (p.slug)}
        <li>
          <a href="/{p.slug}">{p.name}</a>
          <span>{p.target === "serde-zig" ? "serde.zig" : p.format === "zon" ? "std.zon" : "std.json"}</span>
        </li>
      {/each}
    </ul>
  </section>
</main>

<style>
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px 32px;
    max-width: none;
  }
  .features p {
    margin: 0;
    font-size: 13px;
  }
  .converters {
    margin-top: 36px;
  }
  .converters h2 {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
  }
  .converters ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .converters li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .converters li a {
    color: var(--text);
    font-weight: 500;
    text-decoration: none;
  }
  .converters li a:hover {
    text-decoration: underline;
  }
  .converters li span {
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: 11.5px;
  }
</style>
