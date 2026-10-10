import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/errors";

/** Sign-in, two-step, sign-up and the emailed-link actions: what's checked, when a session starts, and where the parent lands. */

vi.mock("server-only", () => ({}));
/** Like Next's: redirect() throws, so nothing after it runs */
class Redirect extends Error {
  constructor(public to: string) { super(`NEXT_REDIRECT ${to}`); }
}
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Redirect(to); } }));
const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar, headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
const later = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock("next/server", () => later);
vi.mock("@/lib/db", () => ({ db: {} }));
const user = { id: "u1", familyId: "fam1", name: "Ana", email: "ana@example.com", role: "FAMILY_ADMIN" };
const auth = vi.hoisted(() => ({
  authenticate: vi.fn(), createSession: vi.fn(), destroySession: vi.fn(), hashPassword: vi.fn(), requireUser: vi.fn(),
  PASSWORD_TOO_LONG: "Use at most 72 characters.", passwordTooLong: () => false,
}));
vi.mock("@/lib/auth", () => auth);
const twoStep = vi.hoisted(() => ({ CHALLENGE_COOKIE: "eg_2fa", completeChallenge: vi.fn(), needsSecondStep: vi.fn(), startChallenge: vi.fn() }));
vi.mock("@/lib/two-factor", () => twoStep);
const limits = vi.hoisted(() => ({
  LIMITS: { signupIp: "signup", resetIp: "reset", tokenIp: "token" }, clientIpFrom: () => "203.0.113.7",
  enforce: vi.fn(), hit: vi.fn(), ipKey: (kind: string, ip: string) => `${kind}:${ip}`,
}));
vi.mock("@/lib/rate-limit", () => limits);
const reset = vi.hoisted(() => ({ requestPasswordResetQuietly: vi.fn(), resetPassword: vi.fn() }));
vi.mock("@/lib/password-reset", () => reset);
const verify = vi.hoisted(() => ({ sendVerificationEmail: vi.fn(), sendVerificationEmailLater: vi.fn(), verifyEmailToken: vi.fn() }));
vi.mock("@/lib/email-verification", () => verify);
const invites = vi.hoisted(() => ({ acceptInvite: vi.fn(), declineInvite: vi.fn() }));
vi.mock("@/lib/invitations", () => invites);
const family = vi.hoisted(() => ({ createFamily: vi.fn() }));
// The real RegisterSchema; creating the family is stubbed
vi.mock("@/lib/family-service", async (orig) => ({ ...(await orig<typeof import("@/lib/family-service")>()), ...family }));
for (const m of ["billing", "web-billing", "organizations", "audit", "device-slots"]) {
  vi.doMock(`@/lib/${m}`, () => ({}));
}
vi.mock("@/lib/plan-access", () => ({}));

const actions = await import("./auth");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
/** Where the action redirected to, or undefined when it returned instead */
const landing = async (run: Promise<unknown>) => {
  try {
    await run;
  } catch (e) {
    if (e instanceof Redirect) return e.to;
    throw e;
  }
  return undefined;
};

beforeEach(() => {
  // reset, not clear: a rejection set up for one test mustn't carry into the next
  vi.resetAllMocks();
  auth.authenticate.mockResolvedValue(user);
  twoStep.needsSecondStep.mockReturnValue(false);
  limits.hit.mockResolvedValue({ limited: false });
});

