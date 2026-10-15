import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { begin, decodeFlow, enabledWebProviders, encodeFlow, finish, linkedInIdentity, stateMatches } = await import("../oauth-web");
const { failurePath } = await import("../oauth-paths");
const { oauthMessage } = await import("../oauth-errors");

const ENV = {
  APP_URL: "https://www.eguard.family", TWO_FACTOR_KEY: "test-two-factor-key",
  GOOGLE_WEB_CLIENT_ID: "g-id.apps.googleusercontent.com", GOOGLE_WEB_CLIENT_SECRET: "g-secret",
  LINKEDIN_CLIENT_ID: "li-id", LINKEDIN_CLIENT_SECRET: "li-secret",
};
beforeEach(() => { for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("enabledWebProviders", () => {
  it("lists a provider only when both its id and secret are set", () => {
    expect(enabledWebProviders()).toEqual(["google", "linkedin"]);
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "");
    expect(enabledWebProviders()).toEqual(["google"]);
  });

  it("hides them in production without the key that signs the cookie", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TWO_FACTOR_KEY", "");
    expect(enabledWebProviders()).toEqual([]);
    vi.stubEnv("TWO_FACTOR_KEY", "a-long-random-production-key");
    expect(enabledWebProviders()).toEqual(["google", "linkedin"]);
  });
});

describe("begin", () => {
  it("sends Google the state, nonce and a PKCE challenge for the verifier it keeps", () => {
    const { url, flow } = begin("google", { intent: "login", next: "/children", guardian: false });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe(ENV.GOOGLE_WEB_CLIENT_ID);
    expect(u.searchParams.get("redirect_uri")).toBe("https://www.eguard.family/auth/google/callback");
    expect(u.searchParams.get("state")).toBe(flow.state);
    expect(u.searchParams.get("nonce")).toBe(flow.nonce);
    expect(u.searchParams.get("code_challenge")).toBe(createHash("sha256").update(flow.verifier!).digest("base64url"));
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(flow).toMatchObject({ provider: "google", intent: "login", next: "/children", guardian: false });
  });

  it("asks LinkedIn for OpenID scopes without PKCE", () => {
    const { url, flow } = begin("linkedin", { intent: "register", next: null, guardian: true });
    const u = new URL(url);
    expect(u.hostname).toBe("www.linkedin.com");
    expect(u.searchParams.get("scope")).toBe("openid profile email");
    expect(u.searchParams.has("code_challenge")).toBe(false);
    expect(flow.verifier).toBeNull();
  });

  it("makes a fresh state every time", () => {
    const a = begin("google", { intent: "login", next: null, guardian: false }).flow;
    const b = begin("google", { intent: "login", next: null, guardian: false }).flow;
    expect(a.state).not.toBe(b.state);
    expect(a.state.length).toBeGreaterThanOrEqual(43);
  });

  it("refuses a provider that isn't set up", () => {
    vi.stubEnv("GOOGLE_WEB_CLIENT_ID", "");
    expect(() => begin("google", { intent: "login", next: null, guardian: false })).toThrow(expect.objectContaining({ code: "provider_not_configured" }));
  });
});

describe("the flow cookie", () => {
  it("round-trips, keeping the account a link was confirmed by", () => {
    const { flow } = begin("google", { intent: "link", next: "/settings/security", guardian: false, userId: "u1" });
    expect(decodeFlow(encodeFlow(flow))).toEqual(flow);
  });

  /** A cookie written in the browser rather than by us: signed with a key the server doesn't have */
  const forged = (o: unknown, sig = "AAAA") => `${Buffer.from(JSON.stringify(o)).toString("base64url")}.${sig}`;

  it("refuses one the browser wrote or changed", () => {
    expect(decodeFlow(undefined)).toBeNull();
    expect(decodeFlow("not-json")).toBeNull();
    expect(decodeFlow(forged({ provider: "google", state: "s", nonce: "n", intent: "link", userId: "victim" }))).toBeNull();
    const real = encodeFlow(begin("google", { intent: "login", next: null, guardian: false }).flow);
    const [body, sig] = real.split(".");
    const changed = JSON.parse(Buffer.from(body, "base64url").toString());
    expect(decodeFlow(forged({ ...changed, intent: "link", userId: "victim" }, sig))).toBeNull();
    expect(decodeFlow(`${real}.extra`)).toBeNull();
    expect(decodeFlow(body)).toBeNull();
  });

  it("is signed per server key", () => {
    const real = encodeFlow(begin("google", { intent: "login", next: null, guardian: false }).flow);
    vi.stubEnv("TWO_FACTOR_KEY", "another-server-key");
    expect(decodeFlow(real)).toBeNull();
  });

  it("drops a return path that leaves the site", () => {
    const { flow } = begin("google", { intent: "login", next: null, guardian: false });
    expect(decodeFlow(encodeFlow({ ...flow, next: "//evil.example" }))?.next).toBeNull();
  });

  it("matches the state exactly", () => {
    expect(stateMatches("abc", "abc")).toBe(true);
    expect(stateMatches("abc", "abd")).toBe(false);
    expect(stateMatches("abc", "ab")).toBe(false);
    expect(stateMatches("abc", null)).toBe(false);
  });
});

