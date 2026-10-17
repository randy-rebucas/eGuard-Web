# Marketing site review

Review of the public pages: the landing page (`src/app/page.tsx`) and everything in `src/app/(site)/`. Done 2026-10-17. The goal is to make the site more informative and more engaging. Each suggestion is ranked by impact against effort.

## Status (2026-10-17)

**Built:** items 1–10, 12, 15 and 16, plus the smaller fixes. In detail:

| # | What | Where |
|---|---|---|
| 1 | Hero: "Parental controls that prove they're on", concrete checklist | `src/app/page.tsx` |
| 2 | "Saved isn't the same as on" section replaces the Purpose band (`family-sunset.jpg` is no longer used) | `page.tsx`, `landing.css` `.lp-verify` |
| 3 | Feature cards are links with concrete copy (protection pages, how-it-works anchors) | `page.tsx` `FEATURES` |
| 4 | Resources band: 4 age-guide cards with suggested settings, 3 starter guides, family agreement | `page.tsx` `.lp-res` |
| 5 | Header: Protections · How It Works · Pricing · Resources ▾ · Security. Menu button now below 1120px | `src/components/site-chrome.tsx` |
| 6 | Every public CTA uses `StartLink` (signed-in parents go to the dashboard) | `(site)/**` |
| 7 | `/for-schools`, linked from the landing audiences, footer, pricing FAQ, security page and sitemap. Reworked the same day: hero actions and quick facts, a sponsor-cost estimator using the checkout's own maths (`for-schools/estimator.tsx`), an organizer FAQ, and compact steps on phones | `(site)/for-schools/` |
| 8 | Knowledge Center end-box by topic, with protection chips; grooming/exploitation guides show "How to report" instead | `(site)/learn/[slug]/page.tsx` `TOPIC_CTA` |
| 9 | Blog repositioned as product news (title, lede pointing to the Knowledge Center) and given a CTA band | `(site)/blog/page.tsx` |
| 10 | "Which plan fits?" finder on Pricing (children, phones, browsers, location, gaming limit) | `(site)/pricing/plan-finder.tsx` |
| 12 | Setup video on `/how-it-works` too (ID shared in `src/lib/setup-video.ts`) | `how-it-works/page.tsx` |
| 15 | Verification steps reveal on scroll (CSS scroll-driven, off for reduced motion and unsupported browsers) | `landing.css` |
| 16 | `/protections` grouped by goal with "I'm worried about…" shortcuts; the build fails if a protection has no group | `(site)/protections/page.tsx` |
| — | Landing FAQ +4 questions; habits rewritten as real routines; final CTA offers the age guides | `page.tsx` |

**Built 2026-10-17 (the three left over):**

| # | What | Where |
|---|---|---|
| 11 | Mailing lists with double opt-in: **eGuard news** in every footer, **iPhone launch** on the new `/iphone` page (what eGuard will do on iPhone, protection by protection, and what works today). Every "iPhone coming soon" links there. Staff send to a list from console › Email. Privacy Policy has a **Mailing lists** section. | `src/lib/subscribers.ts`, `(site)/iphone/`, docs/console.md §8 |
| 13 | `/fil/for-kids`: the kids page and printable family agreement in Filipino, with hreflang both ways and a language switch. Both languages share one layout (`for-kids/kids-page.tsx`); the copy is in `for-kids/copy.tsx`. | `(site)/for-kids/`, `(site)/fil/for-kids/` |
| 14 | Proof that's true now: "Built in Baybay City, Leyte" on the landing page and a **Who's behind eGuard** block on About. Slots for real proof that render nothing until filled (below), and a **Share your story** request on About whose email template asks for consent. | `src/lib/social-proof.ts`, `page.tsx` `ProofBand` |

**Before promoting `/fil/for-kids`:** have a native Filipino speaker read `for-kids/copy.tsx` (the `fil` block), ideally with a child of the right age. It was written carefully, but not by a native speaker. Button names in the app stay in English on purpose, since that's what the child sees.

### Social proof: how to add it