describe("login", () => {
  it("checks the form before looking anyone up, and keeps the email typed", async () => {
    expect(await actions.login(undefined, form({ email: "ana", password: "pw" }))).toEqual({ error: "Enter a valid email address.", fields: { email: "ana" } });
    expect(await actions.login(undefined, form({ email: "ana@example.com", password: "" }))).toEqual({ error: "Enter your password.", fields: { email: "ana@example.com" } });
    expect(auth.authenticate).not.toHaveBeenCalled();
  });
  it("signs in with the normalised email and goes to the dashboard", async () => {
    expect(await landing(actions.login(undefined, form({ email: " Ana@Example.com ", password: "pw" })))).toBe("/dashboard");
    expect(auth.authenticate).toHaveBeenCalledWith("ana@example.com", "pw", "203.0.113.7");
    expect(auth.createSession).toHaveBeenCalledWith("u1");
  });
  it("shows a wrong password without starting a session", async () => {
    auth.authenticate.mockRejectedValue(new ServiceError(401, "That email and password don't match.", "unauthorized"));
    expect(await actions.login(undefined, form({ email: "ana@example.com", password: "nope" }))).toEqual({ error: "That email and password don't match.", fields: { email: "ana@example.com" } });
    expect(auth.createSession).not.toHaveBeenCalled();
  });
  it("lets an unexpected failure through instead of hiding it", async () => {
    auth.authenticate.mockRejectedValue(new Error("database down"));
    await expect(actions.login(undefined, form({ email: "ana@example.com", password: "pw" }))).rejects.toThrow("database down");
  });
  it("returns to a page on this site, but never to another site", async () => {
    expect(await landing(actions.login(undefined, form({ email: "ana@example.com", password: "pw", next: "/children/c1" })))).toBe("/children/c1");
    expect(await landing(actions.login(undefined, form({ email: "ana@example.com", password: "pw", next: "//evil.example" })))).toBe("/dashboard");
    expect(await landing(actions.login(undefined, form({ email: "ana@example.com", password: "pw", next: "https://evil.example" })))).toBe("/dashboard");
  });
  it("with two-step on: sets only the challenge cookie, no session, and keeps where to return", async () => {
    twoStep.needsSecondStep.mockReturnValue(true);
    const expiresAt = new Date(Date.now() + 600_000);
    twoStep.startChallenge.mockResolvedValue({ challenge: "ch1", expiresAt });
    expect(await landing(actions.login(undefined, form({ email: "ana@example.com", password: "pw", next: "/location" })))).toBe("/login/two-step?next=%2Flocation");
    expect(jar.set).toHaveBeenCalledWith("eg_2fa", "ch1", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt }));
    expect(auth.createSession).not.toHaveBeenCalled();
  });
});

describe("verifySecondStep", () => {
  beforeEach(() => jar.get.mockReturnValue({ value: "ch1" }));

  it("without a challenge, goes back to sign in", async () => {
    jar.get.mockReturnValue(undefined);
    expect(await landing(actions.verifySecondStep(undefined, form({ code: "123456" })))).toBe("/login");
    expect(twoStep.completeChallenge).not.toHaveBeenCalled();
  });
  it("asks for a code before checking anything", async () => {
    expect(await actions.verifySecondStep(undefined, form({ code: "  " }))).toEqual({ error: "Enter the code from your authenticator app." });
    expect(twoStep.completeChallenge).not.toHaveBeenCalled();
  });
  it("a wrong code keeps the challenge so the parent can try again", async () => {
    twoStep.completeChallenge.mockRejectedValue(new ServiceError(400, "That code isn't right.", "invalid"));
    expect(await actions.verifySecondStep(undefined, form({ code: "000000" }))).toEqual({ error: "That code isn't right.", fields: undefined });
    expect(jar.delete).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });
  it("an expired challenge is cleared and the form says so", async () => {
    twoStep.completeChallenge.mockRejectedValue(new ServiceError(400, "That took too long. Sign in again.", "challenge_expired"));
    expect(await actions.verifySecondStep(undefined, form({ code: "123456" }))).toEqual({ error: "That took too long. Sign in again.", fields: { expired: "1" } });
    expect(jar.delete).toHaveBeenCalledWith("eg_2fa");
  });
  it("a right code clears the challenge, starts the session and returns to a safe page", async () => {
    twoStep.completeChallenge.mockResolvedValue({ user, usedRecoveryCode: false });
    expect(await landing(actions.verifySecondStep(undefined, form({ code: " 123456 ", next: "/devices" })))).toBe("/devices");
    expect(twoStep.completeChallenge).toHaveBeenCalledWith("ch1", "123456");
    expect(jar.delete).toHaveBeenCalledWith("eg_2fa");
    expect(auth.createSession).toHaveBeenCalledWith("u1");
    expect(await landing(actions.verifySecondStep(undefined, form({ code: "123456", next: "//evil.example" })))).toBe("/dashboard");
  });
  it("a recovery code goes to Security, saying how many are left", async () => {
    twoStep.completeChallenge.mockResolvedValue({ user, usedRecoveryCode: true, recoveryCodesLeft: 7 });
    expect(await landing(actions.verifySecondStep(undefined, form({ code: "abcd-efgh", next: "/devices" })))).toBe("/settings/security?recovery=7");
  });
});

