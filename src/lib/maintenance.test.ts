import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({}));
vi.mock("./engine", () => ({}));
vi.mock("./browser-health", () => ({}));
vi.mock("./billing", () => ({}));
vi.mock("./web-billing", () => ({}));
vi.mock("./organizations", () => ({}));
vi.mock("./org-notifications", () => ({}));
vi.mock("./email-verification", () => ({}));
vi.mock("./mail", () => ({}));
vi.mock("./plan-access", () => ({}));
vi.mock("./push", () => ({}));

const { isChildRequest, worthEmail } = await import("./maintenance");

const alert = (a: Partial<{ severity: string; category: string; resolveKey: string | null }>) =>
  ({ severity: "INFO", category: "SYSTEM", resolveKey: null, ...a }) as Parameters<typeof worthEmail>[0];

describe("alert emails", () => {
  it("emails a child's app request, which is in the APPS category", () => {
    const a = alert({ severity: "ATTENTION", category: "APPS", resolveKey: "APPREQ:child1:Roblox" });
    expect(isChildRequest(a)).toBe(true);
    expect(worthEmail(a)).toBe(true);
  });

  it("treats a website access request as a child's request too", () => {
    expect(isChildRequest(alert({ severity: "ATTENTION", category: "PROTECTION", resolveKey: "WEBREQ:req1" }))).toBe(true);
  });

  it("still skips other app notices", () => {
    expect(worthEmail(alert({ category: "APPS", resolveKey: null }))).toBe(false);
    expect(worthEmail(alert({ severity: "ATTENTION", category: "SCREEN_TIME" }))).toBe(false);
  });

  it("keeps emailing tampering and anything that needs action", () => {
    const changed = alert({ severity: "ATTENTION", category: "PROTECTION", resolveKey: "BEDTIME:device1" });
    expect(worthEmail(changed)).toBe(true);
    expect(isChildRequest(changed)).toBe(false);
    expect(worthEmail(alert({ severity: "ACTION_REQUIRED", category: "APPS" }))).toBe(true);
  });
});
