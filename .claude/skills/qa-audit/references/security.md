# Security audit checklist (eGuard)

Run this for every area, alongside the QA checklist. eGuard holds children's location, app use and browsing, so a leak
across families is the worst bug it can have. Every security finding is **P1** unless it truly can't be reached.

For each item, find the code that enforces it. "The UI hides the button" is not enforcement: server actions and API
routes are public endpoints that anyone can call with any arguments.

## Who is calling

- **Every entry point checks the caller first.** Server actions: `requireUser()` / `requireAdmin()` (`src/lib/auth.ts`)
  before any read or write. Parent API: wrapped in `authed` (`src/lib/mobile-api.ts`), never `open` unless it's meant to
  be public. Device API: `authDevice`. Browser extension and org API: their own token checks. Cron: `CRON_SECRET` with
  `timingSafeEqual`. Webhooks: `verifyWebhookSignature` on the raw body before parsing.
- **Admin-only rules live in the service**, not only in the page or one caller: `requireAdminActor` /
  `requireAdminUser`. Check the web action and the mobile route both reach it.
- **Role and plan can't be set by the caller**: no `role`, `familyId`, `plan`, `deviceLimit`, `emailVerifiedAt` or
  `passwordSet` in any schema a parent can send. Zod objects strip unknown keys; `.passthrough()` or spreading raw
  form data into Prisma `data` is a mass-assignment bug.
- **Re-authentication for account takeover paths**: changing email or password, turning off two-step, deleting the
  account or a child's data need `confirmPassword` / `confirmDestructive` (or a TOTP code), not just a session.
- **Sessions**: changing the password signs out other sessions; removing a parent deletes their sessions; a deleted
  or removed user's token stops working at once (test it).

## Whose data

- **Every ID from a URL, form, body or query is scoped to the caller's family** in the same query
  (`where: { id, familyId: u.familyId }` or through `child: { familyId }`), not fetched first and compared after
  (easy to forget on one path). This includes IDs nested in bodies (`placeId`, `deviceId`, `appId`, `childId` inside a
  config), cursors, and IDs in `revalidatePath` targets.
- **Test it for real**: make a second fixture family (`qa.mts fixture`), take an ID from it, and call every changed
  endpoint and action with the first family's session. Expect 404 (not 403, which confirms the ID exists).
- **Org boundaries**: organizations see counts only, never a family's name, children or members. Org API keys are
  scoped to one org and their `access` level.
- **Children never get parent data**: device and extension endpoints return only that child's policy.

## What goes out

- **Responses `select` fields explicitly.** Never return a whole `user` row (passwordHash, totpSecret), device
  `tokenHash`, purchase tokens, `paymongoCustomerId`, or API key hashes. Grep the area's routes for `findUnique` /
  `findMany` returned straight into `NextResponse.json`.
- **Errors don't leak**: a 500 never carries a stack or Prisma message to the client; `ServiceError` messages are
  written for parents. Unknown and someone-else's IDs give the same 404.
- **No account enumeration**: sign-up, forgot-password, invitations and email change answer the same way whether
  the email exists or not, unless the product decided otherwise (say which).
- **Logs** never contain passwords, tokens, TOTP secrets, full card or wallet details, or session cookies.
- **Client bundles**: a `"use client"` file never imports `db`, `server-only` modules or `process.env` secrets
  (only `NEXT_PUBLIC_*`). Server action return values are sent to the browser: return only what the UI needs.

## Untrusted input

- **Validation** (zod) on type, enum, length and range for every field, including arrays (cap their length) and
  strings that end up in emails, alerts and other parents' screens.
- **XSS**: `dangerouslySetInnerHTML` only on content we generate (QR SVG, our own Markdown); `href`/`src` built from
  user or device data must be `https:` (block `javascript:`); emails use `escapeHtml` for every interpolated value.
- **Open redirects**: any `next`/`returnTo`/`redirect` value goes through `safeNext` (`src/lib/return-to.ts`).
- **SQL injection**: `$queryRaw` tagged templates are safe; `$queryRawUnsafe` / `$executeRawUnsafe` must only
  interpolate constants, never request data.
- **SSRF**: the server never fetches a URL taken from a request. Fixed hosts only (PayMongo, Google, FCM, tiles
  proxy with validated `z/x/y` integers).
- **Uploads** (child photos): check size before reading the whole body, check the real type (magic bytes, not the
  name or `Content-Type`), re-encode or serve with a fixed type and `nosniff`.
- **Device and extension reports** are attacker-controlled if a device is rooted: validate shape and size, never
  trust them for plan or permission decisions.

## Abuse

- **Rate limits** (`enforce` with `LIMITS`, `src/lib/rate-limit.ts`) on sign-in, sign-up, code entry (pairing,
  sponsor codes, TOTP, recovery codes), invitations, password reset and anything that sends email or SMS. Check the
  key: per IP and per account, so one attacker can't lock out a parent and one IP can't try every account.
- **Codes and tokens**: random from `node:crypto`, long enough, single use, expire, stored hashed, compared in
  constant time.
- **Races that bypass limits**: two requests at once can both pass a count check (child limit, device slots,
  single-use codes). Look for a transaction lock or a conditional update.
- **CSRF**: server actions are protected by Next. Cookie-authenticated route handlers that change state must be POST
  (not GET) and rely on the `SameSite=Lax` session cookie; check no state-changing GET exists.

## Platform

- **Headers**: `next.config.ts` sets CSP, `X-Frame-Options`, HSTS. A new page that needs a new origin (script,
  image, frame) must add it to the CSP narrowly, not loosen it to `*`.
- **Secrets** come from env, never committed; `.env` is never printed or copied.
- **Dependencies**: `npm audit --omit=dev` once per audit session; report high and critical issues with the package
  and whether the vulnerable path is reachable.

## Reporting security findings

Write each one as: who can do what to whom (for example "any parent can read another family's child's visits by
changing `childId`"), how you proved it (the request and the response code), and the fix. If you couldn't prove it,
mark it unconfirmed instead of guessing.
