import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword, issueSession, userForToken, verifyPassword } from "@/lib/auth";
import { createFamily } from "@/lib/family-service";
import { signInWithIdentity } from "@/lib/social-signin";
import type { Identity } from "@/lib/social-auth";

/** "Continue with Apple / Google" account linking, against the real database (ID token already verified). */

const db = new PrismaClient();
const RUN = `s${Date.now().toString(36)}`;
const mail = (who: string) => `${who}.${RUN}@social-test.example`;
const PASSWORD = "CorrectHorse123!";
const google = (email: string, subject = `sub-${email}`): Identity => ({ provider: "google", subject, email, emailVerified: true, name: "Parent" });

afterAll(async () => {
  await db.family.deleteMany({ where: { users: { some: { email: { contains: `${RUN}@social-test.example` } } } } });
  await db.$disconnect();
});

describe("signInWithIdentity", () => {
  it("an account someone registered with your unverified email is handed over only after locking them out", async () => {
    // The attacker signs up first with the victim's address and a password they know
    const squatter = await createFamily({ name: "Mallory", familyName: "Fake", email: mail("victim"), passwordHash: await hashPassword(PASSWORD) });
    const { token } = await issueSession(squatter.id, "attacker");
    expect(await userForToken(token)).not.toBeNull();

    // The real owner arrives with a provider-verified email
    const r = await signInWithIdentity(google(mail("victim")));
    expect(r).toEqual({ userId: squatter.id, isNew: false });
    const u = await db.user.findUniqueOrThrow({ where: { id: squatter.id } });
    expect(await verifyPassword(PASSWORD, u.passwordHash)).toBe(false);
    expect(u.passwordSet).toBe(false);
    expect(u.emailVerifiedAt).not.toBeNull();
    expect(await userForToken(token)).toBeNull();
    expect(await db.auditLog.count({ where: { familyId: squatter.familyId, action: "account.claimed" } })).toBe(1);
  });

  it("links a verified account without touching its password or sessions", async () => {
    const owner = await createFamily({ name: "Rosa", familyName: "Reyes", email: mail("rosa"), passwordHash: await hashPassword(PASSWORD), emailVerified: true });
    const { token } = await issueSession(owner.id, "phone");
    expect(await signInWithIdentity(google(mail("rosa")))).toEqual({ userId: owner.id, isNew: false });
    const u = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(await verifyPassword(PASSWORD, u.passwordHash)).toBe(true);
    expect(await userForToken(token)).not.toBeNull();
    // Next time the identity itself signs in
    expect(await signInWithIdentity(google(mail("rosa")))).toEqual({ userId: owner.id, isNew: false });
    expect(await db.oAuthIdentity.count({ where: { userId: owner.id } })).toBe(1);
  });

  it("never links an alias of someone's email to their account", async () => {
    const alice = await createFamily({ name: "Alice", familyName: "A", email: mail("alice"), passwordHash: await hashPassword(PASSWORD), emailVerified: true });
    const alias = mail("alice").replace("@", "+evil@");
    await expect(signInWithIdentity(google(alias), { guardian: true })).rejects.toMatchObject({ status: 409 });
    expect(await db.oAuthIdentity.count({ where: { userId: alice.id } })).toBe(0);
  });

  it("creates a family for a new parent who confirms they're a guardian, with no password set", async () => {
    await expect(signInWithIdentity(google(mail("new")))).rejects.toMatchObject({ code: "guardian_required" });
    const r = await signInWithIdentity(google(mail("new")), { guardian: true, name: "Nia Cruz" });
    expect(r.isNew).toBe(true);
    const u = await db.user.findUniqueOrThrow({ where: { id: r.userId }, include: { family: true } });
    expect(u).toMatchObject({ name: "Nia Cruz", passwordSet: false, role: "FAMILY_ADMIN" });
    expect(u.family).toMatchObject({ name: "Cruz Family", plan: "eGuard Plus", renewsAt: null });
  });

  it("needs a verified email from the provider", async () => {
    await expect(signInWithIdentity({ ...google(mail("unverified")), emailVerified: false }, { guardian: true })).rejects.toMatchObject({ code: "email_required" });
  });
});
