import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../email-verification", () => ({ appUrl: () => "https://app.test" }));
vi.mock("../mail", () => ({ sendMail: vi.fn(), escapeHtml: (s: string) => s }));
const parse = vi.hoisted(() => vi.fn());
// The real SDK, so its error classes are real; only the request is replaced
vi.mock("@anthropic-ai/sdk", async (orig) => {
  const Real = (await orig<typeof import("@anthropic-ai/sdk")>()).default;
  class Fake extends Real {
    constructor(opts: ConstructorParameters<typeof Real>[0]) {
      super({ ...opts, apiKey: "test" });
      (this as unknown as { beta: unknown }).beta = { messages: { parse } };
    }
  }
  return { default: Fake };
});

const respond = vi.hoisted(() => vi.fn());
vi.mock("openai", async (orig) => {
  const Real = (await orig<typeof import("openai")>()).default;
  class Fake extends Real {
    constructor(opts: ConstructorParameters<typeof Real>[0]) {
      super({ ...opts, apiKey: "test" });
      (this as unknown as { responses: unknown }).responses = { parse: respond };
    }
  }
  return { default: Fake };
});

const Anthropic = (await import("@anthropic-ai/sdk")).default;
const OpenAI = (await import("openai")).default;
const { aiProvider, draftBroadcast } = await import("../broadcast-ai");

const reply = (over: object = {}) => ({ stop_reason: "end_turn", parsed_output: { subject: "Saved places is here", body: "Para one.\n\n\n\nPara two." }, ...over });
const input = { brief: "Announce saved places for Plus and Pro", kind: "UPDATE" as const, plans: ["eGuard Plus", "Family Pro"] };
const errorOf = <T,>(C: abstract new (...a: never[]) => T) => Object.create(C.prototype) as T;

describe("draftBroadcast", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    parse.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllEnvs());

  it("asks Claude Opus 5.5 for a structured subject and body, with refusal fallback on", async () => {
    parse.mockResolvedValue(reply());
    expect(await draftBroadcast(input)).toEqual({ subject: "Saved places is here", body: "Para one.\n\nPara two.", placeholders: false, provider: "anthropic" });
    const req = parse.mock.calls[0][0];
    expect(req).toMatchObject({ model: "claude-opus-5-5", betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "medium" } });
    expect(req.output_config.format).toBeDefined();
    expect(req.system).toContain("Don't write a greeting");
    expect(req.messages[0].content).toContain("Write this email (Product update, to parents on eGuard Plus, Family Pro)");
    expect(req.messages[0].content).toContain("<brief>\nAnnounce saved places for Plus and Pro\n</brief>");
  });

  it("revises what's already in the form when there is something", async () => {
    parse.mockResolvedValue(reply());
    await draftBroadcast({ ...input, kind: "SERVICE", plans: [], brief: "Make it shorter please", subject: "Old", body: "Old body" });
    const content = parse.mock.calls[0][0].messages[0].content;
    expect(content).toContain("Revise this email (Service notice, to parents on every plan)");
    expect(content).toContain("<current_body>\nOld body\n</current_body>");
    expect(content).toContain("<request>\nMake it shorter please\n</request>");
  });

  it("tells the writer a mailing list isn't parents with an account", async () => {
    parse.mockResolvedValue(reply());
    await draftBroadcast({ ...input, audience: "IOS_LAUNCH", plans: [] });
    const content = parse.mock.calls[0][0].messages[0].content;
    expect(content).toContain("to the iPhone launch mailing list");
    expect(content).not.toContain("to parents on");
  });

  it("flags gaps it left for staff", async () => {
    parse.mockResolvedValue(reply({ parsed_output: { subject: "New", body: "It launches on [TODO: launch date]." } }));
    expect((await draftBroadcast(input)).placeholders).toBe(true);
  });

  it("explains a refusal, a cut-off or unparsed reply, and an empty one", async () => {
    parse.mockResolvedValueOnce(reply({ stop_reason: "refusal", parsed_output: null }));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ code: "refused" });
    parse.mockResolvedValueOnce(reply({ stop_reason: "max_tokens" }));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ code: "upstream" });
    parse.mockResolvedValueOnce(reply({ parsed_output: null }));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ code: "upstream" });
    parse.mockResolvedValueOnce(reply({ parsed_output: { subject: " ", body: "x" } }));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ code: "upstream" });
  });

  it("turns API errors into messages for staff", async () => {
    parse.mockRejectedValueOnce(errorOf(Anthropic.AuthenticationError));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ status: 503, message: expect.stringContaining("key was refused") });
    parse.mockRejectedValueOnce(errorOf(Anthropic.RateLimitError));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ status: 429 });
    parse.mockRejectedValueOnce(errorOf(Anthropic.InternalServerError));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ status: 502 });
  });

  it("needs an API key and a real brief, and calls nothing otherwise", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", " ");
    await expect(draftBroadcast(input)).rejects.toMatchObject({ status: 503, code: "unavailable", message: expect.stringContaining("OPENAI_API_KEY") });
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    await expect(draftBroadcast({ ...input, brief: "hi" })).rejects.toThrow("Say a bit more");
    expect(parse).not.toHaveBeenCalled();
  });
});

