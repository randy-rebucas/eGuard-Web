import { generateKeyPairSync, verify } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ oAuthIdentity: { updateMany: vi.fn(), findMany: vi.fn() } }));
vi.mock("../db", () => ({ db }));

const {
  appleClientSecret, appleCredentials, audienceOf, exchangeAppleCode, openAppleToken, rememberAppleToken,
  revokeAppleTokens, sealAppleToken,
} = await import("../apple-tokens");

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const creds = { teamId: "TEAM123456", keyId: "KEY1234567", privateKey };
const env = { TWO_FACTOR_KEY: "test-two-factor-key", NODE_ENV: "test" };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: object) => `${b64({ alg: "RS256", kid: "k" })}.${b64(payload)}.sig`;
const idToken = jwt({ aud: "com.devcom.eguard", sub: "001.apple" });
const decode = (t: string) => t.split(".").slice(0, 2).map((p) => JSON.parse(Buffer.from(p, "base64url").toString("utf8")));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  db.oAuthIdentity.updateMany.mockResolvedValue({ count: 1 });
});

describe("appleCredentials", () => {
  it("needs the team, key id and a loadable .p8 key, and takes \\n written out", () => {
    expect(appleCredentials({})).toBeNull();
    expect(appleCredentials({ APPLE_TEAM_ID: "T", APPLE_KEY_ID: "K" })).toBeNull();
    const oneLine = pem.trim().replace(/\n/g, "\\n");
    expect(appleCredentials({ APPLE_TEAM_ID: "T", APPLE_KEY_ID: "K", APPLE_PRIVATE_KEY: oneLine })).toMatchObject({ teamId: "T", keyId: "K" });
    quiet();
    expect(appleCredentials({ APPLE_TEAM_ID: "T", APPLE_KEY_ID: "K", APPLE_PRIVATE_KEY: "not a key" })).toBeNull();
  });
});

