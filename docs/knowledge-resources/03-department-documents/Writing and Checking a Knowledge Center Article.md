# Writing and Checking a Knowledge Center Article

## Summary

The Knowledge Center article procedure describes how a new or changed article is written, fact-checked, tested and published in the eGuard Knowledge Center, the library of free guides for parents at www.eguard.family/learn. It is for the people who write and check content and for engineering, because articles live in the website's code. The Knowledge Center holds 100 articles in 11 topics, written to answer the searches Filipino parents make, not to sell the product. Every article follows the content rules (useful first, Philippine context, hedged platform details, never telling parents to save sexual images of a child) and passes the automated content checks before it is published. Facts were last checked when the articles were written on 4 October 2026 and must be re-checked every six months.

## Purpose of the Knowledge Center article procedure

The Knowledge Center article procedure makes sure every guide is accurate, safe for parents and children, written for the Philippines, and technically sound (no broken links, no orphan pages). The Knowledge Center is the main asset of eGuard's search strategy, so mistakes in it are both a safety risk and a visibility risk.

## When the Knowledge Center article procedure applies, and when it does not

The Knowledge Center article procedure applies to:

- writing a new article in one of the 11 topics;
- editing an existing article;
- the fact check before the Knowledge Center is announced, and the re-check every six months;
- a Tagalog version of an existing guide (planned once the English guides are indexed by search engines).

The Knowledge Center article procedure does not apply to:

- blog posts, which carry product news (the blog stays in the website footer);
- help articles about using eGuard, the age guides and in-app text (they may link to Knowledge Center guides);
- the customer FAQ (see "Customer FAQ").

## Roles involved in a Knowledge Center article

| Role | Responsibility |
|---|---|
| Writer | Drafts or edits the article, following the content rules. [TO CONFIRM: writer role] |
| Fact checker | Confirms hotlines, laws and platform features against official sources and updates the `reviewed` date. [TO CONFIRM: fact-checker role] |
| Child-protection reviewer (optional) | A child-protection partner, for example a CPU, an NGO or the CICC, reviews the exploitation and reporting guides. [TO CONFIRM: whether a partner reviewer is engaged, and who] |
| Engineer | Adds the article to the code, runs the content tests, deploys. |
| Approver | Approves the article for publishing. [TO CONFIRM: approver role] |

## Inputs needed before writing a Knowledge Center article

1. The topic the article belongs to, and the search it answers (see "Knowledge Center topics").
2. The official sources for every fact: hotlines, laws (RA numbers), platform settings.
3. The slug (the page address `/learn/<slug>`), title and description (170 characters at most). Slugs and titles must be unique.
4. The other articles it will link to and be linked from, including its topic's pillar article.
5. Access to the website's code and a working test setup (engineering).

## Knowledge Center topics

| Topic | Page | Main search it targets | Articles |
|---|---|---|---|
| Online safety basics | `/learn/topics/online-safety` | how to protect kids online, child online safety Philippines | 10 |
| Parental controls | `/learn/topics/parental-controls` | parental control Philippines | 10 |
| Screen time | `/learn/topics/screen-time` | screen time children | 10 |
| Grooming and exploitation | `/learn/topics/exploitation` | online grooming, sextortion, OSAEC Philippines | 10 |
| Cyberbullying | `/learn/topics/cyberbullying` | cyberbullying Philippines | 10 |
| Social media | `/learn/topics/social-media` | social media safety kids | 10 |
| TikTok | `/learn/topics/tiktok` | TikTok safety for kids | 8 |
| Roblox and gaming | `/learn/topics/gaming` | Roblox safety parents | 12 |
| Discord and chat apps | `/learn/topics/chat-apps` | Discord safety parents | 6 |
| AI safety | `/learn/topics/ai` | AI safety children | 8 |
| Digital parenting | `/learn/topics/digital-parenting` | digital parenting Philippines | 6 |

Each topic has a pillar article, listed first on its topic page; the other articles link back to it and to each other.

## Content rules for Knowledge Center articles

| Rule | What it means |
|---|---|
| Useful first | No product pitches in the body. The page adds one short eGuard box at the end, which is enough. |
| Philippine context | Pesos, local apps (Messenger, Viber, GCash, Maya, MLBB), school terms, Philippine laws and hotlines. |
| Hedge platform details | Apps rename settings constantly. Say what a setting does and roughly where it is, and that names may differ. |
| Child safety | Never tell parents to save sexual images of a child, even as evidence. Every reporting guide says this. |
| Last checked | Update the article's `reviewed` date whenever its facts are checked. The page shows it as "Last checked". |

## Format rules for Knowledge Center articles

Articles are written in a small Markdown subset:

- `##` and `###` headings and paragraphs;
- `- ` and `1. ` lists, never nested;
- `> ` notes;
- `|` tables;
- `**bold**`;
- links to other guides in the form `[text](/learn/slug)`.

## Knowledge Center article procedure, steps 1 to 5: writing

1. **Writer:** choose the topic and the search the article answers. If the subject is product news, then it belongs on the blog, not in the Knowledge Center; stop.
2. **Writer:** draft the article following the content rules and format rules, with the slug, title and description described in "Inputs needed before writing a Knowledge Center article".
3. **Writer:** link the article to its topic's pillar article and to related articles, and decide which existing articles will link to it. An article nothing links to fails the content checks.
4. **Fact checker:** check every hotline, law and platform setting in the article against official sources. If the article covers grooming, exploitation or reporting, then send it to the child-protection reviewer as well, where one is engaged.
5. **Fact checker:** set the article's `reviewed` date to the date of the check.

