import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyIdToken } from "../social-auth";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256" };
const getKeys = async () => [jwk];
const now = Date.now();
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

function token(payload: Record<string, unknown>, opts: { kid?: string; alg?: string; key?: typeof privateKey } = {}) {
  const head = b64({ alg: opts.alg ?? "RS256", kid: opts.kid ?? "k1" });
  const body = b64(payload);
  const sig = sign("RSA-SHA256", Buffer.from(`${head}.${body}`), opts.key ?? privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}

const apple = (over: Record<string, unknown> = {}) => ({
  iss: "https://appleid.apple.com", aud: "app.eguard.ios", sub: "001234.abc", email: "Parent@Example.com",
  email_verified: "true", exp: Math.floor(now / 1000) + 600, iat: Math.floor(now / 1000), ...over,
});
const opts = { audiences: ["app.eguard.ios"], getKeys, now };

describe("verifyIdToken", () => {
  it("accepts a valid Apple token and normalizes the email", async () => {
    const id = await verifyIdToken("apple", token(apple()), opts);
    expect(id).toEqual({ provider: "apple", subject: "001234.abc", email: "parent@example.com", emailVerified: true, name: null });
  });

  it("accepts Google's issuer forms and boolean email_verified", async () => {
    const t = token({ ...apple({ iss: "accounts.google.com", email_verified: true, name: "Randy Cruz" }) });
    const id = await verifyIdToken("google", t, opts);
    expect(id.emailVerified).toBe(true);
    expect(id.name).toBe("Randy Cruz");
  });

  it.each([
    ["wrong audience", () => token(apple({ aud: "someone.else" }))],
    ["wrong issuer", () => token(apple({ iss: "https://evil.example" }))],
    ["expired", () => token(apple({ exp: Math.floor(now / 1000) - 3600 }))],
    ["missing subject", () => token(apple({ sub: "" }))],
    ["unknown key id", () => token(apple(), { kid: "nope" })],
    ["signed by another key", () => token(apple(), { key: other.privateKey })],
    ["alg other than RS256", () => token(apple(), { alg: "HS256" })],
    ["not a JWT", () => "abc.def"],
  ])("rejects a token with %s", async (_, make) => {
    await expect(verifyIdToken("apple", make(), opts)).rejects.toMatchObject({ status: 401, code: "invalid_token" });
  });

  it("rejects a tampered payload", async () => {
    const [h, , s] = token(apple()).split(".");
    await expect(verifyIdToken("apple", `${h}.${b64(apple({ sub: "attacker" }))}.${s}`, opts)).rejects.toMatchObject({ status: 401 });
  });

  it("reports 501 when the provider isn't configured", async () => {
    await expect(verifyIdToken("apple", token(apple()), { ...opts, audiences: [] })).rejects.toMatchObject({ status: 501, code: "provider_not_configured" });
  });
});

describe("verifyIdToken with the provider's published keys", () => {
  const live = { audiences: ["app.eguard.ios"], now };
  const old = { ...other.publicKey.export({ format: "jwk" }), kid: "k0", alg: "RS256" };
  const keys = (list: unknown[]) => Promise.resolve(new Response(JSON.stringify({ keys: list })));
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("says try again (502), not a server error, when the provider can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(verifyIdToken("apple", token(apple()), live)).rejects.toMatchObject({ status: 502, code: "provider_unavailable" });
  });

  it("fetches again for a key it hasn't seen (a rotation), then keeps the cached keys if the provider goes down", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetch = vi.fn().mockReturnValueOnce(keys([old])).mockReturnValueOnce(keys([old, jwk])).mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetch);
    await expect(verifyIdToken("apple", token(apple(), { kid: "k0", key: other.privateKey }), live)).resolves.toMatchObject({ subject: "001234.abc" });
    vi.setSystemTime(Date.now() + 120_000);
    await expect(verifyIdToken("apple", token(apple()), live)).resolves.toMatchObject({ subject: "001234.abc" });
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + 2 * 3600_000);
    await expect(verifyIdToken("apple", token(apple()), live)).resolves.toMatchObject({ subject: "001234.abc" });
  });
});
