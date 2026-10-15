import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { botCheckSiteKey, verifyHuman } = await import("../bot-check");

const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => e.code as string);
const siteverify = (body: unknown) => vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(body));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("reCAPTCHA bot check", () => {
  it("is off, checking nothing, until both keys are set", async () => {
    vi.stubEnv("RECAPTCHA_SITE_KEY", "site");
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "");
    expect(botCheckSiteKey()).toBeNull();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await code(verifyHuman(null, null, "login"))).toBe("ok");
    expect(fetch).not.toHaveBeenCalled();
  });

  describe("with keys", () => {
    const on = () => { vi.stubEnv("RECAPTCHA_SITE_KEY", "site"); vi.stubEnv("RECAPTCHA_SECRET_KEY", "secret"); };

    it("needs a token, and checks it with the secret and the address", async () => {
      on();
      expect(botCheckSiteKey()).toBe("site");
      expect(await code(verifyHuman(null, null, "login"))).toBe("bot_check");
      const fetch = siteverify({ success: true, action: "login", score: 0.9 });
      vi.stubGlobal("fetch", fetch);
      expect(await code(verifyHuman("tok", "203.0.113.4", "login"))).toBe("ok");
      expect(fetch.mock.calls[0][0]).toBe("https://www.google.com/recaptcha/api/siteverify");
      const sent = new URLSearchParams(String(fetch.mock.calls[0][1]?.body));
      expect([sent.get("secret"), sent.get("response"), sent.get("remoteip")]).toEqual(["secret", "tok", "203.0.113.4"]);
    });

    it("turns down a low score, a failed token, or one made for another form", async () => {
      on();
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.stubGlobal("fetch", siteverify({ success: true, action: "login", score: 0.3 }));
      expect(await code(verifyHuman("tok", null, "login"))).toBe("bot_check");
      vi.stubGlobal("fetch", siteverify({ success: false, "error-codes": ["invalid-input-response"] }));
      expect(await code(verifyHuman("tok", null, "login"))).toBe("bot_check");
      vi.stubGlobal("fetch", siteverify({ success: true, action: "register", score: 0.9 }));
      expect(await code(verifyHuman("tok", null, "login"))).toBe("bot_check");
    });

    it("takes its threshold from RECAPTCHA_MIN_SCORE", async () => {
      on();
      vi.stubEnv("RECAPTCHA_MIN_SCORE", "0.2");
      vi.stubGlobal("fetch", siteverify({ success: true, action: "reset", score: 0.3 }));
      expect(await code(verifyHuman("tok", null, "reset"))).toBe("ok");
      vi.stubEnv("RECAPTCHA_MIN_SCORE", "nonsense");
      expect(await code(verifyHuman("tok", null, "reset"))).toBe("bot_check");
    });

    it("lets the form through when Google can't be reached", async () => {
      on();
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
      expect(await code(verifyHuman("tok", null, "login"))).toBe("ok");
      vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 502 })));
      expect(await code(verifyHuman("tok", null, "login"))).toBe("ok");
    });
  });
});
