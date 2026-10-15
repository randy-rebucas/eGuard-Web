import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { createSession } from "./auth";
import { CHALLENGE_COOKIE, needsSecondStep, startChallenge } from "./two-factor";

/** The password (or reset link, or provider) checked out and a code is needed: no session yet, just the challenge. */
export async function toSecondStep(userId: string, next: string | null): Promise<never> {
  const { challenge, expiresAt } = await startChallenge(userId);
  (await cookies()).set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
  });
  redirect(`/login/two-step${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

/** Signs in on the web after Google / LinkedIn: the code step first when the parent has turned it on. */
export async function completeWebSignIn(userId: string, next: string | null): Promise<never> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { twoFactor: true } });
  if (needsSecondStep(user)) await toSecondStep(userId, next);
  await createSession(userId);
  redirect(next ?? "/dashboard");
}
