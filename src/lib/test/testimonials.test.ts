import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("../email-verification", () => ({ appUrl: () => "https://app.test" }));
const sendMail = vi.hoisted(() => vi.fn());
vi.mock("../mail", () => ({ sendMail, escapeHtml: (s: string) => s }));

/** Testimonial rows in memory, with updateMany's "only from this state" behaviour */
const rows = vi.hoisted(() => [] as Record<string, unknown>[]);
const users = vi.hoisted(() => ({ u1: { email: "ana@example.com", name: "Ana Cruz" } } as Record<string, { email: string; name: string }>));
const match = (r: Record<string, unknown>, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => {
  if (v && typeof v === "object" && "in" in v) return (v.in as unknown[]).includes(r[k]);
  if (v && typeof v === "object" && "notIn" in v) return !(v.notIn as unknown[]).includes(r[k]);
  if (v && typeof v === "object" && "lt" in v) return r[k] instanceof Date && (r[k] as Date) < (v.lt as Date);
  if (v && typeof v === "object" && "not" in v) return r[k] !== v.not;
  return r[k] === v;
});
vi.mock("../db", () => {
  const withUser = (r: Record<string, unknown>) => ({ ...r, user: users[r.userId as string] ?? null });
  return {
    db: {
      feedback: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === "f1" ? { userId: "u1", comment: "Bedtime finally holds every night." } : null)) },
      user: { findUnique: vi.fn(async () => null) },
      testimonial: {
        count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => match(r, where)).length),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const r = { id: `t${rows.length + 1}`, status: "PROPOSED", consentAt: null, quoteHash: null, tokenHash: null, tokenExpiresAt: null, sortOrder: 0, ...data };
          rows.push(r);
          return r;
        }),
        findUnique: vi.fn(async ({ where, include }: { where: Record<string, unknown>; include?: unknown }) => {
          const r = rows.find((x) => match(x, where));
          return r ? (include ? withUser(r) : { ...r }) : null;
        }),
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((x) => match(x, where)) ?? null),
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((x) => match(x, where))),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: object }) => Object.assign(rows.find((x) => x.id === where.id)!, data)),
        updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
          const hit = rows.filter((x) => match(x, where));
          hit.forEach((x) => Object.assign(x, data));
          return { count: hit.length };
        }),
        deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          const before = rows.length;
          for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1);
          return { count: before - rows.length };
        }),
      },
    },
  };
});

const t = await import("../testimonials");

/** The token from the consent email's link */
const emailedToken = () => String(sendMail.mock.calls.at(-1)![0].text).match(/consent\/([\w-]+)/)![1];

beforeEach(() => {
  rows.length = 0;
  sendMail.mockReset();
});

async function consented(name?: string) {
  const p = await t.proposeFromFeedback("f1", { quote: "Bedtime finally holds every night.", displayName: "Ana, Ormoc" }, "staff1");
  await t.sendConsentRequest(p.id);
  const token = emailedToken();
  await t.answerConsent(token, { decision: "agree", displayName: name });
  return { id: p.id, token };
}