describe("finish", () => {
  it("swaps a LinkedIn code and reads the member's profile", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: "at", id_token: "x" }))
      .mockResolvedValueOnce(Response.json({ sub: "li-123", name: "Ana Cruz", email: "Ana@Example.com", email_verified: true }));
    vi.stubGlobal("fetch", fetch);
    const { flow } = begin("linkedin", { intent: "login", next: null, guardian: false });
    const id = await finish(flow, "the-code");
    expect(id).toEqual({ provider: "linkedin", subject: "li-123", email: "ana@example.com", emailVerified: true, name: "Ana Cruz" });
    const sent = new URLSearchParams(fetch.mock.calls[0][1].body);
    expect(Object.fromEntries(sent)).toEqual({
      grant_type: "authorization_code", code: "the-code", redirect_uri: "https://www.eguard.family/auth/linkedin/callback",
      client_id: "li-id", client_secret: "li-secret",
    });
    expect(fetch.mock.calls[1][1].headers.authorization).toBe("Bearer at");
  });

  it("sends Google the PKCE verifier", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ id_token: "not.a.jwt" }));
    vi.stubGlobal("fetch", fetch);
    const { flow } = begin("google", { intent: "login", next: null, guardian: false });
    // The token itself is checked by verifyIdToken (social-auth.test.ts); a bad one is refused
    await expect(finish(flow, "c")).rejects.toMatchObject({ code: "invalid_token" });
    expect(new URLSearchParams(fetch.mock.calls[0][1].body).get("code_verifier")).toBe(flow.verifier);
  });

  it("treats a refused code as a failed sign-in and a provider outage as unavailable", async () => {
    const { flow } = begin("linkedin", { intent: "login", next: null, guardian: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(finish(flow, "c")).rejects.toMatchObject({ code: "invalid_token" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(finish(flow, "c")).rejects.toMatchObject({ code: "provider_unavailable" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(finish(flow, "c")).rejects.toMatchObject({ code: "provider_unavailable" });
  });
});

describe("linkedInIdentity", () => {
  it("builds the name from its parts and needs a verified email to count", () => {
    expect(linkedInIdentity({ sub: "s", given_name: "Ana", family_name: "Cruz", email: "a@x.com", email_verified: false }))
      .toEqual({ provider: "linkedin", subject: "s", email: "a@x.com", emailVerified: false, name: "Ana Cruz" });
  });

  it("refuses a profile without a subject", () => {
    expect(() => linkedInIdentity({ email: "a@x.com" })).toThrow(expect.objectContaining({ code: "invalid_token" }));
    expect(() => linkedInIdentity(null)).toThrow();
  });
});

describe("failurePath", () => {
  it("returns to where the sign-in started", () => {
    expect(failurePath("login", "cancelled", "google", "/children")).toBe("/login?oauth=cancelled&provider=google&next=%2Fchildren");
    expect(failurePath("register", "email_required", "linkedin", null)).toBe("/register?oauth=email_required&provider=linkedin");
    expect(failurePath("link", "linked_elsewhere", "google", null)).toBe("/settings/security?oauth=linked_elsewhere&provider=google");
  });

  it("sends a sign-in for a new account to create account, for the guardian confirmation", () => {
    expect(failurePath("login", "guardian_required", "google", null)).toBe("/register?oauth=guardian_required&provider=google");
  });
});

describe("oauthMessage", () => {
  it("names the provider, and ignores codes it doesn't know", () => {
    expect(oauthMessage("cancelled", "linkedin")).toBe("Sign-in with LinkedIn was cancelled. Nothing changed.");
    expect(oauthMessage("toString", "google")).toBeNull();
    expect(oauthMessage("<script>", "google")).toBeNull();
    expect(oauthMessage(undefined, "google")).toBeNull();
    expect(oauthMessage("failed", "evil")).toContain("that provider");
  });
});