All in `src/lib/social-proof.ts`. The landing page's "What parents say" band appears on its own once any of these is set.

- **A parent's quote:** add `{ quote, name, consentedOn }` to `TESTIMONIALS`, only after they replied "Yes" to being quoted (the About page's **Share your story** email asks). Use the name they chose. Keep their email.
- **Google Play rating:** copy the stars and review count from the Play Console into `PLAY_RATING` with `checkedOn`. It shows only from 20 reviews (`MIN_PLAY_REVIEWS`). Update it monthly or set it back to `null`. It's never put in JSON-LD.
- **Press:** add `{ outlet, title, url, date }` to `PRESS` once an article has actually run.

## What's already strong

- **How it works** (`/how-it-works`) is the best page on the site. The device mock-ups, the "follow one setting" timeline, the "what if…" answers and the sees / never-sees privacy split are concrete and honest. It sets the standard the other pages should meet.
- **Security** (`/security`) gives real numbers: the retention table, argon2id, signed browser rules, RA 10173. It's specific enough to reassure a school reviewer.
- **For kids** (`/for-kids`) and its printable family agreement are a strong idea that competitors rarely offer.
- **Pricing** is built from the plan catalogue, so prices and limits never drift from what the server enforces.
- **Knowledge Center** has 100 guides with takeaways, a "last checked" date, related reading and a CTA. That's a real SEO asset.

## The core problem

eGuard's difference is that **every setting is verified on the device**, and the landing page undersells it. The idea appears in the page metadata ("parental controls you can verify"), but the visitor reads:

- An H1 that could belong to any product: *"A Safer Digital World for Their Brighter Tomorrow"*. The tagline in the header says "Brighter Tomorrows" too.
- Filler checklist items ("Peace of mind").
- Six one-line feature cards ("Set healthy device limits").
- A "Purpose" section of values copy with a sunset photo.

The verified-vs-saved story only shows up properly on `/how-it-works`, which most visitors never reach. Meanwhile the site's best content (100 guides, age guides, the kids page, the family agreement) isn't linked from the landing page at all.

## Recommendations

### P1: high impact, low to medium effort

1. **Rewrite the hero around the differentiator.** For example, H1: *"Parental controls that prove they're on"*. Lede: *"Set screen time, bedtime, app and web rules on your child's Android phone and browser, and see each one confirmed on the device."* Replace "Peace of mind" with something concrete ("Works on Android, Chrome, Edge and Firefox"). Keeping "parental controls" in the H1 also helps search.
2. **Replace the "Purpose" section with a "Saved vs Verified" comparison.** Two columns: *Other apps: you tap Save, and hope.* / *eGuard: the device reports back → Verified, Pending or Failed.* Reuse the `hw-track` timeline or a small version of it, and link to `/how-it-works#verified`. This turns the values copy into the reason to choose eGuard.
3. **Make the feature cards informative and clickable.** Each card should link to its `/protections/[slug]` page and carry one concrete line, such as *"Bedtime: apps lock at 9:30 PM and come back in the morning"*, plus the Android and iPhone capability chips that `/protections` already renders.
4. **Add a "Resources for parents" band to the landing page,** above the FAQ:
   - an **age picker** (5–8 / 9–12 / 13–15 / 16–17) that links to `/guides/[slug]` and previews the suggested screen time and bedtime (the data is already in `age-guides.ts` and `profiles.ts`);
   - 3 "Start here" Knowledge Center guides;
   - the **family agreement** ("Print it and fill it in with your child").
   This gives visitors who aren't ready to sign up something useful to do, and links the landing page to the content that ranks in search.
5. **Restructure the header nav.** Today 5 of its 8 items are anchors on the landing page. "For Parents" → `#habits` is confusing, and Protections and Security aren't in the nav at all. Suggested nav: **Protections · How it works · Pricing · Resources** (Knowledge Center, Guides by age, Blog, Help, For kids) **· Security**. Keep landing-page anchors out of the nav.
6. **Fix the CTA inconsistency.** About, Protections, Security and the blog, help, guides and protection detail pages link straight to `/register`. Pricing and the landing page use `StartLink` / `SignedIn`, which send signed-in parents to their dashboard. Use `StartLink` everywhere.