describe("appleClientSecret", () => {
  it("is an ES256 JWT with Apple's claims, signed by the team key", () => {
    const now = Date.UTC(2026, 10, 16, 12);
    const t = appleClientSecret(creds, "com.devcom.eguard", now);
    const [head, body] = decode(t);
    expect(head).toEqual({ alg: "ES256", kid: "KEY1234567" });
    const iat = Math.floor(now / 1000);
    expect(body).toEqual({ iss: "TEAM123456", sub: "com.devcom.eguard", aud: "https://appleid.apple.com", iat, exp: iat + 300 });
    const [h, p, s] = t.split(".");
    expect(verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("audienceOf", () => {
  it("reads the client id the identity token was issued to", () => {
    expect(audienceOf(idToken)).toBe("com.devcom.eguard");
    expect(audienceOf(jwt({ aud: ["a.b", "c.d"] }))).toBe("a.b");
    expect(audienceOf("garbage")).toBeNull();
  });
});

describe("exchangeAppleCode", () => {
  it("posts the code with a client secret and returns the refresh token and its Apple user", async () => {
    const fetch = vi.fn(async () => json(200, { refresh_token: "rt_1", id_token: jwt({ sub: "001.apple" }) }));
    await expect(exchangeAppleCode("code_1", "com.devcom.eguard", { creds, fetch })).resolves.toEqual({ refreshToken: "rt_1", subject: "001.apple" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://appleid.apple.com/auth/token");
    const form = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(form)).toMatchObject({ client_id: "com.devcom.eguard", code: "code_1", grant_type: "authorization_code" });
    expect(decode(form.get("client_secret")!)[1]).toMatchObject({ sub: "com.devcom.eguard", iss: "TEAM123456" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("turns Apple's refusals and outages into service errors", async () => {
    await expect(exchangeAppleCode("c", "x", { creds, fetch: async () => json(400, { error: "invalid_grant" }) })).rejects.toMatchObject({ status: 400, code: "invalid_grant" });
    await expect(exchangeAppleCode("c", "x", { creds, fetch: async () => json(503, {}) })).rejects.toMatchObject({ status: 502, code: "apple_unavailable" });
    await expect(exchangeAppleCode("c", "x", { creds, fetch: async () => { throw new TypeError("fetch failed"); } })).rejects.toMatchObject({ code: "apple_unavailable" });
    await expect(exchangeAppleCode("c", "x", { creds, fetch: async () => json(200, {}) })).rejects.toMatchObject({ code: "apple_unavailable" });
  });
});

describe("sealed tokens", () => {
  it("round-trip with the key, and aren't readable without it", () => {
    const sealed = sealAppleToken("rt_1", "com.devcom.eguard", env)!;
    expect(sealed).toMatch(/^v1:/);
    expect(sealed).not.toContain("rt_1");
    expect(openAppleToken(sealed, env)).toEqual({ refreshToken: "rt_1", clientId: "com.devcom.eguard" });
    expect(openAppleToken(sealed, { ...env, TWO_FACTOR_KEY: "another" })).toBeNull();
    // Production without a key keeps nothing rather than a token in the clear
    expect(sealAppleToken("rt_1", "x", { NODE_ENV: "production" })).toBeNull();
  });
});

describe("rememberAppleToken", () => {
  const input = { subject: "001.apple", idToken, authorizationCode: "code_1" };

  it("keeps the sealed refresh token on the Apple identity", async () => {
    const fetch = vi.fn(async () => json(200, { refresh_token: "rt_1", id_token: jwt({ sub: "001.apple" }) }));
    await expect(rememberAppleToken(input, { creds, fetch, env })).resolves.toBe(true);
    const call = db.oAuthIdentity.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ provider: "apple", subject: "001.apple" });
    expect(openAppleToken(call.data.appleRefreshToken, env)).toEqual({ refreshToken: "rt_1", clientId: "com.devcom.eguard" });
  });

  it("never throws when the exchange fails, and keeps nothing", async () => {
    const log = quiet();
    for (const fetch of [async () => json(400, { error: "invalid_grant" }), async () => { throw new Error("down"); }]) {
      await expect(rememberAppleToken(input, { creds, fetch, env })).resolves.toBe(false);
    }
    expect(db.oAuthIdentity.updateMany).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it("does nothing without Apple credentials, and refuses another Apple user's code", async () => {
    const fetch = vi.fn(async () => json(200, { refresh_token: "rt_1", id_token: jwt({ sub: "someone.else" }) }));
    await expect(rememberAppleToken(input, { creds: null, fetch, env })).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    quiet();
    await expect(rememberAppleToken(input, { creds, fetch, env })).resolves.toBe(false);
    expect(db.oAuthIdentity.updateMany).not.toHaveBeenCalled();
  });
});

describe("revokeAppleTokens", () => {
  it("revokes each token with its client id and token_type_hint=refresh_token", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }));
    const sealed = [sealAppleToken("rt_1", "com.devcom.eguard", env)!, sealAppleToken("rt_2", "com.devcom.eguard", env)!];
    await expect(revokeAppleTokens(sealed, { creds, fetch, env })).resolves.toBe(2);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://appleid.apple.com/auth/revoke");
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toMatchObject({ client_id: "com.devcom.eguard", token: "rt_1", token_type_hint: "refresh_token" });
  });

  it("never throws: Apple down, no credentials, or a token that can't be opened", async () => {
    quiet();
    const sealed = [sealAppleToken("rt_1", "x", env)!];
    await expect(revokeAppleTokens(sealed, { creds, fetch: async () => { throw new Error("down"); }, env })).resolves.toBe(0);
    await expect(revokeAppleTokens(sealed, { creds, fetch: async () => json(500, {}), env })).resolves.toBe(0);
    await expect(revokeAppleTokens(sealed, { creds: null, env })).resolves.toBe(0);
    await expect(revokeAppleTokens(["v1:broken"], { creds, fetch: async () => new Response(null), env })).resolves.toBe(0);
    await expect(revokeAppleTokens([], { creds })).resolves.toBe(0);
  });
});
