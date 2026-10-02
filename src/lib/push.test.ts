import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({}));

const { alertPush, pushConfig, sendPush } = await import("./push");

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const cfg = { projectId: "eguard-test", account: { client_email: "push@eguard-test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() } };

/** Google's token endpoint, then FCM answering with `status` and `body`. */
const fake = (status: number, body: unknown = {}) => vi.fn(async (url: string | URL | Request) =>
  String(url).includes("oauth2")
    ? new Response(JSON.stringify({ access_token: "ya29.push", expires_in: 3600 }))
    : new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("push", () => {
  it("reads the Firebase service account, and stays off without one", () => {
    expect(pushConfig({})).toBeNull();
    expect(pushConfig({ FCM_SERVICE_ACCOUNT: "not json" })).toBeNull();
    expect(pushConfig({ FCM_SERVICE_ACCOUNT: JSON.stringify({ ...cfg.account }) })).toBeNull(); // no project_id
    expect(pushConfig({ FCM_SERVICE_ACCOUNT: JSON.stringify({ ...cfg.account, project_id: "p1" }) })?.projectId).toBe("p1");
  });

  it("sends to the project's FCM endpoint with the token and the alert", async () => {
    const f = fake(200, { name: "projects/eguard-test/messages/1" });
    expect(await sendPush(cfg, "tok", { title: "T", body: "B", data: { alertId: "a1" } }, f)).toBe("sent");
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(String(url)).toBe("https://fcm.googleapis.com/v1/projects/eguard-test/messages:send");
    expect(JSON.parse(init.body).message).toMatchObject({ token: "tok", notification: { title: "T", body: "B" }, data: { alertId: "a1" } });
  });

  it("forgets tokens FCM says are gone, and keeps them on other failures", async () => {
    expect(await sendPush(cfg, "t", { title: "", body: "" }, fake(404, { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }))).toBe("gone");
    expect(await sendPush(cfg, "t", { title: "", body: "" }, fake(400, { error: { status: "INVALID_ARGUMENT", message: "The registration token is not a valid FCM registration token" } }))).toBe("gone");
    expect(await sendPush(cfg, "t", { title: "", body: "" }, fake(503, { error: { status: "UNAVAILABLE" } }))).toBe("failed");
  });

  it("words the notification like the alert, and keeps it short", () => {
    const m = alertPush({ id: "a1", title: "Bedtime turned off", subject: "Mia's Pixel 7", body: "x".repeat(300), childId: "c1", category: "PROTECTION" });
    expect(m.title).toBe("Bedtime turned off · Mia's Pixel 7");
    expect(m.body.length).toBeLessThanOrEqual(178);
    expect(m.data).toEqual({ type: "alert", alertId: "a1", category: "PROTECTION", childId: "c1" });
  });
});
