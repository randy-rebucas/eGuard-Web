import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PASSWORD, call, cleanup, db, email, inbox, inviteToken } from "./helpers";

/**
 * Inviting another parent (lib/invitations): nobody joins a family without seeing which one it is and accepting,
 * and an invitation never stops the person making their own account.
 */

let admin = "";
let familyId = "";

beforeAll(async () => {
  const r = await call("POST", "/auth/register", { body: { name: "Maria Santos", email: email("maria"), password: PASSWORD, guardian: true } });
  admin = r.data.token;
  familyId = r.data.user.family.id;
});
afterAll(cleanup);

const invite = (name: string, to: string, extra: Record<string, unknown> = {}) =>
  call("POST", "/family/members", { token: admin, body: { name, email: to, ...extra } });

describe("inviting a parent", () => {
  it("sends an invitation instead of creating a sign-in; an old app's temporary password is ignored", async () => {
    const r = await invite("Ben Santos", email("ben"), { password: PASSWORD });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ pending: true, emailSent: true, expiresInDays: 7 });
    // The password the old app sent doesn't sign anyone in
    expect((await call("POST", "/auth/login", { body: { email: email("ben"), password: PASSWORD } })).status).toBe(401);
    const fam = await call("GET", "/family", { token: admin });
    expect(fam.data.members.find((m: { email: string }) => m.email === email("ben"))).toMatchObject({ pending: true });
  });

  it("shows which family it is before accepting, then signs them in with their own password", async () => {
    const t = await inviteToken(email("ben"));
    const info = await call("GET", `/auth/invite?token=${t}`);
    expect(info.data).toMatchObject({ familyName: "Santos Family", invitedBy: "Maria Santos", email: email("ben") });
    expect((await call("POST", "/auth/accept-invite", { body: { token: t, password: "short" } })).status).toBe(400);
    const ok = await call("POST", "/auth/accept-invite", { body: { token: t, password: "Bens-own-password-1" } });
    expect(ok.status).toBe(200);
    expect(ok.data.user).toMatchObject({ role: "PARENT", emailVerified: true });
    // Single use
    expect((await call("POST", "/auth/accept-invite", { body: { token: t, password: "Bens-own-password-1" } })).data.code).toBe("link_invalid");
    expect(await db.alert.count({ where: { familyId, title: "Parent joined" } })).toBe(1);
  });

  it("declining removes the pending account", async () => {
    await invite("Cora Lim", email("cora"));
    const r = await call("POST", "/auth/decline-invite", { body: { token: await inviteToken(email("cora")) } });
    expect(r.data).toMatchObject({ ok: true, familyName: "Santos Family" });
    expect(await db.user.count({ where: { email: email("cora") } })).toBe(0);
  });

  it("never blocks the person signing up for themselves: their own family, invitation dropped", async () => {
    await invite("Dan Cruz", email("dan"));
    const r = await call("POST", "/auth/register", { body: { name: "Dan Cruz", email: email("dan"), password: PASSWORD, guardian: true } });
    expect(r.status).toBe(201);
    expect(r.data.user).toMatchObject({ role: "FAMILY_ADMIN" });
    expect(r.data.user.family.id).not.toBe(familyId);
    expect(await db.user.count({ where: { email: email("dan"), familyId } })).toBe(0);
  });

  it("forgot password on a pending invitation sends the invitation again, not a reset link", async () => {
    await invite("Eve Tan", email("eve"));
    const before = Date.now();
    await call("POST", "/auth/forgot-password", { body: { email: email("eve") } });
    await inviteToken(email("eve"), { after: before });
    const mail = await inbox(email("eve"));
    expect(mail.some((m) => /reset-password/.test(m.text))).toBe(false);
  });

  it("only the family admin invites and resends; resending an accepted one is a conflict", async () => {
    const ben = (await call("POST", "/auth/login", { body: { email: email("ben"), password: "Bens-own-password-1" } })).data.token;
    expect((await call("POST", "/family/members", { token: ben, body: { name: "X Y", email: email("xy") } })).status).toBe(403);
    const eve = await db.user.findFirstOrThrow({ where: { email: email("eve") } });
    expect((await call("POST", `/family/members/${eve.id}/invite`, { token: admin })).status).toBe(200);
    const benId = (await db.user.findFirstOrThrow({ where: { email: email("ben") } })).id;
    expect((await call("POST", `/family/members/${benId}/invite`, { token: admin })).status).toBe(409);
  });

  it("withdrawing an invitation makes its link stop working", async () => {
    const eve = await db.user.findFirstOrThrow({ where: { email: email("eve") } });
    const t = await inviteToken(email("eve"));
    expect((await call("DELETE", `/family/members/${eve.id}`, { token: admin })).status).toBe(200);
    expect((await call("GET", `/auth/invite?token=${t}`)).data.code).toBe("link_invalid");
  });

  it("can't invite an address that already has an eGuard account", async () => {
    expect((await invite("Maria Again", email("maria"))).status).toBe(409);
  });
});
