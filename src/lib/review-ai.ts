import "server-only";
import { z } from "zod";
import { structured, type AiProvider } from "./ai";
import { supportEmail } from "./support";
import { REPLY_MAX, SENTIMENTS, STORE_LABEL, TOPICS, URGENCIES, type Store } from "./store-reviews/types";

export { SENTIMENTS, TOPICS, URGENCIES, type Topic } from "./store-reviews/types";

/**
 * Store reviews read by AI (docs/console.md › Store reviews): one call sorts a review (sentiment, topics, urgency) and
 * drafts a public reply. Staff always read, edit and approve a reply before it's posted; nothing goes to a store here.
 *
 * Only the review itself goes to the provider (stars, title, words, language): never the reviewer's store name, and
 * never anything from a family's account. Reviews are public already.
 */

/** Bump when the instructions or the topic list change, so the console can tell older readings apart */
export const CLASSIFIER_VERSION = 1;

const Output = z.object({
  sentiment: z.enum(SENTIMENTS),
  topics: z.array(z.enum(TOPICS)).describe("1 to 3 topics the review is about, most important first"),
  urgency: z.enum(URGENCIES).describe("HIGH: something is broken, money, privacy or a safety worry; LOW: praise or a passing remark"),
  summary: z.string().describe("One sentence in English saying what the reviewer means"),
  likelyChild: z.boolean().describe("True if it reads like a child unhappy about being supervised, not a parent"),
  reply: z.string().describe("The public reply, plain text"),
});
export type ReviewReading = z.infer<typeof Output>;

// Fixed, so it's the same bytes on every request
const SYSTEM = `You read app store reviews of eGuard and draft the developer's public reply.

About eGuard: a parental control app for families in the Philippines (eguard.family). Parents set protections once \
(screen time, bedtime, app limits, safe browsing, location) and eGuard checks they stay in place on every child's \
device. Plans: Free, eGuard Plus and eGuard Family. Some reviews come from children who dislike being supervised.

Sort the review: its sentiment, 1 to 3 topics, urgency, a one-sentence English summary, and whether it reads like a child.

Write the reply:
- In the reviewer's language (English, Filipino or Taglish as they wrote). Warm, plain and short. No greeting by name.
- Thank them; answer what they actually said. For a problem, say how to get help: Help & support in the eGuard app, \
or email ${supportEmail()}. Never say you looked at their account, device or order: you can't see who they are.
- Never promise refunds, fixes, features or dates, and never invent facts about eGuard.
- Never ask them to change, raise or remove their rating, and never offer anything in return for one.
- To a child: kind and respectful, explain the protections were set by their parent and suggest talking to them; \
never tell them how to get around anything.
- Plain text only: no Markdown, emoji runs or links other than the support email. Sign off as "— The eGuard team".`;

export type ReviewForAi = { store: Store; rating: number; reviewTitle: string | null; text: string; language: string | null };

/** What goes to the provider: the review only, never `authorName` or account data */
export function reviewPrompt(r: ReviewForAi, maxChars: number, instruction?: string) {
  return [
    `A ${r.rating}-star review on ${STORE_LABEL[r.store]}${r.language ? ` (language: ${r.language})` : ""}.`,
    r.reviewTitle ? `<title>${r.reviewTitle}</title>` : "",
    `<review>\n${r.text || "(no written text, only stars)"}\n</review>`,
    `The reply must be at most ${maxChars} characters, sign-off included.`,
    instruction?.trim() ? `<staff_request>\n${instruction.trim()}\n</staff_request>` : "",
  ].filter(Boolean).join("\n\n");
}

const clean = (s: string) => s.trim().replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");

/**
 * Fits a reply to the store's limit by cutting at the last sentence that fits (or the last word), so a too-long
 * draft still reads whole. `trimmed` tells staff to read the ending.
 */
export function fitReply(text: string, max: number) {
  const t = clean(text);
  if (t.length <= max) return { text: t, trimmed: false };
  const cut = t.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf(".\n"));
  const end = sentence > max * 0.5 ? sentence + 1 : cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max;
  return { text: cut.slice(0, end).trim(), trimmed: true };
}

/**
 * Sorts the review and drafts a reply that fits the store. A reply over the limit is asked for again once, shorter;
 * if it's still too long it's cut (`trimmed`).
 */
export async function classifyAndDraft(r: ReviewForAi, instruction?: string): Promise<ReviewReading & { trimmed: boolean; provider: AiProvider }> {
  const max = REPLY_MAX[r.store];
  const ask = (limit: number, extra?: string) =>
    structured({ system: SYSTEM, prompt: reviewPrompt(r, limit, [instruction, extra].filter(Boolean).join("\n")), schema: Output, name: "review_reading", tag: "review-ai", maxTokens: 4000 });
  let { output, provider } = await ask(max);
  if (clean(output.reply).length > max) {
    ({ output, provider } = await ask(Math.floor(max * 0.85), `Your last reply was ${clean(output.reply).length} characters. Write it again, shorter.`));
  }
  const fitted = fitReply(output.reply, max);
  const topics = [...new Set(output.topics)].slice(0, 3);
  return { ...output, topics: topics.length ? topics : ["OTHER"], summary: output.summary.trim().slice(0, 300), reply: fitted.text, trimmed: fitted.trimmed, provider };
}
