# Desktop agent: product and technical spec

The spec for **eGuard for Windows**, the child agent on a child's PC. It controls installed apps and games such as
Counter-Strike 2, Roblox and Minecraft: it blocks them, limits them and counts their time. It reports what's
installed, and it can't be uninstalled by the child. This spec covers how it enforces the parent's rules and exactly how it talks to the
device API (`/api/device/v1`), which it shares with the phone apps.

**Status:**
- Written 2026-10-23.
- The **server side is built**: schema, pairing, sync, scan events, the signed catalog, tamper alerts and removal. See [Server status](#13-server-status).
- The agent itself (repo `C:\Users\corew\eguard-desktop`, Rust) is **not built yet**.
- A Mac agent comes later. `MACOS` is in the schema and capability tables, but pairing accepts only `WINDOWS` for now.

**Related:**
- [child-app-spec.md](child-app-spec.md): the phone app. Sync, report and events work the same way; this spec only adds what differs.
- [mobile-api.md › Part C](mobile-api.md#part-c-child-device-api): every device endpoint and field.
- [browser-extension-api.md](browser-extension-api.md): web filtering on the PC is the extension.

## Contents

1. [What it is](#1-what-it-is)
2. [Principles](#2-principles)
3. [Architecture on Windows](#3-architecture-on-windows)
4. [Pairing](#4-pairing)
5. [Scanning installed apps](#5-scanning-installed-apps)
6. [Identifying apps](#6-identifying-apps)
7. [Enforcement](#7-enforcement)
8. [Time](#8-time)
9. [Web](#9-web)
10. [Can't be uninstalled](#10-cant-be-uninstalled)
11. [Tamper events and health](#11-tamper-events-and-health)
12. [Wire reference (what's new for computers)](#12-wire-reference-whats-new-for-computers)
13. [Server status](#13-server-status)
14. [Acceptance tests](#14-acceptance-tests)
15. [Needs the owner](#15-needs-the-owner)

---

## 1. What it is

To eGuard, a PC is one more device of one child: `platform: WINDOWS` and `kind: COMPUTER`. It takes a device slot,
shows on the Devices page and in health, gets the offline alert, and can be moved to another child. It also follows
the same rules the parent already sets for the child's phone:
- App approval and blocking
- Per-app limits and category limits (a "Gaming time" limit covers CS2, Roblox and Minecraft together)
- Daily screen time, bedtime and extra time

Usage lands in the same Apps tab and reports.

On a family PC the parent's own Windows account stays theirs: eGuard applies the child's rules only in the accounts
the parent picks when pairing (section 4). The others aren't limited or counted.

## 2. Principles

1. **Never touch a game's process from the inside.** No injection, no hooks, no kernel driver, no reading game memory.
   - Counter-Strike (VAC), Valorant (Vanguard) and Fortnite (Easy Anti-Cheat) ban or crash on tools that do.
   - The agent only watches processes start from the outside, ends them with `TerminateProcess`, and draws its own
     window on top.
   - This keeps it safe with anti-cheat and needs no driver signing.
2. **The child uses a standard Windows account.** Against an administrator account, no user-mode software holds.
   - It's a health check that fails loudly (UNINSTALL_PROTECTION is GUIDED with the steps; see section 11).
   - It's never a silent assumption.
3. **Report less, but report what matters.** Drivers, Office, runtimes and OEM tools are not the parent's business.
   Games and apps from publishers eGuard can't vouch for are (section 5).
4. **Only the parent removes eGuard, from the dashboard.** No local route uninstalls it without eGuard's signed word
   or a parent's code (section 10).
5. **Fail closed.** If eGuard can't be reached, the PC keeps enforcing the last policy it has. A 401, a timeout or a
   deleted token never switches protection off.

## 3. Architecture on Windows

| Part | Runs as | Does |
|---|---|---|
| `eguard-service.exe` | Windows service, LocalSystem, auto-start, restart on failure | Holds the device token, syncs, keeps the policy, watches processes, ends blocked ones, scans apps, writes browser policies |
| `eguard-agent.exe` | In every signed-in session, started by the service (`WTSQueryUserToken` + `CreateProcessAsUser`) | Tracks the foreground window and idle time, shows the block screen, warnings, "Ask for more time" and "Remove with a code" |
| `eguard-guard.exe` | Scheduled task as SYSTEM at boot, plus a watchdog loop | Restarts the service if it stops, and restores missing files from a protected cache |

The parts talk over a named pipe per session whose ACL allows SYSTEM and that session's sign-in. The agent's block
screen, warnings and overlay are plain Win32 windows, so they work even when WebView2 is broken or removed (owner's
decision, 2026-10-23); Tauri can come later for settings screens. The core is Rust and is shared with the Mac agent
later.

**Secrets:** the device token and the removal secret are encrypted with machine-scope DPAPI. They live in
`%ProgramData%\eGuard`, which only SYSTEM can write.

## 4. Pairing

1. The parent chooses **Pair a device** on the dashboard (the same 8-character code as phones, kind DEVICE).
2. On the PC, the installer (per machine, needs an administrator) opens eGuard's window, and the parent types the code.
3. `POST /pair` with `{ code, platform: "WINDOWS", name, model, osVersion, appVersion }`. The server sets
   `kind: COMPUTER`; sending `kind` is optional.
4. Response `201 { deviceId, token, childName, removalSecret }`. **`removalSecret` is sent only once.** Store it
   next to the token; it's the key for offline removal codes (section 10).
5. **Which accounts are the child's.** The parent, still at the PC, picks the Windows accounts eGuard applies the
   child's rules in. Preselected: every standard (non-administrator) account, since a parent's own account is usually
   an administrator. Only those accounts' sessions are enforced and counted; the agent reports the choice in
   `/report` `accounts`, and the device page shows it. A PC paired before this choice existed enforces every account.
   A Windows account added later is not enforced, and raises `TAMPER` `NEW_ACCOUNT` (section 11); an administrator
   adds it to the child's accounts in eGuard on the PC.
6. The agent runs its first full scan and sends `APPS_FOUND` (section 5), then syncs.

A phone can't claim `kind: COMPUTER` (400).

## 5. Scanning installed apps

**When:**
- A full scan runs after pairing, then every 6 hours.
- An incremental scan runs when an Uninstall key changes (`RegNotifyChangeKeyValue`) or a launcher's manifest
  folder changes.

**Where the agent looks:**
- Uninstall keys in HKLM, HKCU and WOW6432Node
- Start Menu shortcuts
- MS Store packages (`PackageManager`)
- Launcher manifests:
  - Steam: `libraryfolders.vdf` → `appmanifest_<id>.acf`
  - Epic: `%ProgramData%\Epic\EpicGamesLauncher\Data\Manifests\*.item`
  - Riot, Battle.net, EA app, Ubisoft Connect, GOG Galaxy and itch
- Exes under `%USERPROFILE%` (Downloads, Desktop, AppData\Local and Roaming), since kids run unpacked games from there

**Each candidate is classified in this order. The first match wins:**

| # | Rule | Reported? | `source` | Category |
|---|---|---|---|---|
| 1 | Matches a **GAME** entry in the catalog (launcher id, exe name, signer or product name) | Always, under the catalog's `displayName` | `CATALOG` | GAMES |
| 2 | Installed through a game launcher, or under a launcher's library folder | Always | `LAUNCHER` | GAMES |
| 3 | Signed (valid Authenticode) by a **TRUSTED_PUBLISHER** in the catalog | **No**, and it's never blocked | – | – |
| 4 | Anything else: unsigned, an untrusted signer, or a signature that doesn't verify | Yes | `UNKNOWN_PUBLISHER` | GAMES when it shows game signals, otherwise OTHER |

- Rule 1 comes before rule 3, so a trusted publisher's game is still reported (Microsoft's Minecraft, Solitaire and Xbox).
- **Game signals:**
  - an engine DLL next to the exe (`UnityPlayer.dll`, `GameAssembly.dll`, `UE4*/UE5*`, `steam_api*.dll`, `EOSSDK*`)
  - an anti-cheat binary (EAC, BattlEye, Vanguard)
  - "game" or "games" in the name
  - DirectX or Vulkan imports

**The catalog:**
- It is served on `GET /catalog`, signed and versioned, and the agent keeps the last good copy.
- The server seeds it from `src/lib/desktop-catalog.ts` with `npx tsx scripts/seed-desktop-catalog.ts`. That covers about 45
  games and launchers (the trending ones flagged) and about 28 trusted publishers.
- A new trending game is a database row, not an agent release.

**What the parent sees:**
- One alert per scan: "Apps found on a computer: eGuard found 3 games on Mia's Gaming PC, 1 from a publisher eGuard can't verify."
- In the Apps tab, rows read "Popular game" or "Unverified publisher".
- With App Approval (or Downloads "parent approval") on, found apps wait for the parent (PENDING, blocked).
  Otherwise they stay allowed until the parent blocks or limits them.
- A new app after the scan is an ordinary `APP_INSTALLED` with `ids` and `source`.

## 6. Identifying apps

Names drift: "Counter-Strike 2" in Steam's manifest is `cs2.exe` in the process list. So every report can carry
`ids`, which are stable identifiers on this platform:

| `kind` | `value` (lower case) | Example |
|---|---|---|
| `STEAM` | appid | `730` |
| `EPIC` | AppName | `fortnite` |
| `RIOT`, `BATTLENET`, `EA`, `UBISOFT`, `GOG` | the launcher's product id | |
| `MSSTORE` | package family name | `microsoft.minecraftuwp_8wekyb3d8bbwe` |
| `EXE` | `<signer>|<product name>`, with the signer empty when unsigned | `roblox corporation|roblox`, `|pixel quest` |

**On the server:**
- The first id seen for a child wins (`AppIdentifier`, unique per child, platform, kind and value).
- When a report arrives under a new name with an id the child's list already has, the server stores it under the
  listed name: `/usage` adds the minutes up, and `APP_INSTALLED` is not news.
- `/sync` returns each app's `ids` to computers. The agent matches a starting process to an app by id first, then by
  name. Renaming `cs2.exe` doesn't help, because its Steam install dir still maps to appid 730.

## 7. Enforcement

When a process starts (WMI `Win32_ProcessStartTrace` or ETW `Microsoft-Windows-Kernel-Process`, with a 2-second
`EnumProcesses` sweep as fallback), the service resolves its app. **It ends the process tree** when the app:
- is BLOCKED or PENDING (FILTERED counts as BLOCKED on a PC),
- is over its own limit or its category's limit, or
- is opened during bedtime, unless extra time is running (bedtime applies to ALWAYS_ALLOWED apps too, as on phones:
  mobile-api C2, child-app-spec section 7), or
- is opened after daily screen time runs out, unless it's ALWAYS_ALLOWED or extra time is running.

The agent then shows the block screen with the reason, an **Ask parent** button (`APP_REQUESTED`) and **Ask for more
time** (`TIME_REQUESTED`, with `reason`). It also sends `APP_BLOCKED` and `LIMIT_REACHED` as phones do.

**Never blocked:**
- Microsoft-signed binaries under `%SystemRoot%`
- eGuard itself
- Accessibility tools
- Anything from a trusted publisher that isn't a catalog game: the exe's own signature, or an exe inside that
  publisher's install folder under Program Files (a folder a standard account can't write to). A folder in the
  child's profile (per-user installs in AppData) never vouches for an exe the publisher didn't sign. Runtimes
  (`java`, `javaw`, `python`, `pythonw`, `py`, `pyw`) are never exempt by their signer: games run inside them.

APP_APPROVAL applies to inventory apps and to any exe outside Program Files that a trusted publisher didn't sign
(unsigned, or signed by a publisher the catalog doesn't trust), never to every exe, so drivers and updaters keep
working. Until the first catalog arrives nothing is trusted, so signed per-user apps (OneDrive, Teams) wait too.

What the child controls (the folder an exe is in, its file name, its product name, an Uninstall entry under HKCU)
may only make the verdict stricter: it can tie an exe to a blocked app (a renamed `cs2.exe` in Steam's folder), never
to an allowed one whose signer it doesn't carry.

## 8. Time

- **Usage is foreground time with input in the last 2 minutes** (`GetLastInputInfo`). A game left downloading
  doesn't count; one in focus does.
- It is sent through `/usage` per day: the total, each app with its `ids`, and `hourly[24]`.
- The agent warns at 5 minutes and at 1 minute left.
- When daily screen time is up, a full-screen overlay leaves only ALWAYS_ALLOWED apps usable (those not paused by
  their own limit); it lists them with a button each to switch to or start one, since it hides the taskbar. At
  bedtime the overlay covers everything, ALWAYS_ALLOWED apps included. If the overlay keeps getting killed,
  `LockWorkStation` is the backstop.
- **Days and bedtime follow eGuard's clock.**
  - `/sync` returns `serverTime`, and the agent keeps the offset from its own clock.
  - Weekends, school nights and bedtime windows follow `timezone`, with the rules in child-app-spec.md section 6.
  - Changing the PC's clock gains nothing and sends `TAMPER` `CLOCK_CHANGED`.
- **Offline:** the policy is cached, and usage and events are queued and sent when the PC is back (with `eventId`, as
  phones do).

## 9. Web

- **Chrome and Edge:** the service writes the HKLM `ExtensionInstallForcelist` policy, so the eGuard extension is
  installed and can't be removed.
- **Firefox:** the extension is forced through `policies.json`.
- The parent pairs the extension once with a browser code (WEB is GUIDED with those steps).
- **Browsers on the PC take no device slot.** Every `/sync` returns `browserLink: { value, expiresAt }` (30 days).
  The agent writes `value` into the extension's managed policy as `deviceLink` (HKLM
  `Software\Policies\Google\Chrome\3rdparty\extensions\<id>\policy`, the Edge equivalent, and Firefox's
  `3rdparty` policy) on every sync. The extension sends it on `/browser/v1/pair`, and the browser is then part of the
  PC: no slot of its own, it moves with the PC and it's removed with it (`src/lib/browser-link.ts`,
  browser-extension-api.md › `POST /pair`).
- Browsers the extension can't run in (Opera GX, Tor and unknown Chromium forks) are category BROWSERS and are blocked
  until the parent allows them.

## 10. Can't be uninstalled

**Only a parent removes eGuard, from the dashboard.**

**The removal flow:**
1. The parent removes the PC on the device page, with their password.
2. The device isn't deleted yet. It gets `removalRequestedAt`, the parent sees "Removing" with an offline code, and
   the family gets "Removing a computer".
3. The PC syncs every minute (`nextSyncSeconds` is 60 for computers, which have no push), and `/sync` now returns
   `uninstall: { command, signature, keyId }`.
   - The command is `{ type: "eguard.device.uninstall", deviceId, requestedAt, at }`.
   - It is signed with ECDSA P-256 / SHA-256 over the canonical JSON, the same key and scheme as the browser policy.
   - The public key is built into the agent.
4. The agent verifies the signature and checks that `deviceId` is its own. Then it removes itself (browser policies,
   the guard task, the service and its files) and sends **`UNINSTALL_ACK`**.
5. The server deletes the device ("Device removed: Gaming PC confirmed it uninstalled eGuard"). It keeps or deletes
   history as the parent chose.

**Other ways out, all from the parent:**
- **Keep this computer** cancels a waiting removal (web, or `POST /mobile/v1/devices/{id}/keep`).
- **Offline removal code** (the PC can't reach eGuard). It is shown on the device page while a removal waits.
  - The parent picks "Remove with a code" in the agent and types it.
  - The code is the first 8 bytes of `HMAC-SHA256(removalSecret, "eguard.device.remove:<deviceId>:<window>")`. Each
    byte is mapped to `ABCDEFGHJKLMNPQRSTUVWXYZ23456789[byte % 32]`, and `window = floor(unix ms / 900000)`.
  - The agent accepts the current window and the one before, so a code works for 15 to 30 minutes.
  - When it's back online it sends `UNINSTALL_ACK` with `code`. The server deletes the device only while a removal
    waits. A valid code with no removal waiting (the parent chose "Keep this computer" after seeing it) gets 409 and
    raises "A removal code was used after you kept the computer" (Action required), since the PC may have removed
    eGuard already. Online, the agent sends the ack before removing itself and stops on 409.
  - Wrong codes: 5 in a row lock the input for 15 minutes, doubling with each lockout up to 24 hours, kept across
    restarts. Each lockout sends `TAMPER` `REMOVAL_CODE_GUESSED`.
  - **Test vector:** a secret of 32 bytes of `0x07` (base64url `BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc`),
    deviceId `dev_123` and window 0 give `XEM54CNL`.
- **Remove without waiting** (the PC is lost or was reset). The device is deleted now. The agent on that PC keeps
  its last policy until the code is typed into it, so the parent should type the code in first if they can.

**Every local route is blocked:**

| Route | Blocked by |
|---|---|
| Settings → Apps → Uninstall | ARP entry with `NoRemove=1`, `NoModify=1` (MSI `ARPNOREMOVE`). The visible "Uninstall" opens eGuard's "Ask your parent" window |
| `msiexec /x` | A custom action that aborts unless a verified command or code is in the service's state; sends `TAMPER` `UNINSTALL_BLOCKED` |
| `sc stop` / `sc delete`, Services, Task Manager on the service | Service DACL denies `SERVICE_STOP`, `DELETE`, `WRITE_DAC` and `CHANGE_CONFIG` to Everyone, **Administrators included**. Only SYSTEM can change it, and the service does so itself during an authorized uninstall. Sends `SERVICE_STOP_DENIED` |
| Killing `eguard-agent.exe` | The service starts it again within seconds; `AGENT_RESTARTED` |
| Deleting or replacing files | SYSTEM-only write ACLs, running binaries held open, and the guard restoring from cache; `FILES_CHANGED` |
| Safe Mode | Service registered under `SafeBoot\Minimal` and `SafeBoot\Network`; `SAFE_MODE` |

**Limits, stated plainly:** a child with an **administrator** account, or one who reinstalls Windows, can always
defeat user-mode software in the end. That is why the standard account is a health check, every attempt alerts the
parent while it happens, and a reinstall shows up as the offline alert after a day.

## 11. Tamper events and health

`POST /events` with `{ type: "TAMPER", kind }`. Each kind raises one alert per hour per computer:

| `kind` | Alert | Severity |
|---|---|---|
| `UNINSTALL_BLOCKED` | Someone tried to uninstall eGuard | Action required |
| `SERVICE_STOP_DENIED` | Someone tried to stop eGuard | Action required |
| `FILES_CHANGED` | eGuard's files were changed | Action required |
| `ADMIN_ACCOUNT` | Your child's account is an administrator | Action required |
| `SAFE_MODE` | The computer was started in Safe Mode | Action required |
| `REMOVAL_CODE_GUESSED` | Someone is guessing eGuard's removal code | Action required |
| `NEW_ACCOUNT` | A new account was added to the computer | Attention |
| `AGENT_RESTARTED` | eGuard was closed and started again | Attention |
| `CLOCK_CHANGED` | The computer's clock was changed | Attention |

**Reports and capabilities** (`/report`, as phones; the capabilities are in `src/lib/protections.ts`):
- **AVAILABLE:** SCREEN_TIME, BEDTIME, APP_APPROVAL, DOWNLOADS.
- **GUIDED:**
  - UNINSTALL_PROTECTION: report `enabled: true` only while the child's account is standard and the service is
    locked.
  - WEB: report the policy's config once the extension is forced in every browser.
- **UNSUPPORTED:** APP_RESTRICTIONS and CONTENT (PC apps carry no rating eGuard can read), LOCATION, NOTIFICATIONS.

## 12. Wire reference (what's new for computers)

Everything in mobile-api.md Part C applies. Added, all optional for phones:

| Endpoint | Added |
|---|---|
| `POST /pair` | `platform: "WINDOWS"`, `kind: "COMPUTER"` (optional). Response adds `removalSecret` |
| `POST /sync` (computers) | Each `apps[]` entry adds `ids: [{ kind, value }]`. Also `serverTime`, `uninstall` (`null`, or the signed command) and `browserLink` (`{ value, expiresAt }`, `null` while a removal waits; section 9). `nextSyncSeconds` is always 60 for computers |
| `POST /report` | `accounts: [{ name, enforced }]` (up to 32): the Windows accounts and whether the child's rules apply in each (section 4). Stored on the device for computers |
| `POST /usage` | `apps[].ids` |
| `POST /events` `APP_INSTALLED` | `ids`, `source` (`CATALOG`, `LAUNCHER`, `UNKNOWN_PUBLISHER`), `category` |
| `POST /events` `APPS_FOUND` | `{ apps: [{ app, ids?, source?, category? }] }`, 1–200 apps |
| `POST /events` `TAMPER` | `{ kind }` (section 11) |
| `POST /events` `UNINSTALL_ACK` | `{ code? }`. 409 when no removal waits; with a valid code it also raises an alert (section 10) |
| `GET /catalog?since=<version>` | `{ catalog: { type: "eguard.desktop.catalog", version, issuedAt, entries: [{ kind, matchType, match, displayName, category, trending }] }, signature, keyId }`, or `{ version, unchanged: true }`. `version` is a 16-character hash of the entries, so a removed entry changes it too: compare it as a string. `issuedAt` (ms, signed) says when it was served: refuse a catalog issued before the one you keep, or one without it once yours has it (a replayed older catalog). `503` when signing isn't configured (keep the copy you have). 30 requests an hour |

On the parent side:
- `DELETE /mobile/v1/devices/{id}` returns `pending: true` for a computer and takes `now: true`.
- Add `POST /mobile/v1/devices/{id}/keep`.
- `GET /devices/{id}` adds `removalRequestedAt`, `removalCode: { code, expiresAt }` and `accounts` (computers;
  `null` until the agent reports them).

## 13. Server status

**Built in this repo (2026-10-23):**
- Migration `20261023090000_desktop_agent`
- `src/lib/app-identity.ts`, `src/lib/device-removal.ts`, `src/lib/desktop-catalog.ts`
- `scripts/seed-desktop-catalog.ts`, also run by `prisma/seed.ts`
- The routes above
- Device page "Removing" banner with the code, "Keep this computer" and "Remove without waiting"
- "Popular game" and "Unverified publisher" in the Apps tab
- The Windows row in Settings › Integrations
- Later the same day (the owner's decisions after the agent's Phase 4): computers sync every 60 s, removal codes need
  a waiting removal, `REMOVAL_CODE_GUESSED` and `NEW_ACCOUNT`, `/report` `accounts` (migration
  `20261023180000_computer_accounts`), computer wording for found apps and protections not applied yet, and four more
  trusted publishers (Epson, LG, Intel's Store name, Zoom's newer name)

**Tests:**
- `tests/api/desktop-agent.test.ts`: 16 tests covering pairing, the scan, id merging, approval, the signed catalog, tamper and all three
  removal routes
- `src/lib/test/device-removal.test.ts`
- Additions to `devices.test.ts` and `family.test.ts`

**Not built yet:**
- The agent and its installer.
- Code signing.
- A `/download/windows` page. The marketing site still names only phones; it should stay that way until the agent ships.

## 14. Acceptance tests

Run on a Windows 11 VM with a standard child account.

1. Pair with a dashboard code. The device shows as a computer with Windows capabilities.
2. Install Office, Chrome, NVIDIA drivers, Steam with CS2, Roblox, and an unsigned itch.io game in Downloads.
   - Only CS2, Roblox and the itch.io game reach the Apps tab.
   - The itch.io game is flagged "Unverified publisher".
   - There is one alert.
3. Block CS2 and launch it from Steam. It ends within 2 seconds, the block screen shows, and "Ask parent" reaches the dashboard.
4. Rename `cs2.exe` and launch it. It is still blocked (Steam appid).
5. Set Gaming time to 1 minute and play Roblox. The 1-minute warning shows, then the block, then "Gaming time used up".
6. Move the clock forward an hour. No time is gained, and a CLOCK_CHANGED alert appears.
7. Kill `eguard-agent.exe`. It comes back, and an AGENT_RESTARTED alert appears.
8. As the child **and as a local admin**, try each of these. Every one fails and alerts:
   - Settings uninstall
   - `msiexec /x`
   - `sc stop` and `sc delete`
   - Deleting the install folder
   - Safe Mode
9. Remove the PC on the dashboard. The agent uninstalls itself within a minute and the device disappears.
10. Pair again, go offline, remove it on the dashboard, and type the code on the PC. eGuard uninstalls itself.

## 15. Needs the owner

- **A code-signing certificate:** an OV certificate with cloud signing. The checklist is in [code-signing.md](code-signing.md). Without it, SmartScreen warns on every install,
  and Defender may flag a service that ends processes.
- **A Windows test PC or VM** with Steam and CS2 for section 14.