## Knowledge Center article procedure, steps 6 to 10: testing and publishing

6. **Engineer (website code):** add the article as an object in its topic's file in `src/lib/learn/articles/`, and add links to it from the chosen existing articles.
7. **Engineer:** if the article is new, then change the article count that the content test pins (100 as of 4 October 2026).
8. **Engineer:** run `npx vitest run src/lib/learn`. The tests fail on broken internal links, nested lists, unmatched `**`, duplicate slugs or titles, descriptions over 170 characters, and articles nothing links to. If a test fails, then fix the article and run the tests again.
9. **Approver:** approve the article for publishing. If changes are needed, then go back to step 2.
10. **Engineer:** deploy the website. The article appears at `/learn/<slug>` and in the sitemap, with its `reviewed` date as the last-modified date, and carries its own share image and structured data.

## Facts to check before launch and every six months

The articles were written on 4 October 2026 from what was known then. Before the Knowledge Center is announced, and every six months after, the fact checker confirms against official sources:

| Area | What to check |
|---|---|
| Hotlines | CICC 1326, NCMH crisis line 1553, Bantay Bata 163, 911; the PNP ACG, PNP WCPC and NBI Cybercrime reporting channels |
| Laws | RA numbers and what each covers in `philippine-laws-protecting-children-online` and `child-online-safety-philippines`, especially the claims that RA 11930 covers digitally created images and that the 2025 BSP order removed gambling links from e-wallets |
| Platform features (change most often) | TikTok teen defaults and Family Pairing options, Instagram and Facebook Teen Accounts, Roblox chat age checks and maturity labels, Discord Family Center, ChatGPT parental controls, Character.AI's under-18 change, Snapchat Family Center |
| Home Wi-Fi | Family DNS addresses in `home-wifi-parental-controls` |
| Image removal services | Take It Down (takeitdown.ncmec.org) and StopNCII availability from the Philippines |

Each checked article gets a new `reviewed` date (step 5) and is published through steps 6 to 10.

## Approvals required for a Knowledge Center article

| What | Who approves | Limit |
|---|---|---|
| Publishing a new or changed article | [TO CONFIRM: approver role] | Not applicable |
| Grooming, exploitation and reporting guides | [TO CONFIRM: approver role; whether partner review is required] | Not applicable |
| Announcing the Knowledge Center publicly | [TO CONFIRM: approver role] | Only after the pre-launch fact check |

## Exceptions to the Knowledge Center article procedure

| Situation | What to do |
|---|---|
| A fact cannot be confirmed from an official source | Hedge it or remove it; do not publish an unconfirmed hotline or law. [TO CONFIRM: rule for unconfirmed facts] |
| A platform has renamed or moved a setting | Follow the "Hedge platform details" rule in "Content rules for Knowledge Center articles". |
| A parent or partner reports an error in a published article | [TO CONFIRM: how reported errors reach the writer, and the fix target] |
| A Tagalog version | Write it once the English guide is indexed; how translations are stored and checked is [TO CONFIRM: process for Tagalog versions]. |

## Outputs of the Knowledge Center article procedure and where they are recorded

| Output | Where it is recorded |
|---|---|
| Article text | The topic's file in `src/lib/learn/articles/` |
| Topic title, intro and pillar article | `src/lib/learn/topics.ts` |
| Date of the last fact check | The article's `reviewed` date, shown as "Last checked" and used in the sitemap |
| Test results | The content test run (`src/lib/learn/learn.test.ts`) |
| Published page | `/learn/<slug>`, its topic page and the `/learn` index with search |
| Search performance | Google Search Console, once the sitemap is submitted |

## Time targets for Knowledge Center articles

| Item | Target |
|---|---|
| Pre-launch fact check | Before the Knowledge Center is announced |
| Re-check of facts | Every six months; the first is due around April 2027 (six months after 4 October 2026) |
| Tagalog versions of the top guides | Once the English guides are indexed |
| Writing and review turnaround | [TO CONFIRM] |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Brand Voice and Writing Style Guide; Products and Services Catalogue; Customer FAQ; Engineering Standards and Release Procedure; Systems Overview |

## Open questions

1. [TO CONFIRM: writer role].
2. [TO CONFIRM: fact-checker role]. knowledge-center.md says only "Have someone confirm these against official sources".
3. [TO CONFIRM: whether a partner reviewer is engaged, and who]. knowledge-center.md says "Consider having a child-protection partner … review".
4. [TO CONFIRM: approver role] for publishing articles; [TO CONFIRM: approver role; whether partner review is required] for grooming, exploitation and reporting guides; [TO CONFIRM: approver role] for announcing the Knowledge Center.
5. [TO CONFIRM: rule for unconfirmed facts].
6. [TO CONFIRM: how reported errors reach the writer, and the fix target].
7. [TO CONFIRM: process for Tagalog versions].
8. [TO CONFIRM: writing and review turnaround].
9. [TO CONFIRM: owner role], effective date and review date for this SOP.
10. Whether the pre-launch fact check has been done is not stated. knowledge-center.md lists it under "Check before launch" with no result; the fact sheet gives "every six months from 4 October 2026" as the re-check schedule. Confirm whether the Knowledge Center has been announced and whether the check was done.
11. knowledge-center.md says "the blog stays for product news" and "The header's 'Learn' link replaced 'Blog', which is still in the footer". Confirm whether any process exists for blog posts, which this SOP does not cover.
