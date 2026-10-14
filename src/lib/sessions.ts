import "server-only";
import { db } from "./db";
import { ServiceError, notFound } from "./errors";

/**
 * Signs out one of the parent's other sessions, for web and the apps. Only their own: another parent's session id
 * is "not found", the same as one that doesn't exist. Push tokens registered by it are deleted with it (cascade).
 */
export async function signOutSession(user: { id: string; sessionId: string }, sessionId: string) {
  if (typeof sessionId !== "string" || sessionId.length > 64) throw notFound("Session");
  if (sessionId === user.sessionId) throw new ServiceError(400, "That's this session. Use Sign out instead.", "current_session");
  const r = await db.session.deleteMany({ where: { id: sessionId, userId: user.id } });
  if (!r.count) throw notFound("Session");
}
