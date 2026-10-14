import { afterEach, describe, expect, it, vi } from "vitest";
import { SHARE_CHANNELS, shareMessage } from "./share";

/** Settings › Share eGuard: the public site only, and each channel's link carrying it intact. */

afterEach(() => vi.unstubAllEnvs());

describe("shareMessage", () => {
  it("points at the public site, with no tracking parameters", () => {
    vi.stubEnv("APP_URL", "https://www.eguard.family/");
    const s = shareMessage();
    expect(s.url).toBe("https://www.eguard.family/");
    expect(s.message).toBe(`${s.text} ${s.url}`);
  });
});

describe("SHARE_CHANNELS", () => {
  vi.stubEnv("APP_URL", "https://www.eguard.family");
  const s = shareMessage();
  const href = (id: string) => SHARE_CHANNELS.find((c) => c.id === id)!.href(s);

  it("encodes the link and message so they arrive whole", () => {
    expect(href("facebook")).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fwww.eguard.family%2F");
    expect(decodeURIComponent(href("whatsapp").split("text=")[1])).toBe(s.message);
    expect(decodeURIComponent(href("viber").split("text=")[1])).toBe(s.message);
    const x = new URL(href("x"));
    expect([x.searchParams.get("text"), x.searchParams.get("url")]).toEqual([s.text, s.url]);
  });
  it("fills an email's subject and body", () => {
    const m = href("email");
    expect(m.startsWith("mailto:?subject=eGuard%20parental%20controls&body=")).toBe(true);
    expect(decodeURIComponent(m.split("body=")[1])).toBe(s.message);
  });
});
