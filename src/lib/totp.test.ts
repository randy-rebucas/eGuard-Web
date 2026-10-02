import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, matchStep, newRecoveryCode, normalizeCode, openSecret, otpauthUri, sealSecret, secretKey, stepAt } from "./totp";

// RFC 6238 appendix B (SHA-1): the ASCII secret "12345678901234567890", 8-digit codes
const RFC = Buffer.from("12345678901234567890");

describe("one-time codes", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(hotp(RFC, stepAt(59_000), 8)).toBe("94287082");
    expect(hotp(RFC, stepAt(1_111_111_109_000), 8)).toBe("07081804");
    expect(hotp(RFC, stepAt(1_234_567_890_000), 8)).toBe("89005924");
    expect(hotp(RFC, stepAt(20_000_000_000_000), 8)).toBe("65353130");
  });

  it("round-trips base32 the way authenticator apps read it", () => {
    expect(base32Encode(RFC)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq")).toEqual(RFC);
  });

  it("accepts the current code and one step either side, and nothing else", () => {
    const now = 1_700_000_000_000, s = stepAt(now);
    expect(matchStep(RFC, hotp(RFC, s), now)).toBe(s);
    expect(matchStep(RFC, hotp(RFC, s - 1), now)).toBe(s - 1);
    expect(matchStep(RFC, hotp(RFC, s + 1), now)).toBe(s + 1);
    expect(matchStep(RFC, hotp(RFC, s - 2), now)).toBeNull();
    expect(matchStep(RFC, "12345", now)).toBeNull();
    expect(matchStep(RFC, "abcdef", now)).toBeNull();
  });

  it("builds the otpauth link with the account and issuer", () => {
    const uri = otpauthUri(RFC, "randy@example.com");
    expect(uri.startsWith("otpauth://totp/eGuard%3Arandy%40example.com?secret=GEZDGNBV")).toBe(true);
    expect(uri).toContain("issuer=eGuard");
  });
});

describe("secrets at rest", () => {
  const key = secretKey({ TWO_FACTOR_KEY: "a long random test key" })!;

  it("decrypts what it encrypted, and never stores the secret readable", () => {
    const sealed = sealSecret(RFC, key);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain(base32Encode(RFC));
    expect(openSecret(sealed, key)).toEqual(RFC);
  });

  it("refuses a tampered secret or the wrong key", () => {
    const sealed = sealSecret(RFC, key);
    const flipped = `${sealed.slice(0, -2)}${sealed.at(-2) === "A" ? "B" : "A"}${sealed.at(-1)}`;
    expect(() => openSecret(flipped, key)).toThrow();
    expect(() => openSecret(sealed, secretKey({ TWO_FACTOR_KEY: "another key" })!)).toThrow();
  });

  it("has no key in production unless one is set, and a fixed one in development", () => {
    expect(secretKey({ NODE_ENV: "production" })).toBeNull();
    expect(secretKey({ NODE_ENV: "development" })).not.toBeNull();
  });
});

describe("recovery codes", () => {
  it("look like xxxx-xxxx-xxxx without look-alike characters, and normalize for matching", () => {
    const c = newRecoveryCode();
    expect(c).toMatch(/^[a-km-np-z2-9]{4}-[a-km-np-z2-9]{4}-[a-km-np-z2-9]{4}$/);
    expect(normalizeCode(` ${c.toUpperCase().replace(/-/g, " ")} `)).toBe(c.replace(/-/g, ""));
  });
});
