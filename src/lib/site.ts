import type { Metadata } from "next";

/** Public address of the site, without a trailing slash. Links in metadata, the sitemap and JSON-LD use it. */
export const siteUrl = () => (process.env.APP_URL?.trim() || "https://www.eguard.family").replace(/\/+$/, "");

export const SITE_NAME = "eGuard";
export const SITE_TAGLINE = "Protections you set once, verified on every device";

/**
 * Title, description, canonical URL and share tags for a public page. Metadata merges shallowly, so a page
 * that sets `openGraph` loses the root layout's; this builds the whole object each time.
 * Pages with their own `opengraph-image` file pass `ownImage`; the rest point at the site-wide one explicitly,
 * because setting `openGraph` drops the image inherited from the root.
 */
export function pageMetadata({ title, description, path, absoluteTitle, type = "website", publishedTime, share, ownImage }: {
  title: string;
  description: string;
  /** Different wording for link previews than for search results */
  share?: { title: string; description: string };
  path: string;
  /** Use the title as is, without the " · eGuard" suffix */
  absoluteTitle?: boolean;
  type?: "website" | "article";
  publishedTime?: string;
  ownImage?: boolean;
}): Metadata {
  const shareTitle = share?.title ?? (absoluteTitle ? title : `${title} · ${SITE_NAME}`);
  const shareDescription = share?.description ?? description;
  const images = ownImage ? {} : { images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `eGuard: ${SITE_TAGLINE}` }] };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type, siteName: SITE_NAME, locale: "en_PH", url: path, title: shareTitle, description: shareDescription,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...images,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description: shareDescription, ...images },
  };
}

/** Serialized for a <script type="application/ld+json">, with "<" escaped so content can't close the tag. */
export const jsonLd = (data: object) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });
