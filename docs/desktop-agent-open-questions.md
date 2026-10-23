# Desktop agent: open questions and suggestions

Gaps and contradictions found in [desktop-agent-spec.md](desktop-agent-spec.md) while writing
[desktop-agent-prompt.md](desktop-agent-prompt.md) (2026-10-23). None is decided yet. When one is settled, write the
answer into the spec, then mark it **Settled** here with the date and the spec section it went into.

| # | Topic | Spec section | Status |
|---|---|---|---|
| Q1 | [Admin accounts in acceptance test 8](#q1-admin-accounts-in-acceptance-test-8) | 2, 14 | Open |
| Q2 | [Shared PCs](#q2-shared-pcs) | 1, 4 | **Settled** 2026-10-23 (spec 1, 4, 11, 12) |
| Q3 | [Anti-cheat and TerminateProcess](#q3-anti-cheat-and-terminateprocess) | 2, 7 | Open |
| Q4 | [Waking the PC for a removal](#q4-waking-the-pc-for-a-removal) | 10, 12 | **Settled** 2026-10-23 (spec 10, 12) |
| Q5 | [Guessing the removal code](#q5-guessing-the-removal-code) | 10 | **Settled** 2026-10-23 (spec 10, 11) |
| Q6 | [Clock changes while offline](#q6-clock-changes-while-offline) | 8 | Open |
| Q7 | [Self-update](#q7-self-update) | 10, 15 | Open |
| Q8 | [Recovery if eGuard goes away](#q8-recovery-if-eguard-goes-away) | 10 | Open |
| Q9 | [Exclusive fullscreen games](#q9-exclusive-fullscreen-games) | 8 | Open |

The prompt asks the agent to answer Q2 to Q6 in its first plan.

---

## Q1. Admin accounts in acceptance test 8

**Problem:** principle 2 says no user-mode software holds against an administrator account. Acceptance test 8 says
every removal route fails "as the child **and as a local admin**". An admin can take ownership of the files, run
commands as SYSTEM (a scheduled task, PsExec), or edit the registry offline from WinRE.

**Suggestion:** split test 8. As the standard child account, every route fails and alerts. As a local admin, every
route alerts the parent while it happens; failing is a bonus, not a requirement. Otherwise the agent chases a goal
it can't reach.

## Q2. Shared PCs

**Problem:** the spec treats a PC as one device of one child. Family PCs often have the parent's Windows account
on them too. As written, the parent's own games and apps would be blocked and counted.

**Suggestion:** at pairing, the parent picks which Windows accounts are the child's (default: the account that was
signed in when the code was typed, if it's a standard account). Other accounts are not enforced or counted.
Report the mapping in `/report` so the dashboard can show it. A new local account appearing later raises an alert.

**Settled (2026-10-23):** as suggested, with every standard account preselected rather than only the signed-in one
(the parent usually installs from their own administrator account). `/report` `accounts`, `TAMPER` `NEW_ACCOUNT`.
Spec sections 1, 4, 11 and 12.

## Q3. Anti-cheat and TerminateProcess

**Problem:** Vanguard (Valorant) and EAC (Fortnite) can strip handle rights on the game's process through kernel
callbacks, so `TerminateProcess` from a SYSTEM service may be denied. The whole enforcement design rests on it.

**Suggestion:** a spike before phase 4: try ending CS2, Fortnite and Valorant from the service and record what
happens, including whether the anti-cheat flags it. If ending fails, the fallbacks in order:
1. Stop the launch before it happens: an Image File Execution Options `Debugger` value pointing at an eGuard stub
   for blocked exe names. It's by name only, so pair it with the id match in section 6.
2. End the launcher (Riot Client, Epic) instead of the game.
3. The full-screen overlay plus `LockWorkStation`.

## Q4. Waking the PC for a removal

**Problem:** removal step 3 says "the PC is woken", but the spec defines no push channel for Windows. The PC only
learns of a removal at its next sync, and acceptance test 9 ("within a minute") depends on that interval.

**Suggestion:** pick one and write it in sections 10 and 12:
- a short normal sync interval for computers (cheapest, but costs server load), or
- a long-poll or SSE endpoint the service keeps open (fast, one connection per PC), or
- WNS push (needs a Store identity; probably not worth it).

**Settled (2026-10-23):** computers always get `nextSyncSeconds: 60`. It also brings a parent's "allow" and extra
time to the PC within a minute. A long-poll endpoint stays an option if the load ever matters. Spec sections 10, 12.

## Q5. Guessing the removal code

**Problem:** "Remove with a code" has no attempt limit, so a child can keep guessing codes in the agent.

**Suggestion:** 5 wrong attempts lock the input for 15 minutes, doubling each time, persisted across restarts. Each
lockout sends a new `TAMPER` kind, `REMOVAL_CODE_GUESSED` (Action required). That needs a server change: add the
kind to the enum and the alert table in section 11.

**Settled (2026-10-23):** as suggested, capped at 24 hours. Also: a valid code no longer removes a computer the
parent chose to keep; it raises an alert instead. Spec sections 10, 11.

## Q6. Clock changes while offline

**Problem:** the agent keeps an offset from `/sync` `serverTime`. If the PC reboots while offline, the offset is
gone, and a changed clock could grant time or skip bedtime.

**Suggestion:** persist the last trusted server time and the monotonic clock at that moment. After a reboot
offline, never accept a local time earlier than the last trusted time. If the local time jumps forward by more than
the uptime allows, keep enforcing and queue `CLOCK_CHANGED` for when it's back online.

## Q7. Self-update

**Problem:** the spec has no update path. The guard restores eGuard's files from its protected cache, so it will
fight any update unless updates are part of the design. This blocks shipping as much as the code-signing
certificate.

**Suggestion:** the service downloads updates over HTTPS and accepts one only when it's Authenticode-signed with
eGuard's certificate **and** listed in a signed manifest (same key scheme as the catalog). It replaces the guard's
cache first, then the binaries, then restarts. If the new version fails a health check within a set time, it rolls
back. `/sync` `minAppVersion` already exists to force updates.

## Q8. Recovery if eGuard goes away

**Problem:** only the parent can remove eGuard, from the dashboard. If the service shuts down, the account is
closed, or the parent loses access, there's no way off the PC short of reinstalling Windows. That is a consumer-law
risk, and it makes Defender more likely to flag the agent as unwanted software.

**Suggestion:** a recovery route that doesn't depend on the live server, for example a support-issued removal code
from an offline key, and a written end-of-life plan that signs one last uninstall command for every device. Put
it in the privacy policy and terms.

## Q9. Exclusive fullscreen games

**Problem:** a topmost window can't draw over a game running in exclusive fullscreen, so the time-up and bedtime
overlay won't show while the game is in front.

**Suggestion:** when time runs out or bedtime starts, end the foreground app first (unless it's ALWAYS_ALLOWED),
then show the overlay. Say so in section 8.

---

## Also worth doing during the build

- Verify the canonical JSON used for signatures produces byte-identical output to the server's. Test against
  fixtures signed by the server code, not hand-written ones.
- Cache Authenticode results by path, size and modified time so the 6-hourly scan doesn't re-verify every exe.
- Do all security-changing work (service DACLs, SafeBoot keys, browser policies) on a VM. This PC runs Windows 11
  Home, which has no Hyper-V; use VirtualBox or VMware.
