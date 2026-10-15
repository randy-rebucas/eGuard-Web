import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { issueSession, userForToken } from "@/lib/auth";
import { PASSWORD, call, cleanup, db, email, inbox, register, waitForMail } from "./helpers";

/** Sign-in hardening (docs/features/authentication.md): new-device emails, hash upgrades, idle browser sessions. */

afterAll(cleanup);

const NEW_SIGN_IN = /^New sign-in to your eGuard account$/;
const install = (id: string) => ({ "x-eguard-install": id, "user-agent": "eGuard/1.0 (iPhone; iOS 18.1)" });

describe("new sign-in emails", () => {
  it("emails a sign-in from an install the parent hasn't used, and not one they have", async () => {
    const who = email("nadia");
    // The phone that signed up is the first known device: no email for it
    await register({ name: "Nadia Cruz", email: who, password: PASSWORD, guardian: true }, { headers: install("install-phone-0001") });
    expect((await call("POST", "/auth/login", { body: { email: who, password: PASSWORD }, headers: install("install-phone-0001") })).status).toBe(200);
    const fresh = Date.now() - 5000;
    expect((await call("POST", "/auth/login", { body: { email: who, password: PASSWORD }, headers: install("install-tablet-0002") })).status).toBe(200);
    const mail = await waitForMail(who, NEW_SIGN_IN, { after: fresh });
    expect(mail.Subject).toMatch(NEW_SIGN_IN);
    const notices = (await inbox(who)).filter((m) => NEW_SIGN_IN.test(m.subject));
    expect(notices.length).toBe(1);
    expect(notices[0].text).toContain("eGuard app on iOS");
    expect(notices[0].text).toContain("/forgot-password");
  });
});

describe("password hashes", () => {
  it("upgrades a bcrypt hash to argon2id at the next sign-in", async () => {
    const who = email("hana");
    const r = await register({ name: "Hana Cruz", email: who, password: PASSWORD, guardian: true });
    expect((await db.user.findUniqueOrThrow({ where: { email: who } })).passwordHash).toMatch(/^\$argon2id\$/);
    await db.user.update({ where: { id: r.data.user.id }, data: { passwordHash: bcrypt.hashSync(PASSWORD, 4) } });
    expect((await call("POST", "/auth/login", { body: { email: who, password: PASSWORD } })).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { email: who } })).passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect((await call("POST", "/auth/login", { body: { email: who, password: PASSWORD } })).status).toBe(200);
  });

  it("turns down a breached password when changing it", async () => {
    const who = email("pia");
    const r = await register({ name: "Pia Cruz", email: who, password: PASSWORD, guardian: true });
    const changed = await call("POST", "/me/password", { token: r.data.token, body: { current: PASSWORD, next: "password12" } });
    expect(changed.status).toBe(400);
    expect(changed.data.error).toMatch(/data breach/);
  });
});

describe("idle sessions", () => {
  it("ends a browser session after 14 days unused, but never an app's", async () => {
    const r = await register({ name: "Ida Cruz", email: email("ida"), password: PASSWORD, guardian: true });
    const userId = r.data.user.id as string;
    const web = await issueSession(userId, "Mozilla/5.0", { web: true });
    const app = await issueSession(userId, "eGuard/1.0 (iPhone; iOS 18.1)");
    const old = new Date(Date.now() - 15 * 864e5);
    await db.session.updateMany({ where: { id: { in: [web.sessionId, app.sessionId] } }, data: { lastSeenAt: old } });
    expect(await userForToken(web.token)).toBeNull();
    expect(await db.session.count({ where: { id: web.sessionId } })).toBe(0);
    expect((await userForToken(app.token))?.id).toBe(userId);
  });
});
