import type { BrowserInstallation } from "@prisma/client";
import { isOffline } from "./health";

/**
 * A browser's status as parents read it, on the web cards and in the apps (GET /browsers `status`), so both say the
 * same thing. The extension's own answer from its latest health report (docs/browser-extension-api.md, POST /health).
 */
export const BROWSER_STATE: Record<string, [tone: string, label: string, note: string]> = {
  PROTECTED: ["tone-ok", "Protected", "Blocking sites with your browser settings."],
  NEEDS_ATTENTION: ["tone-warn", "Needs attention", "Some of its checks need review. Your alerts say which, and so does eGuard's popup in the browser."],
  ACTION_REQUIRED: ["tone-crit", "Action required", "Sites may not be blocked. Your alerts say what to fix, and so does eGuard's popup in the browser."],
  SYNC_PAUSED: ["tone-warn", "Sync paused", "It keeps blocking with its last settings, but isn't getting your changes."],
  UNSUPPORTED: ["tone-muted", "Not supported", "This browser can't run eGuard's protection. Update it, or use Chrome, Edge or Firefox."],
};

type BrowserLike = Pick<BrowserInstallation, "lastSeenAt" | "revokedAt" | "protectionState">;

/** A browser's [tone, label, note]: disconnected and silent override what it last reported. */
export function browserStatus(b: BrowserLike): [tone: string, label: string, note: string] {
  if (b.revokedAt) return ["tone-crit", "Disconnected for security", "Remove it, then add it again with a new code."];
  // Silent for a day: whatever it last reported can't be confirmed now
  if (isOffline(b)) return ["tone-warn", "Not seen for a day", "Its last settings stay active, but eGuard can't confirm them until the browser is opened again."];
  // A state this server doesn't know yet (a newer extension) reads as plain "Connected"
  return (b.protectionState ? BROWSER_STATE[b.protectionState] : undefined) ?? ["tone-accent", "Connected", b.protectionState ? "" : "Waiting for its first health check."];
}
