# Launch and visibility

What to fix on the public website before announcing eGuard, how to make it findable in search and readable when
shared, and a 30-day plan for reaching parents in the Philippines. App store submission is covered separately in
[app-listing.md](app-listing.md).

eGuard is a product of **DevCom Digital Marketing Services**. The site's address is **`https://www.eguard.family`**.

The audit in section 1 was first made against `https://e-guard-web.vercel.app` on 28 September 2026. Statuses were
updated the same day as the fixes in sections 2, 4 and 5 landed in the codebase. The live site shows them only after
the next deploy, so re-run these checks on `www.eguard.family` once it's out.

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

| Check | What the site returns | Status |
|---|---|---|
| Domain | `www.eguard.family` is the default in code, and the app redirects `eguard.family` and `e-guard-web.vercel.app` to it; not yet connected in Vercel, and `APP_URL` not yet set (section 3) | Needs attention |
| Privacy policy and terms | Live at `/privacy` and `/terms`. DevCom Digital Marketing Services is named as the controller, with its Data Protection Officer, address and privacy email | Verified |
| Ratings and user claims | No rating, "thousands of parents" or "trusted by" claims on the landing page or the sign-in panel | Verified |
| App store badges | Replaced with "Android and iOS apps coming soon" | Verified |
| Dead links | None point to `#`. Download App and the social icons are removed until they exist | Verified |
| Alerts copy | Plus lists "Push alerts (coming soon)"; the landing page describes instant email alerts | Verified |
| Newsletter box | Removed: it didn't save addresses | Verified |
| `robots.txt` | Blocks `/api/`, points to the sitemap | Verified |
| `sitemap.xml` | 22 public URLs: home, about, blog and posts, help and all 10 articles, sign-up, sign-in, privacy, terms, delete-account | Verified |
| Link previews (Open Graph, X) | Every public page has its own title, description and a 1200 × 630 share image; posts and help articles get one with their title | Verified |
| Canonical URL | Set on every public page, from `APP_URL` | Verified |
| Structured data | Organization, WebSite and WebApplication (peso offers, no rating) on the home page; BlogPosting and TechArticle with breadcrumbs on posts and articles | Verified |
| Signed-in pages | The signed-in group, forgot-password, reset-password and verify-email are `noindex` | Verified |
| Title and description | "eGuard · Parental controls you can verify, for families in the Philippines", with pesos in the description | Verified |
| Headings | One H1 per page, sections in a sensible order | Verified |
| Icons | `favicon.ico`, SVG icon, 180px Apple touch icon and a web manifest | Verified |
| Language and HTTPS | `lang="en"`, HTTPS on Vercel | Verified |
| Image alt text | Photos are described; decorative icons use empty alt | Verified |
| Phones and tablets | No sideways scrolling at 320–1280px | Verified |

Totals: 0 action required, 1 needs attention (the domain), 18 verified.

---

## 2. Fix before launch

**All done.** Parents are deciding whether to trust eGuard with their children's devices, so anything on the site
that isn't true costs that trust, and gets the site flagged by ad platforms and app store reviewers. Keep it that
way: add a claim only once you can back it up.

| Fix | What changed | Where it lives |
|---|---|---|
| 2.1 Made-up rating and user claims | "4.8 (2.5K+ reviews)" became "Free for 1 child · No card needed". "Trusted by…", "thousands of parents" and the sign-in panel's "50K+" are gone; the audience band now says "Built for Families, Schools and Communities" | [src/app/page.tsx](../src/app/page.tsx), [src/app/(auth)/layout.tsx](../src/app/%28auth%29/layout.tsx) |
| 2.2 Privacy policy and terms | Written against what the code stores and deletes: the 90-day retention, opt-in location history, PayMongo, export and deletion, RA 10173 rights. DevCom is the controller | [src/app/(site)/privacy](../src/app/%28site%29/privacy/page.tsx), [terms](../src/app/%28site%29/terms/page.tsx), details in [src/lib/legal.ts](../src/lib/legal.ts) |
| 2.3 Dead links | Store badges became "apps coming soon"; "Watch Video" became "See How It Works"; About, Blog and Help became real pages; Download App and the social icons were removed | [src/components/site-chrome.tsx](../src/components/site-chrome.tsx) |
| 2.4 Alerts copy | Every plan gets email and in-app alerts, so Plus lists "Push alerts (coming soon)" instead of "Real-time alerts" | [src/lib/plans.ts](../src/lib/plans.ts) |
| 2.5 Newsletter box | Removed: it sent visitors to the register page, which ignored the address. Bring it back as the app waitlist once there's a mailing list | [src/components/site-chrome.tsx](../src/components/site-chrome.tsx) |