describe("aiProvider", () => {
  it("uses whichever key is set, Claude first, unless AI_PROVIDER says otherwise", () => {
    expect(aiProvider({})).toBeNull();
    expect(aiProvider({ ANTHROPIC_API_KEY: "a" })).toBe("anthropic");
    expect(aiProvider({ OPENAI_API_KEY: "o" })).toBe("openai");
    expect(aiProvider({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" })).toBe("anthropic");
    expect(aiProvider({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", AI_PROVIDER: "OpenAI" })).toBe("openai");
    expect(aiProvider({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: " ", AI_PROVIDER: "openai" })).toBeNull();
    expect(aiProvider({ OPENAI_API_KEY: "o", AI_PROVIDER: "claude" })).toBeNull();
  });
});

describe("draftBroadcast with OpenAI", () => {
  const ok = (over: object = {}) => ({
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
    output_parsed: { subject: "Saved places is here", body: "Para one." },
    ...over,
  });

  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    respond.mockReset();
    parse.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends the same instructions and asks for the same structured reply", async () => {
    respond.mockResolvedValue(ok());
    expect(await draftBroadcast(input)).toMatchObject({ subject: "Saved places is here", body: "Para one.", provider: "openai" });
    const req = respond.mock.calls[0][0];
    expect(req).toMatchObject({ model: "gpt-5.5", store: false, max_output_tokens: 8000 });
    expect(req.instructions).toContain("Don't write a greeting");
    expect(req.input).toContain("<brief>\nAnnounce saved places for Plus and Pro\n</brief>");
    expect(req.text.format).toMatchObject({ type: "json_schema", name: "broadcast_email" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("takes OPENAI_MODEL", async () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-5.4-mini");
    respond.mockResolvedValue(ok());
    await draftBroadcast(input);
    expect(respond.mock.calls[0][0].model).toBe("gpt-5.4-mini");
  });

  it("explains a refusal and an incomplete reply", async () => {
    respond.mockResolvedValueOnce(ok({ output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }], output_parsed: null }));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ code: "refused" });
    respond.mockResolvedValueOnce(ok({ status: "incomplete", output_parsed: null }));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ code: "upstream" });
  });

  it("turns API errors into messages for staff", async () => {
    respond.mockRejectedValueOnce(errorOf(OpenAI.AuthenticationError));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ status: 503, message: expect.stringContaining("OpenAI API key") });
    respond.mockRejectedValueOnce(errorOf(OpenAI.NotFoundError));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ status: 503, message: expect.stringContaining("OPENAI_MODEL") });
    respond.mockRejectedValueOnce(errorOf(OpenAI.RateLimitError));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ status: 429 });
    respond.mockRejectedValueOnce(errorOf(OpenAI.InternalServerError));
    await expect(draftBroadcast(input)).rejects.toMatchObject({ status: 502 });
  });
});
