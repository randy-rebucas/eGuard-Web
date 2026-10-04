/** Knowledge center (/learn): long-form, non-promotional articles for parents, grouped into topics. */

export type TopicId =
  | "parental-controls"
  | "screen-time"
  | "online-safety"
  | "exploitation"
  | "cyberbullying"
  | "social-media"
  | "tiktok"
  | "gaming"
  | "chat-apps"
  | "ai"
  | "digital-parenting";

export type Topic = {
  id: TopicId;
  /** Short name for chips and breadcrumbs */
  label: string;
  /** H1 of the topic page, written for the search people make */
  title: string;
  /** Meta description and card text */
  description: string;
  /** A paragraph or two at the top of the topic page */
  intro: string;
  /** The article to start with; it's listed first on the topic page */
  pillar: string;
};

export type Article = {
  slug: string;
  topic: TopicId;
  title: string;
  /** One or two sentences, used on cards and as the meta description. Keep under ~160 characters. */
  description: string;
  /** YYYY-MM-DD: when the facts (settings, ages, laws, hotlines) were last checked */
  reviewed: string;
  /** Three or four lines shown in a box at the top */
  takeaways: string[];
  /**
   * A small Markdown subset: `## ` and `### ` headings, paragraphs, `- ` and `1. ` lists, `> ` notes and
   * `|` tables, with **bold** and [links](/learn/slug) inline. See markdown.ts.
   */
  body: string;
};
