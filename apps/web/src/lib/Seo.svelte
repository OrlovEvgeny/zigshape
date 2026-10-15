<script lang="ts">
  import { absolute, jsonLd, OG_IMAGE, SITE_NAME } from "./seo";

  type Props = {
    title: string;
    description: string;
    /** Site path, e.g. "/json-to-zig-struct". */
    path: string;
    /** schema.org nodes for this page. */
    schema?: Record<string, unknown>[];
    noindex?: boolean;
  };

  let { title, description, path, schema = [], noindex = false }: Props = $props();

  const url = $derived(absolute(path));
  const ld = $derived(schema.length > 0 ? jsonLd(schema) : null);
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  {#if noindex}
    <meta name="robots" content="noindex" />
  {:else}
    <link rel="canonical" href={url} />
  {/if}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={url} />
  <meta property="og:image" content={OG_IMAGE} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="zigshape turns JSON, YAML, TOML, XML, CSV, ZON and TOON into Zig structs" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={OG_IMAGE} />
  {#if ld}
    {@html `<script type="application/ld+json">${ld}</script>`}
  {/if}
</svelte:head>
