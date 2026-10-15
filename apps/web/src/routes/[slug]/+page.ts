import { error } from "@sveltejs/kit";
import { PAGE_BY_SLUG, PAGES } from "$lib/pages";
import type { EntryGenerator, PageLoad } from "./$types";

// Prerender every landing page listed in pages.ts.
export const entries: EntryGenerator = () => PAGES.map((p) => ({ slug: p.slug }));

export const load: PageLoad = ({ params }) => {
  const page = PAGE_BY_SLUG.get(params.slug);
  if (!page) error(404, "Not found");
  return { page };
};
