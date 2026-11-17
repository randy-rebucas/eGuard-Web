import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { ServiceError } from "./errors";

/**
 * The AI providers the console writes with: "Write with AI" for emails (lib/broadcast-ai) and store review replies
 * (lib/review-ai). Staff always review what comes back; nothing is sent to parents or stores from here.
 *
 * Providers: Claude (ANTHROPIC_API_KEY) or OpenAI (OPENAI_API_KEY). With both keys, Claude, unless AI_PROVIDER says
 * "openai". Both get the same instructions and return the same structured output.
 */

export type AiProvider = "anthropic" | "openai";
export const AI_PROVIDER_LABEL: Record<AiProvider, string> = { anthropic: "Claude", openai: "OpenAI" };

const CLAUDE_MODEL = "claude-opus-5-5";
/** OPENAI_MODEL overrides it, e.g. to a model the account has access to */
const OPENAI_MODEL = "gpt-5.5";

/** Which provider writes: AI_PROVIDER if set (and its key is), else whichever key is set, Claude first. Null: none. */
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

const refused = () => new ServiceError(422, "The AI wouldn't write this one. Try wording the brief differently.", "refused");
const incomplete = () => new ServiceError(502, "The AI's draft came back incomplete. Try again.", "upstream");
const keyRefused = (who: string) => new ServiceError(503, `Writing with AI isn't working: the ${who} API key was refused.`, "unavailable");
const busy = () => new ServiceError(429, "The AI is busy. Try again in a minute.", "rate_limited");
function unreachable(e: unknown, tag: string) {
  console.error(`[${tag}] request failed`, e);
  return new ServiceError(502, "The AI couldn't be reached. Try again, or write it yourself.", "upstream");
}

export type StructuredRequest<S extends z.ZodType> = {
  /** Fixed per use, so it's the same bytes on every request */
  system: string;
  prompt: string;
  schema: S;
  /** The output format's name (OpenAI) */
  name: string;
  /** For error logs */
  tag: string;
  maxTokens?: number;
};

/**
 * One structured call to whichever provider is set up. Throws a ServiceError with a message for staff: not set up,
 * key refused, busy, unreachable, refused, or incomplete.
 */
export async function structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<{ output: z.infer<S>; provider: AiProvider }> {
  const provider = aiProvider();
  if (!provider) throw new ServiceError(503, "Writing with AI isn't set up: set ANTHROPIC_API_KEY or OPENAI_API_KEY on this server.", "unavailable");
  const output = provider === "openai" ? await viaOpenAI(req) : await viaClaude(req);
  return { output, provider };
}

async function viaClaude<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
  let res;
  try {
    res = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: req.maxTokens ?? 8000,
      // A short, careful piece of writing: medium is this model's default, set so it doesn't drift
      output_config: { effort: "medium", format: betaZodOutputFormat(req.schema) },
      // If a safety check declines, the API retries on a model it picks, in the same call
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw keyRefused("Anthropic");
    if (e instanceof Anthropic.RateLimitError) throw busy();
    if (e instanceof Anthropic.APIError) throw unreachable(e, req.tag);
    throw e;
  }
  if (res.stop_reason === "refusal") throw refused();
  if (res.stop_reason === "max_tokens" || !res.parsed_output) throw incomplete();
  return res.parsed_output as z.infer<S>;
}

async function viaOpenAI<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
  let res;
  try {
    res = await openai().responses.parse({
      model: process.env.OPENAI_MODEL?.trim() || OPENAI_MODEL,
      instructions: req.system,
      input: req.prompt,
      max_output_tokens: req.maxTokens ?? 8000,
      text: { format: zodTextFormat(req.schema, req.name) },
      // Nothing to keep: each call stands alone
      store: false,
    });
  } catch (e) {
    if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) throw keyRefused("OpenAI");
    if (e instanceof OpenAI.NotFoundError) throw new ServiceError(503, "Writing with AI isn't working: OpenAI doesn't offer that model to this account (OPENAI_MODEL).", "unavailable");
    if (e instanceof OpenAI.RateLimitError) throw busy();
    if (e instanceof OpenAI.APIError) throw unreachable(e, req.tag);
    throw e;
  }
  const said = res.output.flatMap((o) => (o.type === "message" ? o.content : []));
  if (said.some((c) => c.type === "refusal")) throw refused();
  if (res.status === "incomplete" || !res.output_parsed) throw incomplete();
  return res.output_parsed as z.infer<S>;
}
