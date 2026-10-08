import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const smtpSend = vi.fn();
const createTransport = vi.fn((url: string) => { void url; return { sendMail: smtpSend }; });
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const mail = { to: "parent@eguard.family", subject: "Hi", text: "Hello", html: "<p>Hello</p>" };
const fetchMock = vi.fn();

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("../mail");
}

describe("sendMail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    smtpSend.mockReset();
    createTransport.mockClear();
    fetchMock.mockReset();
  });

  describe("in development and tests", () => {
    it("always sends to Mailpit, never to the SMTP_URL or Resend in .env", async () => {
      const { sendMail } = await load({ NODE_ENV: "development", SMTP_URL: "smtp://user:pass@real.example:587", RESEND_API_KEY: "re_key" });
      smtpSend.mockResolvedValue({});
      await sendMail(mail);
      expect(createTransport).toHaveBeenCalledWith("smtp://127.0.0.1:1025");
      expect(smtpSend).toHaveBeenCalledOnce();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses MAILPIT_SMTP_URL when Mailpit runs elsewhere", async () => {
      const { sendMail } = await load({ NODE_ENV: "test", MAILPIT_SMTP_URL: "smtp://127.0.0.1:2525" });
      smtpSend.mockResolvedValue({});
      await sendMail({ ...mail, to: "parent@example.com" });
      expect(createTransport).toHaveBeenCalledWith("smtp://127.0.0.1:2525");
    });

    it("prints the email instead of failing when Mailpit isn't running", async () => {
      const { sendMail } = await load({ NODE_ENV: "development", RESEND_API_KEY: "re_key" });
      smtpSend.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:1025"));
      await expect(sendMail(mail)).resolves.toBeUndefined();
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Mailpit unreachable"));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("in production", () => {
    it("sends with Resend, even when SMTP_URL is set", async () => {
      const { sendMail } = await load({ NODE_ENV: "production", SMTP_URL: "smtp://x", RESEND_API_KEY: "re_key", RESEND_FROM: "eGuard <hi@verified.dev>" });
      fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
      await sendMail(mail);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      expect(init.headers.Authorization).toBe("Bearer re_key");
      expect(JSON.parse(init.body)).toMatchObject({ from: "eGuard <hi@verified.dev>", to: ["parent@eguard.family"], subject: "Hi" });
      expect(smtpSend).not.toHaveBeenCalled();
    });

    it("reports Resend's errors", async () => {
      const { sendMail } = await load({ NODE_ENV: "production", RESEND_API_KEY: "re_key" });
      fetchMock.mockResolvedValue(new Response('{"message":"domain not verified"}', { status: 403 }));
      await expect(sendMail(mail)).rejects.toThrow(/Resend refused the email \(403\).*domain not verified/);
    });

    it("doesn't hand Resend reserved test domains, which it refuses", async () => {
      const { sendMail } = await load({ NODE_ENV: "production", RESEND_API_KEY: "re_key" });
      for (const to of ["reyes@example.com", "a@mail.example.org", "b@kid.test"]) await sendMail({ ...mail, to });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses SMTP_URL only without a Resend key, and refuses with neither", async () => {
      let m = await load({ NODE_ENV: "production", SMTP_URL: "smtp://x", RESEND_API_KEY: "" });
      smtpSend.mockResolvedValue({});
      await m.sendMail(mail);
      expect(createTransport).toHaveBeenCalledWith("smtp://x");
      m = await load({ NODE_ENV: "production", SMTP_URL: "", RESEND_API_KEY: "" });
      await expect(m.sendMail(mail)).rejects.toThrow("RESEND_API_KEY isn't set");
    });
  });
});
