import type { Metadata } from "next";

/** Public address of the site, without a trailing slash. Links in metadata, the sitemap and JSON-LD use it. */
export const siteUrl = () => (process.env.APP_URL?.trim() || "https://www.eguard.family").replace(/\/+$/, "");

export const SITE_NAME = "eGuard";
export const SITE_TAGLINE = "Protections you set once, verified on every device";

/** Google cuts titles off at about 600px, roughly 60 characters. Past that, the " · eGuard" suffix is dropped. */
export const TITLE_MAX = 60;
const SUFFIX = ` · ${SITE_NAME}`;

/** The title as search results show it: with the " · eGuard" suffix when it still fits in TITLE_MAX. */
export const fullTitle = (title: string) => (title.length + SUFFIX.length <= TITLE_MAX ? title + SUFFIX : title);

/**
 * Title, description, canonical URL and share tags for a public page. Metadata merges shallowly, so a page
 * that sets `openGraph` loses the root layout's; this builds the whole object each time.
 * Pages with their own `opengraph-image` file pass `ownImage`; the rest point at the site-wide one explicitly,
 * because setting `openGraph` drops the image inherited from the root.
 */
export function pageMetadata({ title, description, path, absoluteTitle, type = "website", publishedTime, share, ownImage, locale = "en_PH", languages }: {
  title: string;
  description: string;
  /** Different wording for link previews than for search results */
  share?: { title: string; description: string };
  path: string;
  /** Use the title as is, without the " · eGuard" suffix (it's also dropped when it would push past TITLE_MAX) */
  absoluteTitle?: boolean;
  type?: "website" | "article";
  publishedTime?: string;
  ownImage?: boolean;
  /** Open Graph locale: "fil_PH" for a page in Filipino */
  locale?: string;
  /** The same page in each language, for hreflang: { "en-PH": "/for-kids", "fil-PH": "/fil/for-kids" }. Both versions pass the same map. */
  languages?: Record<string, string>;
}): Metadata {
  const searchTitle = absoluteTitle ? title : fullTitle(title);
  const shareTitle = share?.title ?? searchTitle;
  const shareDescription = share?.description ?? description;
  const images = ownImage ? {} : { images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `eGuard: ${SITE_TAGLINE}` }] };
  return {
    title: { absolute: searchTitle },
    description,
    alternates: { canonical: path, ...(languages ? { languages: { ...languages, "x-default": languages["en-PH"] ?? path } } : {}) },
    openGraph: {
      type, siteName: SITE_NAME, locale, url: path, title: shareTitle, description: shareDescription,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...images,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description: shareDescription, ...images },
  };
}

/** Serialized for a <script type="application/ld+json">, with "<" escaped so content can't close the tag. */
export const jsonLd = (data: object) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

/** BreadcrumbList JSON-LD from [name, path] pairs, starting after Home. */
export function breadcrumbs(...trail: [name: string, path: string][]) {
  const site = siteUrl();
  return {
    "@type": "BreadcrumbList",
    itemListElement: [["Home", ""], ...trail].map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${site}${path}` })),
  };
}