describe("testimonials", () => {
  it("emails the exact quote and name, and publishes only after the parent agrees", async () => {
    const p = await t.proposeFromFeedback("f1", { quote: "Bedtime finally holds every night.", displayName: "Ana, Ormoc" }, "staff1");
    await expect(t.setPublished(p.id, true)).rejects.toMatchObject({ code: "conflict" });
    await t.sendConsentRequest(p.id);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe("ana@example.com");
    expect(mail.text).toContain(`"Bedtime finally holds every night."\n— Ana, Ormoc`);
    expect(await t.consentView(emailedToken())).toMatchObject({ status: "AWAITING_CONSENT", displayName: "Ana, Ormoc" });
    await t.answerConsent(emailedToken(), { decision: "agree" });
    expect(rows[0]).toMatchObject({ status: "CONSENTED", consentEmail: "ana@example.com", consentTextVersion: t.CONSENT_VERSION });
    await t.setPublished(p.id, true);
    expect(await t.publishedQuotes()).toEqual([{ quote: "Bedtime finally holds every night.", name: "Ana, Ormoc", consentedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }]);
  });

  it("lets the parent choose the name, and records consent once", async () => {
    const { token } = await consented("Parent of two, Leyte");
    expect(rows[0].displayName).toBe("Parent of two, Leyte");
    expect(t.canPublish(rows[0] as never)).toBe(true);
    await expect(t.answerConsent(token, { decision: "agree" })).rejects.toMatchObject({ code: "conflict" });
  });

  it("needs consent again after any edit, and takes it off the site", async () => {
    const { id } = await consented();
    await t.setPublished(id, true);
    expect(await t.editProposal(id, { quote: "Bedtime holds every night now.", displayName: "Ana, Ormoc" })).toEqual({ wasPublished: true });
    expect(rows[0]).toMatchObject({ status: "PROPOSED", consentAt: null, tokenHash: null });
    expect(await t.publishedQuotes()).toEqual([]);
  });

  it("never shows words that differ from what was agreed, whatever the status says", async () => {
    const { id } = await consented();
    await t.setPublished(id, true);
    rows[0].quote = "Changed behind the parent's back.";
    expect(await t.publishedQuotes()).toEqual([]);
  });

  it("withdraws from the same link, at any time, and the words are erased later", async () => {
    const { id, token } = await consented();
    await t.setPublished(id, true);
    expect(await t.answerConsent(token, { decision: "withdraw" })).toEqual({ siteChanged: true });
    expect(await t.publishedQuotes()).toEqual([]);
    await expect(t.setPublished(id, true)).rejects.toMatchObject({ code: "conflict" });
    const later = new Date(Date.now() + (t.TESTIMONIAL_ERASE_DAYS + 1) * 864e5);
    expect(await t.eraseWithdrawn(later)).toBe(1);
    expect(rows[0]).toMatchObject({ status: "WITHDRAWN", quote: null, displayName: null, consentEmail: null });
  });

  it("can't be answered once the link expired, though it still withdraws", async () => {
    const p = await t.proposeFromFeedback("f1", { quote: "Bedtime finally holds every night.", displayName: "Ana, Ormoc" }, "staff1");
    await t.sendConsentRequest(p.id);
    const late = new Date(Date.now() + (t.CONSENT_DAYS + 1) * 864e5);
    expect(await t.consentView(emailedToken(), late)).toBeNull();
    await expect(t.answerConsent(emailedToken(), { decision: "agree" }, late)).rejects.toMatchObject({ code: "conflict" });
  });

  it("declining shares nothing", async () => {
    const p = await t.proposeFromFeedback("f1", { quote: "Bedtime finally holds every night.", displayName: "Ana, Ormoc" }, "staff1");
    await t.sendConsentRequest(p.id);
    await t.answerConsent(emailedToken(), { decision: "decline" });
    expect(rows[0].status).toBe("DECLINED");
    await expect(t.sendConsentRequest(p.id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("checks the wording", async () => {
    await expect(t.proposeFromFeedback("f1", { quote: "Too short", displayName: "Ana" }, "s")).rejects.toMatchObject({ code: "invalid" });
    await expect(t.proposeFromFeedback("f1", { quote: "Bedtime finally holds.", displayName: "ana@example.com" }, "s")).rejects.toMatchObject({ code: "invalid" });
    await expect(t.proposeForParent("nobody@example.com", { originalText: "", quote: "Bedtime finally holds.", displayName: "Ana" }, "s")).rejects.toMatchObject({ code: "invalid" });
  });

  it("proposes one quote per feedback at a time", async () => {
    await t.proposeFromFeedback("f1", { quote: "Bedtime finally holds every night.", displayName: "Ana, Ormoc" }, "staff1");
    await expect(t.proposeFromFeedback("f1", { quote: "Bedtime finally holds.", displayName: "Ana" }, "staff1")).rejects.toMatchObject({ code: "conflict" });
  });
});
