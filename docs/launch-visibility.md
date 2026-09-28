# Launch and visibility

What to fix on the public website before announcing eGuard, how to make it findable in search and readable when
shared, and a 30-day plan for reaching parents in the Philippines. App store submission is covered separately in
[app-listing.md](app-listing.md).

The audit in section 1 was made against the live site, `https://e-guard-web.vercel.app`, on 28 September 2026.
Statuses were updated the same day after the section 2 fixes landed in the codebase. The live site shows them only
after the next deploy, so re-run these checks once it's out.

## Contents

1. [Where the site stands](#1-where-the-site-stands)
2. [Fix before launch](#2-fix-before-launch)
3. [Domain and email](#3-domain-and-email)
4. [Search and link previews](#4-search-and-link-previews)
5. [Pages people search for](#5-pages-people-search-for)
6. [Measurement](#6-measurement)
7. [Where to announce](#7-where-to-announce)
8. [30-day plan](#8-30-day-plan)
9. [Checklist](#9-checklist)

---

## 1. Where the site stands

Status uses eGuard's own words: **Verified** means it works, **Needs attention** means it costs visibility, and
**Action required** means fix it before telling anyone about the site.

| Check | What the live site returns | Status |
|---|---|---|
| Privacy policy and terms | `/privacy` and `/terms` are live and linked from the footer, but no Data Protection Officer or business address is named yet (`src/lib/legal.ts`) | **Action required** |
| Ratings and user claims | Rating card, "thousands of parents" and "trusted by" copy removed or rewritten, on the landing page and the sign-in panel | Verified |
| App store badges | Replaced with "Android and iOS apps coming soon" | Verified |
| Dead links | None point to `#`. About, Privacy, Terms and Blog are real pages; Download App and the social icons are removed until they exist | Verified |
| "Real-time alerts" on Plus | Plus card says "Push alerts (coming soon)"; the landing page describes instant email alerts | Verified |
| Newsletter box | Removed: it didn't save addresses | Verified |
| Domain | Served from a `vercel.app` subdomain | Needs attention |
| `robots.txt` | 404 | Needs attention |
| `sitemap.xml` | 404 | Needs attention |
| Link previews (Open Graph, X) | No `og:` tags, no share image. Facebook and Messenger show a bare link | Needs attention |
| Canonical URL | None set | Needs attention |
| Structured data | No JSON-LD | Needs attention |
| Signed-in pages | Not marked `noindex` (only `/verify-email` is) | Needs attention |
| Title and description | "eGuard · A Safer Digital World for Their Brighter Tomorrow", plus a clear description | Verified |
| Headings | One H1, eight H2 sections in a sensible order | Verified |
| Icons | `favicon.ico`, SVG icon and 180px Apple touch icon | Verified |
| Language and HTTPS | `lang="en"`, HTTPS on Vercel | Verified |
| Image alt text | Photos are described; decorative icons use empty alt | Verified |
| Phones and tablets | No sideways scrolling at 320–1280px across all 33 screens | Verified |

Totals: 1 action required, 7 need attention, 11 verified.

---

## 2. Fix before launch

Parents are deciding whether to trust eGuard with their children's devices. Anything on the page that turns out
not to be true costs that trust. It also gets the site flagged by ad platforms and app store reviewers.

### 2.1 Remove the 4.8 rating and the "thousands of parents" line

**Done.** The rating card now says "Free for 1 child". The "50K+" on the sign-in panel is gone too.

eGuard has no public reviews yet, so "4.8 (2.5K+ reviews)" is a made-up figure. Showing invented ratings breaks the
Philippines' Consumer Act rules on misleading advertising and Meta and Google ad policies, and a reviewer can check
it in seconds. Replace the card with something true, such as "Free for 1 child · no card needed". Add real numbers
once you have them.

Also soften "Trusted by modern families", "Trusted by Parents, Supported by Communities" and the FAQ line
"Schools, communities and employers use eGuard" until someone actually does. "Built for families, schools and
communities" says the same thing honestly.

Where: [src/app/page.tsx](../src/app/page.tsx) lines 183, 236–241, 252 and 380, and the FAQ copy.

### 2.2 Publish a privacy policy and terms of use

**Pages live; DPO still to name.** Fill in `dpoName` and `address` in `src/lib/legal.ts`, and have a lawyer
review both pages, especially the refund and liability terms.

This matters more for eGuard than for most sites: it collects children's location and app usage. You need
`/privacy` and `/terms` as real pages before you run ads, list in a directory or submit to either app store. Under
the Data Privacy Act (RA 10173), the policy has to name a Data Protection Officer and a contact for privacy
requests.

The content already exists. "What data eGuard keeps" in the help articles and
[app-listing.md › 7](app-listing.md#7-google-play-data-safety-form) list what's collected, the 90-day retention,
opt-in location history and PayMongo as the payment processor.

### 2.3 Stop linking to things that don't exist

**Done.** Blog and About became real pages instead of being hidden. Download App and the social icons are removed;
add them back to `src/components/site-chrome.tsx` once they exist.

Clicking a store badge that does nothing is the fastest way to lose a parent's trust. Until the apps ship, replace
the two badges with "Android and iOS apps coming soon" and an email sign-up. Hide Blog, About and Download App, and
any social icon without an account behind it. "Watch Video" scrolls to How It Works; rename it to "See how it
works" or record the video.

Where: [src/app/page.tsx](../src/app/page.tsx) lines 135–136 and the footer.

### 2.4 Describe alerts the way they work today

**Done.** Every plan gets email and in-app alerts, so the Plus card says "Push alerts (coming soon)" rather than
listing email alerts as a Plus perk.

The Plus plan lists "Real-time alerts", but push notifications aren't connected yet (README, "Not built yet"). The
dashboard checks for new alerts every 30 seconds, and alerts go out by email. Until push ships, write "Instant email
and in-app alerts" on the pricing card and in the FAQ.

### 2.5 Make the newsletter box do something

**Done: removed.** It sent visitors to the register page, which ignored the address.

"Stay Updated" collects an email address in the footer. Check that it saves the address and sends a confirmation.
If it doesn't, remove it for now. It becomes useful later as the waitlist for the mobile apps.

---

## 3. Domain and email

Search engines treat a domain change as a new site, so switch before you build up any search ranking or backlinks,
not after. Parents are also more wary of a `vercel.app` address, and it looks like a demo.

**Buy and connect**

- Register the domain (the listing draft uses `eguard.app`; also secure the `.ph` or `.com.ph` version if the name
  is free).
- In Vercel › Project › Domains, add it as the primary domain. Make `e-guard-web.vercel.app` redirect to it with a
  permanent (308) redirect.
- Set `APP_URL` in Production to the new address. Verification links, map tiles and the metadata in section 4 read
  it.

**Make email land in the inbox**

- Verification and alert emails come from SMTP, with Resend as fallback. Add SPF, DKIM and DMARC records for the
  new domain in both.
- Start DMARC at `p=none` with reports, then move to `quarantine` once reports come back clean.
- Send from a real address such as `hello@`, and make `SUPPORT_EMAIL` an inbox someone actually reads.

---

## 4. Search and link previews

Five small files cover everything flagged as Needs attention in section 1. They follow the Next.js 16 conventions in
`node_modules/next/dist/docs` and read the site address from `APP_URL`.

### 4.1 Site-wide defaults and link previews

Most parents in the Philippines will first see eGuard as a link in Messenger or a Facebook group. With no Open Graph
tags, that link shows up bare. Add a base URL and share defaults to the root layout:

```ts
// src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://e-guard-web.vercel.app"),
  title: { default: "eGuard", template: "%s · eGuard" },
  description: "Digital Safety for Brighter Tomorrows. Configure, manage and verify protections on your children's devices.",
  openGraph: { type: "website", siteName: "eGuard", locale: "en_PH" },
  twitter: { card: "summary_large_image" },
};
```

Add to the landing page's existing metadata:

```ts
// src/app/page.tsx
  alternates: { canonical: "/" },
  openGraph: {
    title: "eGuard: parental controls you can verify",
    description: "Set screen time, bedtime and app rules on your child's phone, and see each one confirmed on the device. Free for 1 child.",
    url: "/",
  },
```

Then add a 1200 × 630 image at `src/app/opengraph-image.png`. Next.js adds the image tags automatically. Use the
logo, the line "Protections you set once, verified on every device" and the navy-to-sky gradient. Use no children's
faces, following the brand rules.

### 4.2 robots.txt and sitemap

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.APP_URL ?? "https://e-guard-web.vercel.app";
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${site}/sitemap.xml`,
  };
}
```

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next";

// Public pages only. Add each /blog/[slug] post (POSTS in src/lib/blog.ts) and, once public, each /help/[slug] article.
const PAGES = ["", "/register", "/login", "/about", "/privacy", "/terms", "/blog"];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.APP_URL ?? "https://e-guard-web.vercel.app";
  return PAGES.map((p) => ({ url: `${site}${p}`, changeFrequency: p ? "monthly" : "weekly", priority: p ? 0.5 : 1 }));
}
```

### 4.3 Keep the dashboard out of search results

Signed-out visitors to `/dashboard` and the other signed-in pages get sent to the sign-in page. Marking the whole
group `noindex` makes sure none of them turn up in search results. Do the same for forgot-password and
reset-password.

```ts
// src/app/(app)/layout.tsx
export const metadata = { robots: { index: false, follow: false } };
```

### 4.4 Tell search engines what eGuard is

Add this to the landing page. It gives Google the organization, the logo and the three plans in pesos. Leave out
`aggregateRating` until you have real reviews, for the same reason as 2.1. An FAQ block won't earn extra space in
results either: since 2023, Google shows FAQ rich results only for government and health sites.

```tsx
// src/app/page.tsx, inside the page component
const site = process.env.APP_URL ?? "https://e-guard-web.vercel.app";
const offer = (name: string, price: string) => ({ "@type": "Offer", name, price, priceCurrency: "PHP" });
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${site}/#org`, name: "eGuard", url: site, logo: `${site}/brand/logo-mark-512.png` },
    { "@type": "WebApplication", name: "eGuard", url: site, applicationCategory: "LifestyleApplication",
      operatingSystem: "Any (web browser)", publisher: { "@id": `${site}/#org` },
      offers: [offer("Free", "0"), offer("eGuard Plus", "149"), offer("Family Pro", "249")] },
  ],
};

// in the returned JSX
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
```

### 4.5 Register with the search engines

**Google Search Console**

- Add a **Domain property** and verify it with a DNS TXT record. This covers the `www` and non-`www` addresses and
  both http and https at once.
- Submit `/sitemap.xml`, then use URL Inspection › Request indexing on the home page.
- Check Page indexing weekly for the first month.

**Bing Webmaster Tools**

- Import the site straight from Search Console; no second verification needed.
- Bing also supplies results to DuckDuckGo, Ecosia and several AI assistants, so it's worth the five minutes.
- Turn on IndexNow so new help pages get picked up within hours.

After deploying, test with the Facebook Sharing Debugger and Google's Rich Results Test. Facebook caches previews,
so re-scrape the URL there whenever you change the share image.

---

## 5. Pages people search for

Right now search engines can only find one page on eGuard. You already have the start of more: **10 help articles**
in [src/lib/help.ts](../src/lib/help.ts), visible only after sign-in. Making them public at `/help/[slug]` gives
Google ten useful, specific pages from work that's already written.

| What a parent searches | Kind | Page that answers it |
|---|---|---|
| how to set screen time on child's iPhone | Setup guide, high intent | Help: "Set up supervision on iPhone and iPad" |
| parental control Android Family Link setup | Setup guide, high intent | Help: "Set up supervision on Android" |
| parental control app Philippines | Product search, commercial | Landing page (make sure "Philippines" and pesos appear in the copy) |
| best parental control app free | Comparison, commercial | New: "Free parental controls: what eGuard's Free plan covers" |
| how to see my child's location on phone | Question, feature | Help: "How location sharing works" |
| is parental control app safe privacy | Worry, trust | Help: "What data eGuard keeps", plus the privacy policy |
| bedtime mode for kids phone | Question, feature | New: a bedtime guide that ends in eGuard's Bedtime protection |
| parental controls not working | Problem, switching | Help: "A setting says…" and "A device shows as offline". Explain how eGuard verifies each setting on the device |

- **Your angle is verification.** Competitors say a setting was saved; eGuard says it was confirmed on the device.
  Use that as the thread through every page title and description.
- **Write for Filipino parents.** Use peso prices, local school terms such as "school nights" and "Grade 7", and
  screenshots of Android phones common in the Philippines. Consider Tagalog versions of the top three guides once
  the English ones are indexed.
- **One new guide a week** for the first month is enough. Four good guides beat twenty thin ones.

---

## 6. Measurement

eGuard's privacy promise has to hold for its own analytics too. Use a cookieless tool on public pages only, and
never put ad pixels on signed-in pages, where children's names and locations appear.

**Tools**

- **Vercel Web Analytics** on the landing page, help pages and sign-up: cookieless and one line to add. Add Speed
  Insights for real-device load times.
- **Search Console** for queries, impressions and indexing.
- Add a Meta Pixel only if you run Facebook ads, only on public pages, and mention it in the privacy policy.

**The funnel to watch**

1. Landing visit → **Create account**
2. Account → **email verified**
3. Verified → **first child added**
4. Child → **first device paired**: the moment eGuard delivers value
5. Paired → **upgrade** to Plus or Family Pro

You can count all five from your own database, so this funnel needs no third-party tracking.

---

## 7. Where to announce

Start where Filipino parents already talk, and lead with a useful guide rather than a sales pitch. Every link you
share should show the new share image.

**Parent communities**

- Facebook parenting and homeschool groups: read each group's rules and ask the admin before posting. Share a setup
  guide first; mention eGuard only as the tool that checks the settings.
- Mom and parenting creators on Facebook and TikTok: offer a Family Pro plan for an honest walkthrough. Any
  sponsored post must be labeled as sponsored.

**Schools and communities**

- The site already has a "For Schools" section. Offer PTAs and school guidance offices a free parents' session on
  screen time, with a one-page handout that links to the guides.
- Take one school from pilot to a real quote. That's what earns back the "Supported by Communities" heading.

**Launch platforms and directories**

- Product Hunt: launch on a Tuesday–Thursday, with the verification angle in the tagline.
- AlternativeTo (as an alternative to Family Link, Qustodio and Bark), SaaSHub and BetaList.
- Create a Google Business Profile only if eGuard has a registered business address to show.

**Press**

- Philippine tech and parenting outlets. Pitch a timely angle, like the start of a school term or holiday screen
  time, backed by a short press kit: logo files from [public/brand](../public/brand), three screenshots of the demo
  family, and a founder quote.
- Never put a real child's name, photo or location in any screenshot.

---

## 8. 30-day plan

The order matters: fix trust first, then make the site findable, then send people to it.

| Days | Focus | Work |
|---|---|---|
| 1–5 | Trust | Take out the rating and user claims; fix the "Real-time alerts" copy. Publish `/privacy` and `/terms` and name the Data Protection Officer. Replace the store badges and hide the dead links. |
| 4–8 | Identity | Connect the domain, redirect `vercel.app` to it with a 308, and update `APP_URL`. Set up SPF, DKIM and DMARC; send a test verification email to Gmail and Yahoo. |
| 6–10 | Findable | Add the metadata, robots, sitemap, share image, noindex and JSON-LD from section 4. Verify Search Console and Bing; submit the sitemap. Check a shared link in Messenger and with the Facebook Sharing Debugger. |
| 10–18 | Content | Publish all 10 help articles at `/help/[slug]`, each with its own title and description, and add them to the sitemap. Write the first new guide (bedtime or free plan). Add Vercel Analytics to the public pages. |
| 18–30 | Announce | Share guides in two or three Facebook parent groups, with admin permission. Pitch one school for a parents' session. Launch on Product Hunt and submit to directories in the same week. On day 30, review the funnel: how many sign-ups reached a paired device, and where people drop off. |

---

## 9. Checklist

**Trust**

- [x] Rating card, "thousands of parents" and unverified "trusted by" copy removed or rewritten
- [ ] `/privacy` and `/terms` live, with a Data Protection Officer named *(pages live; DPO name and address still
  to fill in `src/lib/legal.ts`, then have a lawyer review both pages)*
- [x] Store badges replaced with "coming soon"; no link points to `#`
- [x] "Real-time alerts" describes email and in-app alerts until push ships
- [x] Newsletter box saves addresses, or is removed

**Domain and email**

- [ ] Custom domain is primary; `vercel.app` redirects to it with a 308
- [ ] `APP_URL` updated in Production
- [ ] SPF, DKIM and DMARC pass; test email reaches the Gmail inbox

**Search and sharing**

- [ ] `metadataBase`, Open Graph and canonical set
- [ ] 1200 × 630 share image added; checked in the Facebook Sharing Debugger
- [ ] `robots.txt` and `sitemap.xml` return 200
- [ ] Signed-in, forgot-password and reset-password pages are `noindex`
- [ ] JSON-LD passes Google's Rich Results Test, with no rating in it
- [ ] Search Console and Bing verified; sitemap submitted

**Content and measurement**

- [ ] 10 help articles public at `/help/[slug]` and in the sitemap
- [ ] First new guide published
- [ ] Cookieless analytics on public pages only
- [ ] Sign-up → paired device funnel counted from the database

**Announce**

- [ ] Press kit ready: logos, 3 demo-family screenshots, founder quote
- [ ] Shared in parent groups with admin permission
- [ ] One school approached for a parents' session
- [ ] Product Hunt launch and directory listings
