<script lang="ts">
  // Site chrome (header, footer, global styles) lives once here so every
  // prerendered page shares it.  The static SoftwareApplication JSON-LD
  // flushes during prerender; no runtime cost.
  import "@fontsource/ibm-plex-sans/latin-400.css";
  import "@fontsource/ibm-plex-sans/latin-500.css";
  import "@fontsource/ibm-plex-sans/latin-600.css";
  import "@fontsource/ibm-plex-mono/latin-400.css";
  import "@fontsource/ibm-plex-mono/latin-500.css";
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/stores";

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

  const FORMATS = [
    { label: "JSON", plain: "/json-to-zig-struct", serde: "/json-to-serde-zig" },
    { label: "YAML", plain: "/yaml-to-zig-struct", serde: "/yaml-to-serde-zig" },
    { label: "TOML", plain: "/toml-to-zig-struct", serde: "/toml-to-serde-zig" },
    { label: "XML", plain: "/xml-to-zig-struct", serde: "/xml-to-serde-zig" },
  ];

  const SERDE_URL = "https://github.com/OrlovEvgeny/serde.zig";

  const path = $derived($page.url.pathname);

  // GitHub Buttons (buttons.github.io) swaps the anchor for an iframe, so
  // the anchor is created here inside a node Svelte doesn't render into;
  // creating it in markup would clash with hydration.  If the script is
  // blocked, the plain serde.zig link next to it still works.
  let starHost: HTMLSpanElement;
  onMount(() => {
    const a = document.createElement("a");
    a.className = "github-button";
    a.href = SERDE_URL;
    a.textContent = "Star";
    a.setAttribute("data-show-count", "true");
    a.setAttribute("data-color-scheme", "no-preference: light; light: light; dark: dark;");
    a.setAttribute("aria-label", "Star OrlovEvgeny/serde.zig on GitHub");
    starHost.replaceChildren(a);
    const script = document.createElement("script");
    script.src = "https://buttons.github.io/buttons.js";
    script.async = true;
    document.head.appendChild(script);
    return () => script.remove();
  });
</script>

<svelte:head>
  {@html `<script type="application/ld+json">${ld}</script>`}
</svelte:head>

<div class="shell">
  <header class="site-header">
    <div class="page bar">
      <a class="brand" href="/" aria-label="zigshape home">
        <img src="/zig-mark.svg" width="22" height="20" alt="" />
        <span>zigshape</span>
      </a>
      <nav class="formats" aria-label="Formats">
        {#each FORMATS as f (f.label)}
          <a href={f.plain} aria-current={path === f.plain || path === f.serde ? "page" : undefined}>{f.label}</a>
        {/each}
      </nav>
      <span class="spacer"></span>
      <a class="ext" href={SERDE_URL} target="_blank" rel="noopener noreferrer">
        serde.zig
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1h6v6M9 1L1 9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
      </a>
      <span class="stars" bind:this={starHost}></span>
    </div>
  </header>

  <div class="content">
    {@render children?.()}
  </div>

  <footer class="site-footer">
    <div class="page cols">
      <p class="privacy">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.5" width="8" height="5.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
        Runs entirely in your browser. Input never leaves this page.
      </p>
      <nav aria-label="Converters">
        <span class="group">
          <span class="label">Zig struct</span>
          {#each FORMATS as f (f.label)}<a href={f.plain}>{f.label}</a>{/each}
        </span>
        <span class="group">
          <span class="label">serde.zig</span>
          {#each FORMATS as f (f.label)}<a href={f.serde}>{f.label}</a>{/each}
        </span>
      </nav>
    </div>
  </footer>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  .content {
    flex: 1 0 auto;
  }

  .site-header {
    position: sticky;
    top: 0;
    z-index: 20;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 28px;
    height: 48px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
    font-weight: 600;
    font-size: 15px;
    letter-spacing: -0.01em;
    text-decoration: none;
  }
  .formats {
    display: flex;
    gap: 2px;
  }
  .formats a,
  .ext {
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    color: var(--text-2);
    font-size: 13px;
    text-decoration: none;
  }
  .formats a:hover,
  .ext:hover {
    background: var(--surface-hover);
    color: var(--text);
  }
  .formats a[aria-current="page"] {
    color: var(--text);
    background: var(--surface-hover);
  }
  .ext {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .spacer {
    flex: 1;
  }
  .stars {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    height: 20px;
    margin-left: -18px;
    line-height: 0;
  }
  /* The widget host is an inline span; as a block it centres on the bar
     instead of sitting on the text baseline. */
  .stars > :global(span) {
    display: block;
  }

  .site-footer {
    margin-top: 56px;
    border-top: 1px solid var(--border);
    color: var(--text-3);
    font-size: 12px;
  }
  .cols {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 32px;
    padding-top: 18px;
    padding-bottom: 22px;
  }
  .privacy {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin: 0;
  }
  .site-footer nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 28px;
  }
  .group {
    display: inline-flex;
    align-items: baseline;
    gap: 10px;
  }
  .group .label {
    font-size: 10.5px;
  }
  .site-footer a {
    color: var(--text-2);
    text-decoration: none;
  }
  .site-footer a:hover {
    color: var(--text);
  }

  @media (max-width: 640px) {
    .bar {
      gap: 14px;
    }
    .stars {
      margin-left: -6px;
    }
    .formats {
      display: none;
    }
  }
</style>
