import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../email-verification", () => ({ appUrl: () => "https://app.test" }));
vi.mock("../mail", async () => ({ sendMail: vi.fn(), escapeHtml: (await vi.importActual<typeof import("../mail")>("../mail")).escapeHtml }));
vi.mock("../push", () => ({ pushConfig: () => null, sendPush: vi.fn() }));

const { DeliveryError, backoffMs, classifyError, nextAttempt } = await import("../parent-care/queue");
const { RETRY } = await import("../parent-care/definitions");
const { cohortFor } = await import("../parent-care/events");
const { careEmail } = await import("../parent-care/delivery");

describe("parent-care retries", () => {
  it("backs off exponentially with jitter, capped", () => {
    expect(backoffMs(1, () => 0.5)).toBe(RETRY.baseMs);
    expect(backoffMs(2, () => 0.5)).toBe(RETRY.baseMs * 2);
    expect(backoffMs(3, () => 0)).toBe(Math.round(RETRY.baseMs * 4 * 0.8));
    expect(backoffMs(3, () => 0.9999)).toBeLessThanOrEqual(Math.round(RETRY.baseMs * 4 * 1.2));
    expect(backoffMs(30, () => 0.5)).toBe(RETRY.maxMs);
  });

  it("gives up after the last attempt, or at once for a permanent failure", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    expect(nextAttempt(1, true, now, () => 0.5)?.toISOString()).toBe(new Date(now.getTime() + RETRY.baseMs).toISOString());
    expect(nextAttempt(RETRY.maxAttempts, true, now)).toBeNull();
    expect(nextAttempt(1, false, now)).toBeNull();
  });

  it("classifies provider failures", () => {
    expect(classifyError(new DeliveryError("no_push_token", false))).toEqual({ code: "no_push_token", retryable: false });
    expect(classifyError(new Error("Resend refused the email (422): invalid to"))).toEqual({ code: "provider_rejected", retryable: false });
    expect(classifyError(new Error("Resend refused the email (429): slow down"))).toEqual({ code: "provider_unavailable", retryable: true });
    expect(classifyError(new Error("Resend refused the email (503): down"))).toEqual({ code: "provider_unavailable", retryable: true });
    expect(classifyError(new Error("fetch failed"))).toEqual({ code: "provider_unavailable", retryable: true });
    expect(classifyError(new Error("RESEND_API_KEY isn't set (nor SMTP_URL), so eGuard can't send email."))).toEqual({ code: "email_not_configured", retryable: true });
    expect(classifyError("weird")).toEqual({ code: "unexpected_error", retryable: true });
  });
});

describe("parent-care holdout", () => {
  it("puts a parent in the same cohort every time, about one in ten in holdout", () => {
    expect(cohortFor("user-1")).toBe(cohortFor("user-1"));
    const ids = Array.from({ length: 4000 }, (_, i) => `clx${i.toString(36)}`);
    const share = ids.filter((id) => cohortFor(id) === "HOLDOUT").length / ids.length;
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.12);
    expect(ids.every((id) => cohortFor(id, 0) === "TREATMENT")).toBe(true);
  });
});

describe("parent-care email", () => {
  const r = { title: "Your family safety plan for this week", body: "One thing to try <b>this</b> week.", cta: "See this week's plan", link: "/plan" };

  it("links through click tracking, offers a one-click opt-out, and escapes the text", () => {
    const m = careEmail(r, "Ana", "tok_123");
    expect(m.subject).toBe(r.title);
    expect(m.text).toContain("https://app.test/api/care/open/tok_123");
    expect(m.text).toContain("Stop these emails: https://app.test/unsubscribe?t=tok_123");
    expect(m.headers["List-Unsubscribe"]).toBe("<https://app.test/api/email/unsubscribe?t=tok_123>");
    expect(m.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(m.html).toContain("One thing to try &lt;b&gt;this&lt;/b&gt; week.");
    expect(m.html).not.toContain("<b>this</b>");
  });
});
