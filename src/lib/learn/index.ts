/** Knowledge center articles. Static like the blog and help articles; one file per topic under ./articles. */
import { plainText } from "./markdown";
import { TOPICS, topicById } from "./topics";
import type { Article } from "./types";
import { AI } from "./articles/ai";
import { CHAT_APPS } from "./articles/chat-apps";
import { CYBERBULLYING } from "./articles/cyberbullying";
import { DIGITAL_PARENTING } from "./articles/digital-parenting";
import { EXPLOITATION } from "./articles/exploitation";
import { GAMING } from "./articles/gaming";
import { ONLINE_SAFETY } from "./articles/online-safety";
import { PARENTAL_CONTROLS } from "./articles/parental-controls";
import { SCREEN_TIME } from "./articles/screen-time";
import { SOCIAL_MEDIA } from "./articles/social-media";
import { TIKTOK } from "./articles/tiktok";

export type { Article, Topic, TopicId } from "./types";
export { TOPICS, topicById };

export const ARTICLES: Article[] = [
  ...ONLINE_SAFETY, ...PARENTAL_CONTROLS, ...SCREEN_TIME, ...EXPLOITATION, ...CYBERBULLYING, ...SOCIAL_MEDIA,
  ...TIKTOK, ...GAMING, ...CHAT_APPS, ...AI, ...DIGITAL_PARENTING,
];

const BY_SLUG = new Map(ARTICLES.map((a) => [a.slug, a]));
export const articleBySlug = (slug: string) => BY_SLUG.get(slug) ?? null;

/** A topic's articles, pillar first. */
export function articlesIn(topicId: string) {
  const topic = topicById(topicId);
  const list = ARTICLES.filter((a) => a.topic === topicId);
  return topic ? [...list.filter((a) => a.slug === topic.pillar), ...list.filter((a) => a.slug !== topic.pillar)] : list;
}

/** Up to `n` articles to read next: ones this article links to first, then its neighbours in the same topic. */
export function relatedTo(article: Article, n = 3) {
  const linked = [...article.body.matchAll(/\]\(\/learn\/([a-z0-9-]+)\)/g)].map((m) => m[1]);
  const siblings = articlesIn(article.topic).map((a) => a.slug);
  const at = siblings.indexOf(article.slug);
  const after = [...siblings.slice(at + 1), ...siblings.slice(0, at)];
  const picked: Article[] = [];
  for (const slug of [...linked, ...after]) {
    const a = BY_SLUG.get(slug);
    if (a && a.slug !== article.slug && !picked.includes(a)) picked.push(a);
    if (picked.length === n) break;
  }
  return picked;
}

/** About 220 words a minute, rounded up. */
export const readMinutes = (a: Article) =>
  Math.max(1, Math.ceil(plainText([a.title, ...a.takeaways, a.body].join(" ")).split(/\s+/).filter(Boolean).length / 220));

export const reviewedDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const newestReview = () => ARTICLES.map((a) => a.reviewed).sort().at(-1)!;
