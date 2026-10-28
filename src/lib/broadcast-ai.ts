import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { ServiceError } from "./errors";
import { KIND_LABEL, PLACEHOLDER_RE, type BroadcastKind } from "./broadcasts";

/**
 * "Write with AI" in console › Email (docs/console.md §8): staff say what they want to tell parents, and an AI model
 * drafts the subject and message. Staff always review it: the result only fills the form, nothing is sent from here.
 * Only what staff typed goes to the provider, never any parent's data.
 *
 * Providers: Claude (ANTHROPIC_API_KEY) or OpenAI (OPENAI_API_KEY). With both keys, Claude, unless AI_PROVIDER says
 * "openai". Both get the same instructions and return the same subject and body.
 */

export type AiProvider = "anthropic" | "openai";
export const AI_PROVIDER_LABEL: Record<AiProvider, string> = { anthropic: "Claude", openai: "OpenAI" };

const CLAUDE_MODEL = "claude-opus-5-5";
/** OPENAI_MODEL overrides it, e.g. to a model the account has access to */
const OPENAI_MODEL = "gpt-5.5";

/** Which provider drafts: AI_PROVIDER if set (and its key is), else whichever key is set, Claude first. Null: none. */
export function aiProvider(env: Record<string, string | undefined> = process.env): AiProvider | null {
  const has = { anthropic: !!env.ANTHROPIC_API_KEY?.trim(), openai: !!env.OPENAI_API_KEY?.trim() };
  const want = env.AI_PROVIDER?.trim().toLowerCase();
  if (want === "anthropic" || want === "claude") return has.anthropic ? "anthropic" : null;
  if (want === "openai") return has.openai ? "openai" : null;
  return has.anthropic ? "anthropic" : has.openai ? "openai" : null;
}

export const aiAvailable = () => !!aiProvider();

let anthropicClient: Anthropic | undefined;
const anthropic = () => (anthropicClient ??= new Anthropic({ timeout: 90_000, maxRetries: 1 }));
let openaiClient: OpenAI | undefined;
const openai = () => (openaiClient ??= new OpenAI({ timeout: 90_000, maxRetries: 1 }));

export const AiDraftSchema = z.object({
  brief: z.string().trim().min(10, "Say a bit more about what the email should tell parents.").max(4000, "Keep the brief under 4,000 characters."),
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
  const audience = `${KIND_LABEL[d.kind as BroadcastKind]}, to parents on ${d.plans.length ? d.plans.join(", ") : "every plan"}`;
  const current = d.subject.trim() || d.body.trim();
  return current
    ? `Revise this email (${audience}) as asked.\n\n<current_subject>${d.subject}</current_subject>\n<current_body>\n${d.body}\n</current_body>\n\n<request>\n${d.brief}\n</request>`
    : `Write this email (${audience}).\n\n<brief>\n${d.brief}\n</brief>`;
}

type Draft = z.infer<typeof Output>;

const refused = () => new ServiceError(422, "The AI wouldn't write this one. Try wording the brief differently.", "refused");
const incomplete = () => new ServiceError(502, "The AI's draft came back incomplete. Try again.", "upstream");

async function viaClaude(d: z.output<typeof AiDraftSchema>): Promise<Draft> {
  let res;
  try {
    res = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      // A short, careful piece of writing: medium is this model's default, set so it doesn't drift
      output_config: { effort: "medium", format: betaZodOutputFormat(Output) },
      // If a safety check declines, the API retries on a model it picks, in the same call
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: prompt(d) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw keyRefused("Anthropic");
    if (e instanceof Anthropic.RateLimitError) throw busy();
    if (e instanceof Anthropic.APIError) throw unreachable(e);
    throw e;
  }
  if (res.stop_reason === "refusal") throw refused();
  if (res.stop_reason === "max_tokens" || !res.parsed_output) throw incomplete();
  return res.parsed_output;
}

async function viaOpenAI(d: z.output<typeof AiDraftSchema>): Promise<Draft> {
  let res;
  try {
    res = await openai().responses.parse({
      model: process.env.OPENAI_MODEL?.trim() || OPENAI_MODEL,
      instructions: SYSTEM,
      input: prompt(d),
      max_output_tokens: 8000,
      text: { format: zodTextFormat(Output, "broadcast_email") },
      // Nothing to keep: each draft stands alone
      store: false,
    });
  } catch (e) {
    if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) throw keyRefused("OpenAI");
    if (e instanceof OpenAI.NotFoundError) throw new ServiceError(503, "Writing with AI isn't working: OpenAI doesn't offer that model to this account (OPENAI_MODEL).", "unavailable");
    if (e instanceof OpenAI.RateLimitError) throw busy();
    if (e instanceof OpenAI.APIError) throw unreachable(e);
    throw e;
  }
  const said = res.output.flatMap((o) => (o.type === "message" ? o.content : []));
  if (said.some((c) => c.type === "refusal")) throw refused();
  if (res.status === "incomplete" || !res.output_parsed) throw incomplete();
  return res.output_parsed;
}

const keyRefused = (who: string) => new ServiceError(503, `Writing with AI isn't working: the ${who} API key was refused.`, "unavailable");
const busy = () => new ServiceError(429, "The AI is busy. Try again in a minute.", "rate_limited");
function unreachable(e: unknown) {
  console.error("[broadcast-ai] request failed", e);
  return new ServiceError(502, "The AI couldn't be reached. Try again, or write it yourself.", "upstream");
}

/** The subject and message drafted, ready to put in the form. Throws a ServiceError with a message for staff. */
export async function draftBroadcast(input: AiDraftInput) {
  const provider = aiProvider();
  if (!provider) throw new ServiceError(503, "Writing with AI isn't set up: set ANTHROPIC_API_KEY or OPENAI_API_KEY on this server.", "unavailable");
  const d = AiDraftSchema.parse(input);
  const out = provider === "openai" ? await viaOpenAI(d) : await viaClaude(d);
  const subject = out.subject.trim().replace(/\s+/g, " ").slice(0, 150);
  const body = out.body.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, 20_000);
  if (!subject || !body) throw new ServiceError(502, "The AI's draft came back empty. Try again.", "upstream");
  return { subject, body, placeholders: PLACEHOLDER_RE.test(`${subject}\n${body}`), provider };
}