describe("register", () => {
  const signup = { name: "Ana Cruz", familyName: "The Cruz family", email: "Ana@Example.com", password: "a-long-password", guardian: "on" };

  it("needs the parent or guardian confirmation, and keeps what was typed", async () => {
    expect(await actions.register(undefined, form({ ...signup, guardian: "" }))).toEqual({
      error: "Confirm you're a parent or legal guardian, 18 or older.",
      fields: { name: "Ana Cruz", familyName: "The Cruz family", email: "Ana@Example.com", guardian: "" },
    });
    expect(family.createFamily).not.toHaveBeenCalled();
  });
  it("checks the password length before anything is created", async () => {
    expect((await actions.register(undefined, form({ ...signup, password: "short" })))?.error).toBe("Use at least 10 characters for your password.");
    expect(limits.enforce).not.toHaveBeenCalled();
    expect(family.createFamily).not.toHaveBeenCalled();
  });
  it("creates the family with a hashed password, sends the verification email, and signs in", async () => {
    auth.hashPassword.mockResolvedValue("hash");
    family.createFamily.mockResolvedValue({ id: "u9" });
    expect(await landing(actions.register(undefined, form(signup)))).toBe("/dashboard");
    expect(limits.enforce).toHaveBeenCalledWith("signup:203.0.113.7", "signup");
    // Only the hash: the plain password never leaves the action
    expect(family.createFamily).toHaveBeenCalledWith({ name: "Ana Cruz", familyName: "The Cruz family", email: "ana@example.com", passwordHash: "hash" });
    expect(verify.sendVerificationEmailLater).toHaveBeenCalledWith("u9");
    expect(auth.createSession).toHaveBeenCalledWith("u9");
  });
  it("shows the rate limit or a taken email instead of throwing", async () => {
    limits.enforce.mockRejectedValue(new ServiceError(429, "Too many sign-ups. Try again later.", "rate_limited"));
    expect((await actions.register(undefined, form(signup)))?.error).toBe("Too many sign-ups. Try again later.");
    expect(family.createFamily).not.toHaveBeenCalled();
    limits.enforce.mockResolvedValue(undefined);
    family.createFamily.mockRejectedValue(new ServiceError(409, "An account already uses that email.", "conflict"));
    expect((await actions.register(undefined, form(signup)))?.error).toBe("An account already uses that email.");
    expect(auth.createSession).not.toHaveBeenCalled();
  });
});

describe("verifyEmail", () => {
  it("rate-limited: says so without spending the token", async () => {
    limits.hit.mockResolvedValue({ limited: true });
    expect(await actions.verifyEmail(undefined, form({ token: "t1" }))).toBe("limited");
    expect(verify.verifyEmailToken).not.toHaveBeenCalled();
  });
  it("checks the token and returns its result", async () => {
    verify.verifyEmailToken.mockResolvedValue("verified");
    expect(await actions.verifyEmail(undefined, form({ token: "t1" }))).toBe("verified");
    expect(verify.verifyEmailToken).toHaveBeenCalledWith("t1");
  });
});

describe("forgotPassword", () => {
  it("checks the email first", async () => {
    expect(await actions.forgotPassword(undefined, form({ email: "ana" }))).toEqual({ error: "Enter a valid email address.", fields: { email: "ana" } });
    expect(later.after).not.toHaveBeenCalled();
  });
  it("rate-limited: says so and sends nothing", async () => {
    limits.hit.mockResolvedValue({ limited: true });
    expect((await actions.forgotPassword(undefined, form({ email: "ana@example.com" })))?.error).toBe("Too many requests. Try again in an hour.");
    expect(later.after).not.toHaveBeenCalled();
  });
  it("sends after responding, with the same message whether or not the account exists", async () => {
    expect(await actions.forgotPassword(undefined, form({ email: " Ana@Example.com " }))).toEqual({
      ok: "If an eGuard account uses ana@example.com, we sent it a link to reset the password. It expires in an hour.",
    });
    expect(reset.requestPasswordResetQuietly).not.toHaveBeenCalled();
    await later.after.mock.calls[0][0]();
    expect(reset.requestPasswordResetQuietly).toHaveBeenCalledWith("ana@example.com", null);
  });
});

