import "server-only";
import { ensurePreference, noteActivity, noteActivitySafely, recordEvent } from "./events";

/**
 * What the rest of the app calls to tell parent care something happened. Kept small: services import this, not
 * the engine. Neither call can fail the caller's own action; failures are logged.
 */
export { noteActivitySafely };

/** A parent's account now exists and they can use it: signed up, or accepted an invitation. */
export async function noteRegistration(user: { id: string; familyId: string }) {
  try {
    await ensurePreference(user.id);
    await recordEvent({ userId: user.id, familyId: user.familyId, type: "PARENT_REGISTERED", eventId: `registered:${user.id}` });
    await noteActivity(user, "registered");
  } catch (e) {
    console.error("[parent-care] couldn't record registration", user.id, e);
  }
}
