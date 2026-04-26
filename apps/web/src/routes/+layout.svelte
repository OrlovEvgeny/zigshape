<script lang="ts">
  // Static SoftwareApplication JSON-LD; lives once in the layout so every
  // prerendered page picks it up.  No runtime cost — the head tag flushes
  // during prerender.
  import { onMount } from "svelte";
  let { children } = $props();

  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "zigshape",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    description:
      "Generate idiomatic Zig structs from JSON, YAML, TOML, and XML, with first-class serde.zig support.",
    url: "https://zigshape.dev/",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  });

  // Suppress unused-import warning for onMount; included for future-proofing
  // if the layout grows runtime concerns.
  void onMount;
</script>

<svelte:head>
  {@html `<script type="application/ld+json">${ld}</script>`}
</svelte:head>

{@render children?.()}