### P2: medium impact

7. **Add a schools and organizations page (`/for-schools`).** The landing page names Schools, Communities and Businesses as audiences, but those items aren't links and no page explains organizations. The product supports join codes, sponsor codes with batch discounts, and API keys (see `docs/organizations.md`). A dedicated page covering what an organization sees (counts only), how sponsoring works, and a contact CTA would also give the pricing FAQ and security page something to link to.
8. **Make the Knowledge Center CTA match the topic.** Every article ends with the same "Try eGuard free" box. A screen-time article should point to `/protections/screen-time` and the matching age guide. A TikTok, Roblox or Discord article should point to app rules and content ratings. A grooming or exploitation article should keep the reporting resources first and keep the product pitch quiet. Add an optional `protections: [...]` field to each article.
9. **Decide what the blog is for.** It has 3 posts, all dated 2026-09-28, and its metadata title ("Parental control guides for Filipino parents") overlaps with the Knowledge Center's. Either fold it into the Knowledge Center as "Product notes", or give it a separate job (product updates, the iOS launch, new protections) and keep a steady posting schedule. Three posts from one day make the site look abandoned within a few months.
10. **Add a "Which plan fits?" helper to Pricing.** Two inputs, number of children and number of devices (phones + browsers), then highlight the matching plan. Device counting ("Chrome and Edge count as two") is the most confusing part, and the helper answers it before checkout.
11. **Add a "Notify me" option for iOS.** Every iOS badge is a dead end ("iOS coming soon"). An email sign-up turns that interest into a launch list. It also starts the mailing list that the footer comment in `site-chrome.tsx` is waiting for.
12. **Show the setup video on `/how-it-works`** next to the "Setting up" steps. It currently appears only on the landing page.

### P3: larger bets

13. **Filipino / Taglish versions of the landing page, For kids and the top Knowledge Center guides.** The site is aimed at families in the Philippines, but everything is in English. Tagalog versions of the for-kids page and the family agreement would especially help younger children. Use `hreflang` for `fil-PH`.
14. **Honest social proof.** There are no testimonials, and the code rightly avoids a fake `aggregateRating`. While there are none, show proof that is true: the Google Play listing and rating once it has reviews, "Made in the Philippines", a short founder note on About, and press coverage (`docs/press-release.md`). Add real parent quotes, with consent, once beta families provide them.
15. **Animate the verification timeline** on `/how-it-works` and the new landing-page section: steps fill in as you scroll and end on "Verified". Respect `prefers-reduced-motion`. It's the most memorable thing eGuard can show, so it's worth some motion.
16. **Group `/protections` by goal** (Time · Apps & content · Web · Safety & location), with an "I'm worried about…" entry point (too much gaming, bedtime, strangers, adult content). Each goal leads to the protections that address it.

## Smaller fixes

- The header tagline and the H1 both use "brighter tomorrow". Keep it in one place at most.
- `HABITS` on the landing page repeats the feature grid ("Manage apps and content access"). Either merge it with the features or rewrite it around routines (school nights, weekends, meals).
- The landing-page FAQ has 5 questions. Add the questions parents actually ask: *"Will my child know?"*, *"Can my child uninstall it?"* (uninstall protection), *"Does it work offline?"*, *"What can I see?"*. The answers already exist on `/how-it-works`.
- The blog index has no CTA band, unlike every other index page.
- The final landing-page CTA repeats the hero exactly. Use it for a different action, for example *"Not ready? Read the guide for your child's age"*.

## Suggested order

1. Hero rewrite + Saved vs Verified section + clickable features (items 1–3): one PR, landing page only.
2. Nav restructure + `StartLink` everywhere (5–6).
3. Resources band with the age picker (4).
4. Topic-aware Knowledge Center CTAs (8) and the blog decision (9).
5. `/for-schools` (7), the plan helper (10), the iOS notify list (11).
6. Localization and social proof (13–14) when there's content and capacity for them.