Still to do on these pages:

- **Legal review.** Have a lawyer read both legal pages, especially the refund and liability terms in the Terms.
- **Name the DPO with the NPC.** The site lists "DevCom's Data Protection Officer"; the National Privacy Commission
  still expects a named person on file when DevCom registers.
- **Update the "Last updated" date** in `src/lib/legal.ts` whenever either page changes.

---

## 3. Domain and email

Search engines treat a domain change as a new site, so connect `www.eguard.family` before you build up any search
ranking or backlinks. Parents are also more wary of a `vercel.app` address, which looks like a demo.

**Connect the domain**

- In Vercel › Project › Domains, add **`www.eguard.family`** as the primary domain.
- Add `eguard.family` and set it to redirect to `www`. Make `e-guard-web.vercel.app` redirect too. Both redirects
  are permanent (308). The app also sends both hosts to `www` with a 308 itself ([next.config.ts](../next.config.ts)),
  except `/api/`, so webhooks and apps still pointed at the old host keep working. Move the PayMongo and Google Play
  webhooks to `www.eguard.family` anyway.
- Set `APP_URL=https://www.eguard.family` in Production. Verification links, map tiles, canonical URLs, the
  sitemap, share tags and structured data all read it. (The code falls back to the same address if it's unset.)
- Consider securing a `.ph` or `.com.ph` version of the name if it's free.

**Make email land in the inbox**

- Verification and alert emails go out over SMTP, with Resend as fallback. Add SPF, DKIM and DMARC records for
  `eguard.family` in both.
- Start DMARC at `p=none` with reports, then move to `quarantine` once reports come back clean.
- Set `MAIL_FROM="eGuard <no-reply@eguard.family>"` once the domain passes SPF and DKIM. Until then, keep the
  current sender.
- Set `SUPPORT_EMAIL=support@devcomdigital.com`, the inbox someone reads. The legal pages already use it.

---

## 4. Search and link previews

**Built.** Everything is in the codebase and reads the site address from `APP_URL`.

| What | How | Where |
|---|---|---|
| Base URL, title template, default share tags | Root layout metadata | [src/app/layout.tsx](../src/app/layout.tsx) |
| Per-page title, description, canonical, Open Graph and X tags | `pageMetadata()`. Metadata merges shallowly, so a page that sets `openGraph` would lose the root's; the helper builds the whole object each time | [src/lib/site.ts](../src/lib/site.ts) |
| Share images (1200 × 630) | Drawn in code: logo, "Protections you set once, verified on every device", navy-to-sky gradient, no children's faces. Posts and help articles get their own with their title | [src/lib/og.tsx](../src/lib/og.tsx), `opengraph-image.tsx` files |
| `robots.txt` | Allows everything but `/api/`; points to the sitemap | [src/app/robots.ts](../src/app/robots.ts) |
| `sitemap.xml` | Built from the blog posts and help articles, so new ones appear automatically | [src/app/sitemap.ts](../src/app/sitemap.ts) |
| `noindex` | The signed-in group, forgot-password, reset-password and verify-email | `src/app/(app)/layout.tsx` and the auth pages |
| Structured data | Organization (with DevCom as parent), WebSite and WebApplication with peso offers on the home page; BlogPosting / TechArticle and breadcrumbs on posts and articles. No `aggregateRating` until there are real reviews, and no FAQ markup (Google shows FAQ results only for government and health sites) | [src/app/page.tsx](../src/app/page.tsx), the post and article pages |
| Web manifest | Name, colors and icons for installing the site | [src/app/manifest.ts](../src/app/manifest.ts) |

When adding a public page, export `metadata = pageMetadata({ title, description, path })` and add the path to the
sitemap. Pages with their own `opengraph-image` pass `ownImage: true`.

### Register with the search engines (after the domain is live)

**Google Search Console**

- Add a **Domain property** for `eguard.family` and verify it with a DNS TXT record. This covers `www` and
  non-`www`, http and https at once. (For HTML-tag verification instead, set `GOOGLE_SITE_VERIFICATION`.)
- Submit `https://www.eguard.family/sitemap.xml`, then use URL Inspection › Request indexing on the home page.
- Check Page indexing weekly for the first month.

**Bing Webmaster Tools**

- Import the site straight from Search Console; no second verification needed. (`BING_SITE_VERIFICATION` is there
  if you'd rather use the tag.)
- Bing also supplies results to DuckDuckGo, Ecosia and several AI assistants, so it's worth the five minutes.
- Turn on IndexNow so new posts and help pages get picked up within hours.

After deploying, test with the Facebook Sharing Debugger and Google's Rich Results Test. Facebook caches previews,
so re-scrape the URL there whenever you change a share image.

---

## 5. Pages people search for

**Built:** the [Knowledge Center](knowledge-center.md) at `/learn` (100 guides in 11 topics, for searches such as "parental control Philippines", "cyberbullying Philippines" and "Roblox safety parents"), the Help Center at `/help` (all 10 articles, each with its own page), and three blog posts at `/blog`.
Blog posts live in [src/lib/blog.ts](../src/lib/blog.ts); help articles in [src/lib/help.ts](../src/lib/help.ts),
which the apps also read through `GET /help`.

| What a parent searches | Kind | Page that answers it |
|---|---|---|
| how to set screen time on child's iPhone | Setup guide, high intent | `/help/ios-family-sharing` |
| parental control Android Family Link setup | Setup guide, high intent | `/help/android-family-link` |
| parental control app Philippines | Product search, commercial | Home page (title and description name the Philippines and pesos) |
| best parental control app free | Comparison, commercial | `/blog/what-the-free-plan-covers` |
| how to see my child's location on phone | Question, feature | `/help/location-privacy` |
| is parental control app safe privacy | Worry, trust | `/help/data-we-keep` and `/privacy` |
| bedtime mode for kids phone | Question, feature | `/blog/bedtime-for-your-childs-phone` |
| parental controls not working | Problem, switching | `/blog/settings-verified-on-the-device`, `/help/setting-not-verified`, `/help/device-offline` |

- **Your angle is verification.** Competitors say a setting was saved; eGuard says it was confirmed on the device.
  Use that as the thread through every title and description.
- **Write for Filipino parents.** Use peso prices, local school terms such as "school nights" and "Grade 7", and
  screenshots of Android phones common in the Philippines. Consider Tagalog versions of the top three guides once
  the English ones are indexed.
- **One new post a week** for the first month is enough. Four good guides beat twenty thin ones. Ideas: school-year
  screen time, first phone for a Grade 5 child, YouTube and TikTok age ratings, what Family Link does and doesn't do.
- The setup articles tell parents the phone apps are coming soon. Remove that note when the apps ship.

---

## 6. Measurement

eGuard's privacy promise has to hold for its own analytics too. Use a cookieless tool on public pages only, and
never put ad pixels on signed-in pages, where children's names and locations appear.

**Tools**

- **Vercel Web Analytics** on the landing page, blog, help pages and sign-up: cookieless and one line to add. Add
  Speed Insights for real-device load times.
- **Search Console** for queries, impressions and indexing.
- Add a Meta Pixel only if you run Facebook ads, only on public pages, and add it to the privacy policy's Cookies
  section first: the policy currently says eGuard uses no analytics or tracking cookies.

**The funnel to watch**

1. Landing visit → **Create account**
2. Account → **email verified**
3. Verified → **first child added**
4. Child → **first device paired**: the moment eGuard delivers value
5. Paired → **upgrade** to Plus or Family Pro

You can count all five from your own database, so this funnel needs no third-party tracking:
`DATABASE_URL=<production url> npm run funnel` shows families created in the last 30 days (`-- --days 7` for a
week, `-- --days 0` for all time), leaving out the review demo family. Code: [scripts/funnel.ts](../scripts/funnel.ts).

---

## 7. Where to announce

Start where Filipino parents already talk, and lead with a useful guide rather than a sales pitch. Every link you
share shows the new share image.

**Parent communities**

- Facebook parenting and homeschool groups: read each group's rules and ask the admin before posting. Share a blog
  post or help article first; mention eGuard only as the tool that checks the settings.
- Mom and parenting creators on Facebook and TikTok: offer a Family Pro plan for an honest walkthrough. Any
  sponsored post must be labeled as sponsored.

**Schools and communities**

- The landing page has a "Built for Families, Schools and Communities" section. Offer PTAs and school guidance
  offices a free parents' session on screen time, with a one-page handout that links to the guides.
- Take one school from pilot to a real quote. Only then say a school uses eGuard.

**Launch platforms and directories**

- Product Hunt: launch on a Tuesday–Thursday, with the verification angle in the tagline.
- AlternativeTo (as an alternative to Family Link, Qustodio and Bark), SaaSHub and BetaList.
- A Google Business Profile for DevCom Digital Marketing Services (Baybay City, Leyte) can link to eGuard, since
  there's now a registered address to show.

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
| 1–5 | Trust **(done)** | Rating and user claims removed; alerts copy fixed; `/privacy` and `/terms` published with DevCom as controller; store badges replaced and dead links removed. |
| 4–8 | Identity | Connect `www.eguard.family` and redirect `eguard.family` and `vercel.app` to it with a 308; set `APP_URL`. Set up SPF, DKIM and DMARC; send a test verification email to Gmail and Yahoo. |
| 6–10 | Findable **(code done)** | Deploy, then verify Search Console and Bing and submit the sitemap. Check a shared link in Messenger and with the Facebook Sharing Debugger; run the Rich Results Test. |
| 10–18 | Content **(help and three posts done)** | Write one new post a week. Add Vercel Analytics to the public pages. |
| 18–30 | Announce | Share guides in two or three Facebook parent groups, with admin permission. Pitch one school for a parents' session. Launch on Product Hunt and submit to directories in the same week. On day 30, review the funnel: how many sign-ups reached a paired device, and where people drop off. |

---

## 9. Checklist

**Trust**

- [x] Rating card, "thousands of parents" and unverified "trusted by" copy removed or rewritten
- [x] `/privacy` and `/terms` live, with DevCom's Data Protection Officer, address and privacy email
- [ ] Both legal pages reviewed by a lawyer
- [ ] DPO designated by name with the National Privacy Commission
- [x] Store badges replaced with "coming soon"; no link points to `#`
- [x] Alerts copy describes email and in-app alerts until push ships
- [x] Newsletter box removed until there's a mailing list

**Domain and email**

- [ ] `www.eguard.family` is primary; `eguard.family` and `vercel.app` redirect to it with a 308
- [ ] `APP_URL` set to `https://www.eguard.family` in Production
- [ ] `SUPPORT_EMAIL` set to `support@devcomdigital.com` in Production
- [ ] SPF, DKIM and DMARC pass for `eguard.family`; test email reaches the Gmail inbox; `MAIL_FROM` switched

**Search and sharing**

- [x] Base URL, Open Graph, X tags and canonical set on every public page
- [x] 1200 × 630 share images added
- [ ] Share image checked in the Facebook Sharing Debugger (after deploy)
- [x] `robots.txt` and `sitemap.xml` return 200
- [x] Signed-in, forgot-password and reset-password pages are `noindex`
- [x] JSON-LD added, with no rating in it
- [ ] JSON-LD passes Google's Rich Results Test (after deploy)
- [ ] Search Console and Bing verified; sitemap submitted

**Content and measurement**

- [x] 10 help articles public at `/help/[slug]` and in the sitemap
- [x] First guides published: three posts at `/blog`
- [ ] One new post a week for the first month
- [ ] Cookieless analytics on public pages only
- [x] Sign-up → paired device funnel counted from the database (`npm run funnel`)

**Announce**

- [ ] Press kit ready: logos, 3 demo-family screenshots, founder quote
- [ ] Shared in parent groups with admin permission
- [ ] One school approached for a parents' session
- [ ] Product Hunt launch and directory listings
