import "server-only";
import { z } from "zod";
import { ServiceError } from "./errors";
import { BROADCAST_AUDIENCES, KIND_LABEL, PLACEHOLDER_RE, type BroadcastKind } from "./broadcasts";
import { LIST_COPY, isMailingList } from "./subscribers";
import { structured } from "./ai";

/**
 * "Write with AI" in console › Email (docs/console.md §8): staff say what they want to tell parents, and an AI model
 * drafts the subject and message. Staff always review it: the result only fills the form, nothing is sent from here.
 * Only what staff typed goes to the provider, never any parent's data. Providers and errors: lib/ai.
 */

export { AI_PROVIDER_LABEL, aiAvailable, aiProvider, type AiProvider } from "./ai";

export const AiDraftSchema = z.object({
  brief: z.string().trim().min(10, "Say a bit more about what the email should tell parents.").max(4000, "Keep the brief under 4,000 characters."),
  audience: z.enum(BROADCAST_AUDIENCES).default("PARENTS"),
  kind: z.enum(["UPDATE", "SERVICE"]),
  plans: z.array(z.string()).max(10),
  /** What's in the form now: given, the brief is read as changes to it ("shorter", "add the date") */
  subject: z.string().max(150).default(""),
  body: z.string().max(20_000).default(""),
});
export type AiDraftInput = z.input<typeof AiDraftSchema>;

const Output = z.object({
  subject: z.string().describe("The email's subject line, under 90 characters"),
  body: z.string().describe("The message in plain text, paragraphs separated by one blank line"),
});

// Fixed, so it's the same bytes on every request
const SYSTEM = `You write emails that the eGuard team sends to many parents at once.

About eGuard: a parental control app for families in the Philippines (eguard.family). Parents set protections once \
(screen time, bedtime, app limits, safe browsing, location) and eGuard checks they stay in place on every child's \
device. Plans: Free, eGuard Plus and eGuard Family. Readers are busy parents; many read on their phones.

How the email is put together, so leave these parts out:
- "Hi <first name>," is added above your message. Don't write a greeting.
- "— The eGuard team" and a footer saying why they got the email (and, for product updates, how to unsubscribe) are \
added below it. Don't write a sign-off, signature or unsubscribe text.

Write:
- Plain text only: no Markdown, no bullets with symbols other than "- " at the start of a line, no headings, no HTML. \
Separate paragraphs with one blank line. Write links as full URLs (https://…).
- Short and clear: usually 60 to 180 words. The first sentence says what this is about. Say what the parent should do, \
if anything, and where.
- Warm and plain, in the language the brief is written in unless it asks for another (English, Filipino or Taglish).
- Only facts the brief or the current draft gives. Never invent features, prices, dates, numbers, links or promises. \
Where the email needs a fact you weren't given, write [TODO: what's missing] so the team fills it in.
- A product update can be upbeat but not pushy: no false urgency, no ALL CAPS, no exclamation-mark runs.
- A service notice is about the account, privacy, security or the service working: factual, calm and complete, \
with no marketing in it.`;

function prompt(d: z.output<typeof AiDraftSchema>) {
  // A mailing list's readers signed up on the public site and may have no account, so no "open Settings" advice
  const audience = isMailingList(d.audience)
    ? `${KIND_LABEL.UPDATE}, to the ${LIST_COPY[d.audience].name} mailing list: people without an eGuard account, perhaps, who asked for ${LIST_COPY[d.audience].promise}`
    : `${KIND_LABEL[d.kind as BroadcastKind]}, to parents on ${d.plans.length ? d.plans.join(", ") : "every plan"}`;
  const current = d.subject.trim() || d.body.trim();
  return current
    ? `Revise this email (${audience}) as asked.\n\n<current_subject>${d.subject}</current_subject>\n<current_body>\n${d.body}\n</current_body>\n\n<request>\n${d.brief}\n</request>`
    : `Write this email (${audience}).\n\n<brief>\n${d.brief}\n</brief>`;
}

/** The subject and message drafted, ready to put in the form. Throws a ServiceError with a message for staff. */
export async function draftBroadcast(input: AiDraftInput) {
  const d = AiDraftSchema.parse(input);
  const { output: out, provider } = await structured({ system: SYSTEM, prompt: prompt(d), schema: Output, name: "broadcast_email", tag: "broadcast-ai" });
  const subject = out.subject.trim().replace(/\s+/g, " ").slice(0, 150);
  const body = out.body.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, 20_000);
  if (!subject || !body) throw new ServiceError(502, "The AI's draft came back empty. Try again.", "upstream");
  return { subject, body, placeholders: PLACEHOLDER_RE.test(`${subject}\n${body}`), provider };
}
