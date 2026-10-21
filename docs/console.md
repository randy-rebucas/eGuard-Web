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
8. [Email broadcasts](#8-email-broadcasts)

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
  `__Host-eg_session` stays on www, and neither cookie reaches the other host. In development the cookies are plain
  `eg_staff` and `eg_session`.
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
| `/tickets` | Support tickets, filtered by Open, Closed or All. Parents file them from the app's Contact Support or the web's Settings › Support (both through `createTicket` in `src/lib/support.ts`), and see each one's Open/Closed status there. |
| `/tickets/[id]` | The message, who sent it, and a Close/Reopen button. Replies still go out from the support inbox, where tickets are forwarded with Reply-To set to the parent. |
| `/organizations` | Organizations with counts of admins, families and code batches. |
| `/organizations/[id]` | Admins, join code, and code batches with how many codes were redeemed. |
| `/broadcasts` | Emails to many parents: drafts, scheduled, sending and sent, with how many went out. See [section 8](#8-email-broadcasts). |
| `/broadcasts/new`, `/broadcasts/[id]` | Write an email; preview it, send yourself a test, send it now or schedule it; stop it; see failures. |
| `/care` | Parent care engagement: weekly active families, 7- and 30-day retention and reactivation (treatment vs holdout), activities, messages by channel. See [docs/features/parent-care.md](features/parent-care.md). |
| `/care/automations`, `/care/automations/[key]` | The five automations: status, version, channels, counts, conversion, why jobs were skipped, template preview. Pause or resume (with confirmation; pausing cancels pending jobs). |
| `/care/delivery` | The job queue, reliability, provider errors, duplicate guards, failed and retrying jobs; retry one, or all from the last 7 days (with confirmation). |
| `/care/trust` | Consent and preference counts, opt-outs and suppressions, channel readiness, contact limits, template approval, staff changes (`care.*` audit entries). |
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
- email broadcasts: `broadcast.create`, `broadcast.edit`, `broadcast.test`, `broadcast.send` / `broadcast.schedule`
  (with the kind, plans and how many parents), `broadcast.unschedule`, `broadcast.cancel`, `broadcast.delete`, `broadcast.ai_draft` (with the start of the brief), and
  opening one (`broadcast.view`)

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
- Email broadcasts by other criteria than plan (signed up between dates, organization, has a device), images or
  rich formatting in them, and automatic lifecycle emails (welcome series, win-back).
- Staff roles (everyone sees everything above).
- Staff changing their own password in the console (use the script to reset).

## 8. Email broadcasts

**Status:** built 2026-10-12 (migration `20261012111731_broadcasts`, `src/lib/broadcasts.ts`, pages in
`src/app/console/(signed-in)/broadcasts/`, forms in `src/app/console/broadcast-forms.tsx`, unsubscribe at
`src/app/unsubscribe/` and `src/app/api/email/unsubscribe/`, tests `src/lib/test/broadcasts.test.ts` and
`src/app/actions/console-broadcasts.test.ts`).

One email to many parents at once, from **Email** in the console.

### Two kinds

| Kind | For | Goes to | Unsubscribe |
| --- | --- | --- | --- |
| Product update | New features, news | Verified parents with **Product updates** on (Settings › Notifications, on by default; `productUpdates` in the mobile API) | Link in the footer, plus `List-Unsubscribe` / `List-Unsubscribe-Post` headers so Gmail and others show their own one-click button |
| Service notice | Terms or privacy changes, security notices, outages | Every verified parent, whatever their settings | None: it isn't marketing. Don't use it for news. |

Either can be narrowed to some plans (none ticked: every plan). Unverified addresses never get one.

### Mailing lists (added 2026-10-17)

**To** picks the audience: parents (above), or one of the public mailing lists people join without an account
(`src/lib/subscribers.ts`, migration `20261017041612_subscribers`):

| List | Joined from | Promise made on the form |
| --- | --- | --- |
| eGuard news (`NEWSLETTER`) | The form in every public page's footer | Occasional news, about once a month at most |
| iPhone launch (`IOS_LAUNCH`) | `/iphone`, linked from every "iPhone coming soon" | One email when the iPhone app is out, and a few about setting it up |

- **Double opt-in.** The form (`src/components/subscribe-form.tsx`, action `src/app/actions/subscribe.ts`) stores
  the address unconfirmed and emails a link to `/subscribe/confirm`, which confirms only when its button is pressed
  (mail scanners open links). Links work for 7 days; unconfirmed sign-ups are deleted by maintenance › data
  retention after 7 days. Only **confirmed** subscribers are on a list's recipient list.
- **Nothing leaks.** The form says the same thing whether or not the address was already on a list. Rate limits:
  10 sign-ups an hour per IP (`subscribeIp`), 3 confirmation emails a day per address (`subscribeMail`), plus
  reCAPTCHA v3 (action `subscribe`) when the keys are set, loaded only when someone presses the button.
- **Always a product update.** A list email can't be a service notice and has no plans. It starts "Hi," (no name)
  and its footer says why they got it.
- **Unsubscribing deletes the address**, from every list: the footer link (`/unsubscribe`, button) and the
  one-click header (`/api/email/unsubscribe`) both work as for parents. Pressing again says the same.
- The Email page shows each list's confirmed and waiting counts. A broadcast's page shows **Would reach N
  subscribers**.
- The Privacy Policy covers this under **Mailing lists** (`/privacy#mailing-lists`).

### Manual and scheduled

1. **New email** saves a draft (subject, plain-text message, kind, plans). A blank line starts a paragraph, links
   become clickable, and "Hi <first name>," and the footer are added. The page shows a preview and how many parents
   it would reach now.
2. **Send me a test** sends one copy, subject marked `[Test]`, to the signed-in staff member.
3. **Send to N parents** (now) or **Schedule** (a date and time, Philippine time), after ticking the confirmation.
   Only a draft can be edited, sent or deleted. A scheduled email can go **Back to draft**, or be cancelled.

Either way the maintenance job (`/api/cron/maintenance`, every 10 minutes) does the sending, step "broadcast
emails". "Send now" also starts the first batch straight after the click.

### Write with AI

The editor has a **Write with AI** box (`src/lib/broadcast-ai.ts`). Staff describe what the email should tell
parents, press **Draft with AI**, and the AI (Claude or OpenAI) fills the subject and message. With a message already written, the box
is read as what to change ("shorter", "in Filipino", "add that it's free for Pro"). It only fills the form: nothing
is saved or sent until staff save the draft, and the test, preview and confirmation steps stay the same.

- **Provider:** whichever key is set. With both, Claude, unless `AI_PROVIDER="openai"`. `AI_PROVIDER` naming a
  provider whose key isn't set turns the box off rather than quietly using the other one. Both get the same
  instructions and return the same structured reply (subject and body).
  - **Claude:** Claude Opus 5.5 (`claude-opus-5-5`) through the Anthropic SDK, effort `medium`. If a safety check
    declines, the API's own fallback (`fallbacks: "default"`) retries on another model in the same call.
  - **OpenAI:** the Responses API through the OpenAI SDK, model `gpt-5.5` or `OPENAI_MODEL`, with `store: false`.
  - A refusal from either is shown as "The AI wouldn't write this one".
- **What it's told:** what eGuard is, that the greeting, sign-off and footer are added for it, plain text only, the
  kind (a service notice gets no marketing), the plans it goes to, and never to invent features, prices, dates or
  links. A fact it needs and wasn't given comes back as `[TODO: …]`, and **an email with a `[TODO` in it can't be
  sent or scheduled** until staff fill it in.
- **Privacy:** only what staff type (the brief and the current subject and message) goes to the provider. No parent's
  name, address or data does.
- **Cost and limits:** each draft is one paid API request, a few cents at most. Each staff member gets 30 an hour
  (`LIMITS.aiDraftStaff`). Each draft is in the audit log as `broadcast.ai_draft`, with the provider and the start of
  the brief.
- **Setup:** set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` on the server (optionally `AI_PROVIDER`, `OPENAI_MODEL`).
  Without one the box is replaced by a note saying so.

### How sending works

- When a broadcast is due, one run claims it (SCHEDULED → SENDING) and takes its recipient list, in one
  transaction: a `BroadcastDelivery` row per parent. The list doesn't change after that.
- Each run then sends up to **100 emails** (`BATCH_SIZE`), stopping early after 90 seconds, with 550 ms between
  emails in production to stay under Resend's default rate limit. That's about **600 an hour**, so 5,000 parents
  take about 8½ hours. Raise `BATCH_SIZE` (and lower the gap) once Resend's limit is raised.
- Each email is claimed (PENDING → SENDING) before it's sent, and only while its broadcast is still SENDING, so two
  overlapping runs never send one twice and **Stop sending** takes effect at once.
- At their turn a parent is checked again and **skipped** if they unsubscribed, deleted their account, changed or
  unverified their address since the list was taken.
- A failed email is recorded with Resend's reason and not retried. One claimed but never finished (the run died) is
  marked failed after 15 minutes. When nobody is left waiting, the broadcast is SENT.
- The broadcast's page shows sent, waiting, failed and skipped counts, and the latest 50 failed or skipped addresses
  with why.

### Unsubscribing

Each delivery has its own random token. The email's footer link opens `/unsubscribe?t=…`, which changes nothing
until the parent presses **Unsubscribe** (link scanners open links). Mail apps' own button POSTs to
`/api/email/unsubscribe?t=…` (RFC 8058); a GET there does nothing. Both turn `productUpdates` off, are rate limited
like the other emailed links, and are refused for a service notice's token. A parent can turn product updates back
on in Settings. Deleting a draft is the only delete, so sent emails' links keep working.

### Setup

`npm run db:deploy` applies the migration. It uses the existing mail settings, `APP_URL` for links, and the
maintenance cron. `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` turns on Write with AI.
