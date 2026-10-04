# Knowledge Center

The Knowledge Center at **`/learn`** is eGuard's library of free guides for parents: 100 articles in 11 topics,
written to answer the searches Filipino parents make, not to sell the product. It's the SEO strategy's main asset;
the blog stays for product news.

## Where things live

| What | Where |
|---|---|
| Topics (title, intro, pillar article) | [src/lib/learn/topics.ts](../src/lib/learn/topics.ts) |
| Articles, one file per topic | [src/lib/learn/articles/](../src/lib/learn/articles/) |
| Article type and the Markdown subset | [src/lib/learn/types.ts](../src/lib/learn/types.ts), [markdown.ts](../src/lib/learn/markdown.ts) |
| Index with search, topic pages, article pages | [src/app/(site)/learn/](../src/app/%28site%29/learn/) |
| Content checks (links, duplicates, formatting) | [src/lib/learn/learn.test.ts](../src/lib/learn/learn.test.ts) |

URLs: `/learn`, `/learn/topics/<topic>` and `/learn/<slug>`. All are in the sitemap, with each article's `reviewed`
date as `lastModified`. Article pages carry Article and BreadcrumbList structured data and their own share image.
The header's "Learn" link replaced "Blog", which is still in the footer.

## Topics and target searches

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

Each topic has a pillar article, listed first on its topic page; the rest link back to it and to each other.

## Writing and editing an article

Add an object to the topic's file in `src/lib/learn/articles/`. The body is a template string in a small Markdown
subset: `##` and `###` headings, paragraphs, `- ` and `1. ` lists (not nested), `> ` notes, `|` tables, `**bold**` and
`[links](/learn/slug)`. Then run `npx vitest run src/lib/learn`. The tests fail on broken internal links, nested
lists, unmatched `**`, duplicate slugs or titles, descriptions over 170 characters, and articles nothing links to.
The test also pins the count at 100; change it when you add articles.

House rules:

- **Useful first.** No product pitches in the body. The page adds one short eGuard box at the end; that's enough.
- **Philippine context.** Pesos, local apps (Messenger, Viber, GCash, Maya, MLBB), school terms, Philippine laws and hotlines.
- **Hedge platform details.** Apps rename settings constantly. Say what a setting does and where it roughly is, and
  that names may differ.
- **Never tell parents to save sexual images of a child**, even as evidence. Every reporting guide says this.
- **Update `reviewed`** whenever you check an article's facts. The page shows it as "Last checked".

## Check before launch

The articles were written on 4 October 2026 from what was known at the time. Have someone confirm these against
official sources before announcing the Knowledge Center, then re-check every six months:

- **Hotlines:** CICC 1326, NCMH crisis line 1553, Bantay Bata 163, 911; the PNP ACG, PNP WCPC and NBI Cybercrime
  reporting channels. Consider having a child-protection partner (for example a CPU, an NGO or the CICC) review the
  exploitation and reporting guides.
- **Laws:** RA numbers and what each covers in `philippine-laws-protecting-children-online` and
  `child-online-safety-philippines`, especially the claims that RA 11930 covers digitally created images and that
  the 2025 BSP order removed gambling links from e-wallets.
- **Platform features:** TikTok teen defaults and Family Pairing options, Instagram and Facebook Teen Accounts, Roblox
  chat age checks and maturity labels, Discord Family Center, ChatGPT parental controls, Character.AI's under-18
  change, Snapchat Family Center. These change most often.
- **Family DNS addresses** in `home-wifi-parental-controls`.
- **Take It Down** (takeitdown.ncmec.org) and **StopNCII** availability from the Philippines.

## Next steps

- Submit the sitemap in Google Search Console and watch which topic pages pick up impressions first.
- Write Tagalog versions of the top guides once the English ones are indexed (see
  [launch-visibility.md](launch-visibility.md#5-pages-people-search-for)).
- Link to Knowledge Center guides from the help articles, the age guides and the app where a parent would need one.
