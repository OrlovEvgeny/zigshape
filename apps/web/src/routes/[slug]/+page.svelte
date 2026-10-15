<script lang="ts">
  import Playground from "$lib/Playground.svelte";
  import Seo from "$lib/Seo.svelte";
  import { PAGE_BY_SLUG } from "$lib/pages";
  import { breadcrumbs, faqPage, softwareApplication } from "$lib/seo";

  let { data } = $props();
  const page = $derived(data.page);
  const path = $derived(`/${page.slug}`);
  const related = $derived(page.related.map((s) => PAGE_BY_SLUG.get(s)).filter((p) => p !== undefined));
  const schema = $derived([
    breadcrumbs([
      { name: "zigshape", path: "/" },
      { name: page.name, path },
    ]),
    faqPage(page.faq),
    softwareApplication(),
  ]);
</script>

<Seo title={page.title} description={page.description} {path} {schema} />

<main class="page">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">zigshape</a>
    <span aria-hidden="true">/</span>
    <span aria-current="page">{page.name}</span>
  </nav>

  <header class="intro">
    <h1>{page.h1}</h1>
    <p>{@html page.lede}</p>
  </header>

  {#key page.slug}
    <Playground
      initialFormat={page.format}
      initialTarget={page.target}
      initialPreset={page.preset}
      initialExample={page.example}
    />
  {/key}

  <div class="prose columns">
    <section aria-labelledby="points">
      <h2 id="points">{page.pointsTitle}</h2>
      <ul>
        {#each page.points as point (point)}
          <li>{@html point}</li>
        {/each}
      </ul>
    </section>

    <section aria-labelledby="faq">
      <h2 id="faq">Questions</h2>
      <dl class="faq">
        {#each page.faq as item (item.q)}
          <dt>{item.q}</dt>
          <dd>{@html item.a}</dd>
        {/each}
      </dl>
    </section>
  </div>

  <nav class="related" aria-label="Related converters">
    <span class="label">Related</span>
    {#each related as r (r.slug)}
      <a href="/{r.slug}">{r.name}</a>
    {/each}
  </nav>
</main>

<style>
  .crumbs {
    display: flex;
    gap: 8px;
    padding-top: 18px;
    color: var(--text-3);
    font-size: 12.5px;
  }
  .crumbs a {
    color: var(--text-2);
    text-decoration: none;
  }
  .crumbs a:hover {
    color: var(--text);
  }
  .crumbs + .intro {
    padding-top: 10px;
  }
  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px 48px;
    max-width: none;
  }
  .faq {
    margin: 0;
  }
  .faq dt {
    margin-top: 14px;
    color: var(--text);
    font-weight: 500;
  }
  .faq dt:first-child {
    margin-top: 0;
  }
  .faq dd {
    margin: 4px 0 0;
  }
  .related {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 18px;
    margin-top: 28px;
  }
  .related a {
    color: var(--text-2);
    text-decoration: none;
  }
  .related a:hover {
    color: var(--text);
  }
  @media (max-width: 900px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
