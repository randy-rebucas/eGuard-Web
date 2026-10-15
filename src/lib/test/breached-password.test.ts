import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));

const { assertNotBreached, timesBreached } = await import("../breached-password");

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();
/** Answers like the range API: the suffixes under the requested prefix, with padding lines (count 0). */
function rangeApi(breached: Record<string, number>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const prefix = url.slice(-5);
    const lines = Object.entries(breached).map(([pw, n]) => [sha1(pw), n] as const).filter(([h]) => h.startsWith(prefix)).map(([h, n]) => `${h.slice(5)}:${n}`);
    expect((init?.headers as Record<string, string>)["Add-Padding"]).toBe("true");
    return new Response([...lines, "0000000000000000000000000000000000A:0"].join("\r\n"));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("breached passwords", () => {
  it("sends only the first 5 characters of the SHA-1, and counts a match", async () => {
    const fetch = rangeApi({ "password12": 823697 });
    vi.stubGlobal("fetch", fetch);
    expect(await timesBreached("password12")).toBe(823697);
    expect(fetch.mock.calls[0][0]).toBe(`https://api.pwnedpasswords.com/range/${sha1("password12").slice(0, 5)}`);
    expect(await timesBreached("a-password-nobody-has-used-9f3k")).toBe(0);
    await expect(assertNotBreached("password12")).rejects.toMatchObject({ code: "invalid" });
    await expect(assertNotBreached("a-password-nobody-has-used-9f3k")).resolves.toBeUndefined();
  });

  it("lets the password through when the service is down or switched off", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await timesBreached("password12")).toBeNull();
    await expect(assertNotBreached("password12")).resolves.toBeUndefined();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    expect(await timesBreached("password12")).toBeNull();
    vi.stubEnv("PWNED_PASSWORDS", "off");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await timesBreached("password12")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
