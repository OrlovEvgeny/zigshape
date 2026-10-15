// Site-wide SEO constants and schema.org builders.  Pages pass their own
// title / description / path; everything derived (canonical, Open Graph,
// JSON-LD) comes from here so it stays consistent.

export const SITE_URL = "https://zigshape.dev";
export const SITE_NAME = "zigshape";
export const OG_IMAGE = `${SITE_URL}/og.png`;
export const SERDE_URL = "https://github.com/OrlovEvgeny/serde.zig";

export const ALL_FORMATS_TEXT = "JSON, YAML, TOML, XML, CSV, ZON, TOON and NDJSON";

export function absolute(path: string): string {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

type Json = Record<string, unknown>;

export function softwareApplication(): Json {
  return {
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any (runs in the browser)",
    browserRequirements: "Requires JavaScript",
    description: `Generate idiomatic Zig structs from ${ALL_FORMATS_TEXT}, for std.json or serde.zig. Every type decision is explained.`,
    featureList: [
      "Type inference across multiple samples",
      "Optional fields from missing or null values",
      "Smallest integer width that fits the observed range",
      "serde.zig rename_all, alias, flatten, skip and tagged unions",
      "std.json compatible output for the plain target",
      "Per-field explanation and overrides",
      "Runs locally in the browser",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
  };
}

export function website(): Json {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: "en",
  };
}

export function breadcrumbs(items: { name: string; path: string }[]): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absolute(it.path),
    })),
  };
}

/** FAQ answers may contain inline markup; schema.org text gets it stripped. */
export function faqPage(faq: { q: string; a: string }[]): Json {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) },
    })),
  };
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** One `<script type="application/ld+json">` payload with a @graph. */
export function jsonLd(nodes: Json[]): string {
  // `<` is escaped so the JSON can't close the script element.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
}