describe("resetPasswordWithToken", () => {
  it("shows a used or expired link instead of throwing", async () => {
    reset.resetPassword.mockRejectedValue(new ServiceError(400, "This link has expired.", "invalid"));
    expect(await actions.resetPasswordWithToken(undefined, form({ token: "t1", password: "a-long-password" }))).toEqual({ error: "This link has expired." });
    expect(auth.createSession).not.toHaveBeenCalled();
  });
  it("signs in after the reset", async () => {
    reset.resetPassword.mockResolvedValue(user);
    expect(await landing(actions.resetPasswordWithToken(undefined, form({ token: "t1", password: "a-long-password" })))).toBe("/dashboard");
    expect(reset.resetPassword).toHaveBeenCalledWith("t1", "a-long-password", "203.0.113.7");
    expect(auth.createSession).toHaveBeenCalledWith("u1");
  });
  it("with two-step on, the emailed link alone doesn't sign in", async () => {
    reset.resetPassword.mockResolvedValue(user);
    twoStep.needsSecondStep.mockReturnValue(true);
    twoStep.startChallenge.mockResolvedValue({ challenge: "ch1", expiresAt: new Date() });
    expect(await landing(actions.resetPasswordWithToken(undefined, form({ token: "t1", password: "a-long-password" })))).toBe("/login/two-step");
    expect(auth.createSession).not.toHaveBeenCalled();
  });
});

describe("invitations", () => {
  it("accept: rate-limited first, then joins and signs in", async () => {
    limits.enforce.mockRejectedValueOnce(new ServiceError(429, "Too many attempts.", "rate_limited"));
    expect(await actions.acceptInvitation(undefined, form({ token: "t1", password: "a-long-password" }))).toEqual({ error: "Too many attempts." });
    expect(invites.acceptInvite).not.toHaveBeenCalled();
    invites.acceptInvite.mockResolvedValue({ id: "u2" });
    expect(await landing(actions.acceptInvitation(undefined, form({ token: "t1", password: "a-long-password" })))).toBe("/dashboard");
    expect(invites.acceptInvite).toHaveBeenCalledWith("t1", "a-long-password");
    expect(auth.createSession).toHaveBeenCalledWith("u2");
  });
  it("accept: an invitation that's gone is shown, with no session", async () => {
    invites.acceptInvite.mockRejectedValue(new ServiceError(404, "This invitation was cancelled.", "not_found"));
    expect(await actions.acceptInvitation(undefined, form({ token: "t1", password: "a-long-password" }))).toEqual({ error: "This invitation was cancelled." });
    expect(auth.createSession).not.toHaveBeenCalled();
  });
  it("decline: names the family and doesn't sign in", async () => {
    invites.declineInvite.mockResolvedValue({ familyName: "The Cruz family" });
    expect(await actions.declineInvitation(undefined, form({ token: "t1" }))).toEqual({
      ok: "You declined the invitation to The Cruz family. Nothing was set up, and they can't add you without a new invitation.",
    });
    expect(auth.createSession).not.toHaveBeenCalled();
    invites.declineInvite.mockRejectedValue(new ServiceError(404, "This invitation was cancelled.", "not_found"));
    expect(await actions.declineInvitation(undefined, form({ token: "t1" }))).toEqual({ error: "This invitation was cancelled." });
  });
});

describe("resendVerificationEmail", () => {
  beforeEach(() => auth.requireUser.mockResolvedValue(user));

  it("sends, throttled, to the signed-in parent's email", async () => {
    verify.sendVerificationEmail.mockResolvedValue(true);
    expect(await actions.resendVerificationEmail()).toEqual({ ok: "We sent a new link to ana@example.com." });
    expect(verify.sendVerificationEmail).toHaveBeenCalledWith("u1", { throttle: true });
  });
  it("says when there's nothing to verify, and shows the throttle", async () => {
    verify.sendVerificationEmail.mockResolvedValue(false);
    expect(await actions.resendVerificationEmail()).toEqual({ ok: "Your email is already verified." });
    verify.sendVerificationEmail.mockRejectedValue(new ServiceError(429, "Wait a minute before asking again.", "rate_limited"));
    expect(await actions.resendVerificationEmail()).toEqual({ error: "Wait a minute before asking again." });
  });
});

describe("logout", () => {
  it("ends the session and goes to sign in", async () => {
    expect(await landing(actions.logout())).toBe("/login");
    expect(auth.destroySession).toHaveBeenCalled();
  });
});
