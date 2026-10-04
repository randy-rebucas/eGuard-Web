import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const smtpSend = vi.fn();
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: smtpSend }) } }));

const mail = { to: "parent@example.com", subject: "Hi", text: "Hello", html: "<p>Hello</p>" };
const fetchMock = vi.fn();

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("../mail");
}

describe("sendMail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    smtpSend.mockReset();
    fetchMock.mockReset();
  });

  it("uses SMTP and skips Resend when SMTP works", async () => {
    const { sendMail } = await load({ SMTP_URL: "smtp://x", RESEND_API_KEY: "re_key" });
    smtpSend.mockResolvedValue({});
    await sendMail(mail);
    expect(smtpSend).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to Resend when SMTP fails", async () => {
    const { sendMail } = await load({ SMTP_URL: "smtp://x", RESEND_API_KEY: "re_key", RESEND_FROM: "eGuard <hi@verified.dev>" });
    smtpSend.mockRejectedValue(Object.assign(new Error("Invalid login"), { code: "EAUTH" }));
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await sendMail(mail);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_key");
    expect(JSON.parse(init.body)).toMatchObject({ from: "eGuard <hi@verified.dev>", to: ["parent@example.com"], subject: "Hi" });
  });

  it("rethrows the SMTP error when there's no Resend key", async () => {
    const { sendMail } = await load({ SMTP_URL: "smtp://x", RESEND_API_KEY: "" });
    smtpSend.mockRejectedValue(new Error("Invalid login"));
    await expect(sendMail(mail)).rejects.toThrow("Invalid login");
  });

  it("uses Resend alone when SMTP_URL is empty, and reports its errors", async () => {
    const { sendMail } = await load({ SMTP_URL: "", RESEND_API_KEY: "re_key" });
    fetchMock.mockResolvedValue(new Response('{"message":"domain not verified"}', { status: 403 }));
    await expect(sendMail(mail)).rejects.toThrow(/Resend refused the email \(403\).*domain not verified/);
    expect(smtpSend).not.toHaveBeenCalled();
  });
});
