import { PAGES } from "$lib/pages";
import { absolute } from "$lib/seo";

export const prerender = true;

// Built from pages.ts so a new landing page can't be left out.
export function GET() {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = [
    { path: "/", priority: "1.0" },
    ...PAGES.map((p) => ({ path: `/${p.slug}`, priority: "0.8" })),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (u) => `  <url><loc>${absolute(u.path)}</loc><lastmod>${lastmod}</lastmod><priority>${u.priority}</priority></url>`,
    ),
    "</urlset>",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
