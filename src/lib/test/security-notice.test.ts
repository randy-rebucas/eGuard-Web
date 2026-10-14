import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
const sendMail = vi.fn(async () => {});
vi.mock("../mail", () => ({ sendMail, escapeHtml: (s: string) => s.replace(/</g, "&lt;") }));

const { securityNoticeEmail, sendSecurityNotice } = await import("../security-notice");

describe("security notices", () => {
  it("names the new address in the email-change notice, and says what to do if it wasn't them", () => {
    const m = securityNoticeEmail({ kind: "email", newEmail: "new@example.com" }, "Ana");
    expect(m.subject).toBe("Your eGuard email was changed");
    expect(m.text).toContain("changed to new@example.com");
    expect(m.text).toContain("/forgot-password");
  });

  it("escapes names in the HTML", () => {
    expect(securityNoticeEmail({ kind: "password" }, "<b>Ana").html).toContain("&lt;b>Ana");
  });

  it("sends to the given address, and a mail failure doesn't throw", async () => {
    sendMail.mockRejectedValueOnce(new Error("smtp down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => sendSecurityNotice("old@example.com", "Ana Cruz", { kind: "two_factor_off" })).not.toThrow();
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "old@example.com", subject: "Two-step verification was turned off" })));
  });
});
