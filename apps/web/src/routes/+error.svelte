<script lang="ts">
  import { page } from "$app/stores";
  import Seo from "$lib/Seo.svelte";
</script>

<Seo
  title="{$page.status === 404 ? 'Page not found' : 'Error'} · zigshape"
  description="This page doesn't exist on zigshape."
  path={$page.url.pathname}
  noindex
/>

<main class="page">
  <header class="intro">
    <h1>{$page.status === 404 ? "Page not found" : "Something went wrong"}</h1>
    <p>
      {$page.status === 404 ? "There is nothing at this address." : $page.error?.message}
      Go back to the <a href="/">playground</a>.
    </p>
  </header>
</main>
