# Staff console (console.eguard.family)

The eGuard team's back-office: look up a family, read and close support tickets, see organizations and their
sponsor codes, and see what other staff did. It runs in the same Next.js app as the site, on its own subdomain,
with its own sign-in.

**Status:** v1 built, 2026-10-07 (migration `20261007120000_staff_console`, `src/lib/staff-auth.ts`,
`src/lib/console-queries.ts`, pages in `src/app/console/`, tests `src/lib/test/staff-auth.test.ts` and
`src/lib/test/console-host.test.ts`).

## Contents

1. [The privacy rule](#1-the-privacy-rule)
2. [How the subdomain works](#2-how-the-subdomain-works)
3. [Staff accounts and signing in](#3-staff-accounts-and-signing-in)
4. [Pages](#4-pages)
5. [Audit log](#5-audit-log)
6. [Setup](#6-setup)
7. [Not in v1](#7-not-in-v1)

---

## 1. The privacy rule

Staff see **accounts**, not **children's activity**. The console shows:

- plans and purchases
- parents (email, verified, how they sign in, whether two-step is on, last active)
- how many children, devices and browsers a family has
- support tickets
- organizations

It never shows a child's location, places visited, browsing, app use, screen time, alerts or photos. Those stay
between the family and its devices, as the privacy policy promises. New console pages must keep to this. Queries
live in `src/lib/console-queries.ts`, so the rule can be checked in one file.

## 2. How the subdomain works

The console pages are real routes under `src/app/console/`, but `/console` is never a public URL. `src/proxy.ts`
decides by the request's Host:

| Host | Request | Result |
| --- | --- | --- |
| console.eguard.family | `/families` | rewritten to `/console/families` |
| console.eguard.family | anything, no staff cookie (except `/login`, `/robots.txt`) | 307 to `/login` |
| console.eguard.family | `/dashboard`, `/api/…` (any site page or API) | the console's 404: the rewrite finds no console page |
| www.eguard.family (any other host) | `/console…` | the site's 404 |

So links and redirects inside the console use the visible paths (`/families`, `redirect("/login")`), never `/console/…`.
The proxy now runs on every request except Next's own files and public images. Off the console host it only
compares the host and the path.

Hosts that count as the console (`src/lib/console-host.ts`):
- `console.eguard.family`
- `console.localhost:<port>` in development
- `CONSOLE_HOST` when set (a preview deployment's own console host)

The console host also gets `X-Robots-Tag: noindex, nofollow`, a robots.txt that disallows everything, and
`noindex` metadata.

## 3. Staff accounts and signing in

Staff are **not** eGuard users. They live in their own tables, so a parent account can never open the console:

| Table | What it holds |
| --- | --- |
| `StaffUser` | email, name, password hash, sealed authenticator secret, active |
| `StaffSession` | one row per signed-in browser; only the token's SHA-256 is stored |
| `StaffAuditLog` | see [section 5](#5-audit-log) |

**There is no sign-up page.** `scripts/create-staff.ts` creates and resets accounts:

```
npx tsx scripts/create-staff.ts ana@eguard.family "Ana Reyes"   # create, or reset password and authenticator
npx tsx scripts/create-staff.ts ana@eguard.family --deactivate   # can't sign in; signed out everywhere
```

The script prints a generated password and an authenticator QR code, once. It reads `DATABASE_URL` and
`TWO_FACTOR_KEY` from the environment (or `.env`). `TWO_FACTOR_KEY` must match the server's. If it's unset, the
script uses the development key and warns, and those codes only work locally.

**Signing in** takes email, password and authenticator code in one form. The authenticator code is always required.
- A wrong value never says which field was wrong.
- A code works once (compare-and-swap on the 30-second step).
- Failures are rate limited at 5 per email and 20 per address per 15 minutes (`LIMITS.staffLogin*`).
- An email with no account still checks a decoy password, so it takes the same time.
- Without `TWO_FACTOR_KEY` in production, nobody can sign in: the server fails closed.

**Sessions:**
- The cookie is `__Host-eg_staff`: Secure, path `/`, no Domain, so it's sent only to console.eguard.family. Parents'
  `eg_session` stays on www, and neither cookie reaches the other host. In development the cookie is plain
  `eg_staff`.
- It's `httpOnly` and `SameSite=Lax`, so a console link opened from chat still arrives signed in. Changes go
  through server actions, which Next checks against the request's Origin.
- A session ends 12 hours after sign-in, or after 30 minutes idle. The maintenance job removes ended sessions'
  rows.
- Deactivating an account ends its sessions.
- Every console server action (`src/app/actions/console.ts`) first checks it was sent to the console host.

## 4. Pages

| Path | What it shows |
| --- | --- |
| `/` | Totals: families (and new in 7 and 30 days), parents, children, devices, browsers, open tickets, organizations. Families by plan. |
| `/families` | Search by parent email or name, family name or id. Newest first, 50 per page. |
| `/families/[id]` | Account, parents, purchases, support tickets, organizations joined and sponsor codes redeemed. The plan says "renews" or "ends" as the parent's Settings does, and device slots count phones, tablets and connected browsers, as pairing does. |
| `/tickets` | Support tickets, filtered by Open, Closed or All. |
| `/tickets/[id]` | The message, who sent it, and a Close/Reopen button. Replies still go out from the support inbox, where tickets are forwarded with Reply-To set to the parent. |
| `/organizations` | Organizations with counts of admins, families and code batches. |
| `/organizations/[id]` | Admins, join code, and code batches with how many codes were redeemed. |
| `/audit` | The staff audit log. |

A page or action that fails shows the console's own error panel (`(signed-in)/error.tsx`), with the bar and nav
kept.

Links to detail pages use `prefetch={false}`. Opening one writes an audit entry, so a hover must not count as a
view.

## 5. Audit log

`StaffAuditLog` records each of these with who did it and when:
- `staff.login`
- opening a family, ticket or organization (`family.view`, `ticket.view`, `organization.view`)
- searching families (`family.search`, with the search text as the detail; paging through results logs each page)
- each change (`ticket.status`, with "OPEN → CLOSED" as the detail)

The audit log is read-only in the console.

## 6. Setup

**Production (once):**
1. Vercel → Project → Domains: add `console.eguard.family`.
2. DNS: add a CNAME `console` → `cname.vercel-dns.com`. HSTS (`includeSubDomains`) already covers it.
3. `npm run db:deploy` (applies `20261007120000_staff_console`).
4. Create the first staff account against the production database, with production's `TWO_FACTOR_KEY` set.

**Development:**
1. `npm run db:up`, then `npm run db:migrate`.
2. `npx tsx scripts/create-staff.ts you@example.com "Your Name"`.
3. `npm run dev`, then open http://console.localhost:3000. Chrome and Firefox resolve `*.localhost` to your machine.
   `allowedDevOrigins` in `next.config.ts` lets that host use the dev server.

## 7. Not in v1

- Changing a family's plan, issuing refunds, or deleting accounts from the console.
- Replying to tickets from the console.
- Staff roles (everyone sees everything above).
- Staff changing their own password in the console (use the script to reset).
