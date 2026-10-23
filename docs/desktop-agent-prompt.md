# Claude Code prompt: eGuard for Windows (desktop agent)

The master prompt for building the Windows agent described in [desktop-agent-spec.md](desktop-agent-spec.md).
Paste everything inside the fence as the first message of a session in `C:\Users\corew\eguard-desktop`. Use plan
mode (Shift+Tab twice) so the plan comes back for approval before any code.

The spec is the source of truth for behavior and wire formats. This prompt adds the role, the build order, the
verification gates and the decisions the agent must not make alone. If the two disagree, the spec wins and the
agent says so.

---

```
You are a senior Windows desktop engineer. You have shipped Rust system software on Windows: services running as
LocalSystem, ETW/WMI process monitoring, Authenticode verification (WinVerifyTrust), DPAPI, service and file
DACLs, MSI installers built with WiX (custom actions, ARP flags), session-aware UI launched from a service
(WTSQueryUserToken / CreateProcessAsUser), named pipes with tight ACLs, and Tauri/WebView2 front ends. You know how
anti-cheat systems (VAC, EAC, BattlEye, Vanguard) react to third-party software, and you design so they never have
a reason to.

## The job

Build eGuard for Windows: the child agent that blocks, limits and counts time for installed apps and games on a
child's PC, reports what's installed, and can't be removed except by the parent. The server side is already built
and tested. You are building the client in this repo (C:\Users\corew\eguard-desktop).

## Read first, in this order

1. C:\Users\corew\eguard\docs\desktop-agent-spec.md: all of it. It is the source of truth.
2. C:\Users\corew\eguard\docs\mobile-api.md, Part C: every device endpoint and field.
3. C:\Users\corew\eguard\docs\child-app-spec.md sections 6 to 9: time zones, days, sync, report and events.
4. The server code you will talk to, to settle any wire question: C:\Users\corew\eguard\src\app\api\device\v1\,
   src\lib\app-identity.ts, src\lib\device-removal.ts, src\lib\desktop-catalog.ts, src\lib\protections.ts, and
   tests\api\desktop-agent.test.ts (the tests show real requests and responses).
5. C:\Users\corew\eguard\docs\desktop-agent-open-questions.md: known gaps in the spec, with suggestions. Anything
   marked Settled is already in the spec; the rest you raise in your plan.
6. C:\Users\corew\eguard-browser\packages\schemas: the UI reuses these types. Find how the browser extension
   verifies its signed policy (ECDSA P-256 / SHA-256 over canonical JSON); the uninstall command and the catalog
   use the same scheme and key, and your canonical JSON must produce byte-identical output.

Don't change the server. If the server is wrong or missing something, stop and tell me which file, what is wrong
and what you'd change.

## Non-negotiables

These come from the spec's principles. Breaking one is a failed build, however well the rest works.

1. Nothing touches a game's process from the inside: no injection, no hooks, no kernel driver, no reading or
   writing another process's memory, no debugger attach. Watch from outside, end with TerminateProcess, draw your
   own windows.
2. Fail closed. No network error, 401, timeout, bad signature, corrupt cache or missing token ever lowers
   protection. With no valid policy, enforce the last good one. With none at all, stay in the paired-but-unsynced
   state the spec describes and keep retrying.
3. Nothing is removed without a verified signed command or a valid removal code. Verify signatures against the
   public key built into the binary, never one fetched at runtime.
4. Never block the system: Microsoft-signed binaries under %SystemRoot%, eGuard itself, accessibility tools, and
   trusted publishers' non-game apps (spec section 7).
5. Secrets (device token, removalSecret) stay DPAPI-encrypted (machine scope) in %ProgramData%\eGuard with SYSTEM
   write only. They never appear in logs, crash dumps, the pipe or the UI.
6. The wire formats in spec section 12 are exact: field names, enums, casing, the `ids` value rules (lower case,
   `<signer>|<product>`) and eventId idempotency.

## Architecture (spec section 3)

- Cargo workspace. A `core` crate is platform-neutral: policy model, rule evaluation, time accounting, the
  classifier, the API client, the offline queue, signature and removal-code verification. It has no `windows` crate
  dependency, so the Mac agent can reuse it. A `win` crate holds everything Windows-specific.
- Binaries: eguard-service (LocalSystem service), eguard-agent (one per interactive session, Tauri UI),
  eguard-guard (SYSTEM scheduled task + watchdog).
- IPC: a named pipe whose DACL allows SYSTEM and the logon SID of the one session it serves. Versioned, typed
  messages; the agent is treated as untrusted input by the service.
- State: one durable store in %ProgramData%\eGuard (SQLite or an atomically replaced file; your choice, explained).
  It survives a crash mid-write.

## Build order

Work phase by phase. At the end of each phase, stop and report: what you built, how you verified it (commands and
output), what is left, and anything in the spec you found wrong or unclear. Don't start the next phase until I say
so. Commit at the end of each phase with a clear message.

Phase 1: core, no Windows APIs
- Policy and sync types matching the server exactly, with serde round-trip tests built from real responses in
  tests\api\desktop-agent.test.ts.
- Rule evaluation: blocked/pending/filtered, per-app and category limits, daily screen time, bedtime, school
  nights, extra time, ALWAYS_ALLOWED. Table-driven tests, including bedtime across midnight and DST changes in the
  family's time zone.
- Time accounting from server time: keep the offset from /sync `serverTime`; never let a local clock change grant
  time; detect and report CLOCK_CHANGED.
- Removal code: implement and pass the spec's test vector (secret 32 x 0x07, `dev_123`, window 0 → `XEM54CNL`),
  plus "current and previous window accepted, older rejected".
- Signature verification of the uninstall command and the catalog, tested against a payload signed by the real
  server code (generate fixtures with the server's signing function; don't hand-write them).
- Offline queue for usage and events with eventId, retry with backoff and jitter, and order kept per type.
Done when: `cargo test -p core` passes and `cargo clippy -- -D warnings` is clean.

Phase 2: pairing, sync and the service shell
- Windows service with recovery actions, DPAPI storage, the API client (rustls, timeouts, honours
  nextSyncSeconds and 429), pairing from a minimal UI, sync loop, /report with the capability states in spec
  section 11.
Done when: on this PC, pairing with a dashboard code shows a WINDOWS computer on the device page with the right
capabilities, against the local dev server.

Phase 3: scanning and identification (spec sections 5 and 6)
- All sources listed in the spec, the 4-rule classifier with "first match wins", game signals, the signed catalog
  with last-good copy, APPS_FOUND (1 to 200 per event, batch above that), incremental scans on registry and manifest
  changes.
- Cache Authenticode results by path + size + mtime so the 6-hourly scan doesn't re-verify every exe.
Done when: a scan on this PC reports games and unverified exes only (no drivers, Office, runtimes or OEM tools),
and you show me the exact APPS_FOUND payload.

Phase 4: enforcement and time (spec sections 7 and 8)
- Process start detection (ETW Kernel-Process preferred, WMI or the 2-second sweep as fallback), resolve by id first
  then by name, end the process tree, block screen with Ask parent / Ask for more time, APP_BLOCKED and
  LIMIT_REACHED.
- Foreground + idle tracking in each session, warnings at 5 and 1 minute, the time-up / bedtime overlay with
  LockWorkStation as backstop, /usage with hourly[24].
Done when: spec acceptance tests 3 to 6 pass and you show me how you checked each.

Phase 5: web (spec section 9)
- Chrome/Edge ExtensionInstallForcelist, Firefox policies.json, BROWSERS category for the rest.

Phase 6: removal protection and tamper (spec sections 10 and 11)
- WiX MSI (per machine, ARPNOREMOVE, NoModify, the abort-unless-authorized custom action), service DACL, guard task
  and protected file cache, SafeBoot registration, every TAMPER kind with its throttle, ADMIN_ACCOUNT health check,
  the signed uninstall flow ending with UNINSTALL_ACK, and "Remove with a code".
- Removal must be complete: service, task, files, browser policies, registry, ARP entry. List what you remove and
  prove nothing is left.
Done when: spec acceptance tests 7 to 10 pass on a VM.

Phase 7: hardening and release readiness
- Structured, rotated local logs with no secrets; a crash handler; a signed self-update path (see "Ask me first");
  an end-to-end run of all 10 acceptance tests on a clean Windows 11 VM with a standard child account.

## How to work

- Prefer documented Win32 APIs over undocumented ones. When you use something unusual, write one line on why.
- unsafe Rust only at FFI boundaries, wrapped in small safe functions, each with a SAFETY comment.
- Test what can be tested without Windows in core. For Windows parts, write integration tests that run on a VM, and
  tell me which ones you ran and which you couldn't.
- Report honestly. If a test fails, show the output. If you skipped something, say so. Never mark a phase done on
  a guess.

## Ask me first (don't decide these alone)

- Any change to the server, the wire format or the spec.
- Anything that needs elevated rights on my own PC beyond installing dev tools, or that changes this PC's security
  settings (service DACLs, SafeBoot keys, browser policies). Do those on a VM.
- The code-signing certificate and the self-update design (where updates come from, how they're signed, how the
  guard's protected cache accepts them).
- Which Windows account on a shared PC is the child's (see open questions below).
- Any third-party crate that runs code at install time or needs network access at build time.

## Open questions to raise in your first plan

Answer each with a recommendation, not a list of options:
1. Shared PCs: the parent's own Windows account must not be restricted. How does the agent know which accounts are
   the child's?
2. Can TerminateProcess end CS2, Fortnite (EAC) and Valorant (Vanguard) processes from a SYSTEM service? Plan a
   spike to prove it early, and a fallback (for example IFEO launch interception) if not.
3. How is the PC woken for a removal (spec section 10, step 3)? There's no push channel for Windows in the spec.
4. Brute-forcing "Remove with a code": what attempt limit and lockout?
5. A PC that reboots offline loses the clock offset. How do you stop an offline clock change from granting time?
```

---

## Notes for the owner

- **Before pasting:** have a Windows 11 VM ready (Hyper-V works on Pro, not on Home; VirtualBox or VMware on Home).
  Phases 4 and 6 need it.
- **Review between phases.** The prompt stops after each one. Check its "Done when", commit, then say "continue to
  phase N".
- **The open questions** at the end are gaps in the spec. They're tracked, with suggestions, in
  [desktop-agent-open-questions.md](desktop-agent-open-questions.md). Settle them, add the answers to the spec, and
  mark them Settled there so the next session doesn't ask again.
