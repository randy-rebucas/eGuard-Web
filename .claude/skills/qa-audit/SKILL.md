---
name: qa-audit
description: Expert QA audit of one feature, route or area of this app (e.g. src/app/(app)/dashboard, src/app/(app)/children/[id], the mobile API), planned first and then fixed, until it's complete, functional and production ready. Use this whenever the user asks to audit, QA, review for production readiness, harden, or "check and fix" a page, feature, folder, flow or API, asks to check that something is "properly wired, functional, completed, error handling, state management, production ready", asks for a security audit, pentest, vulnerability or permissions check of an area, or says "next", "next <path>", "continue the audit" or "proceed" while working through such an audit (references/progress.md says what's done and what's next), even if they don't say "QA". Not for a plain code review of a diff (use code-review) or for pure visual/design polish.
---

# QA audit: plan, then fix

You are acting as an expert QA engineer. The goal for the area the user names is that it is **complete, functional and
production ready**: it shows parents correct information in every state, rejects bad input cleanly, can't leak or lose
data, and works for every plan, role and device situation. A page that renders is not the bar.

Work in two phases, in one turn unless the user says otherwise: **plan** (findings, ranked), then **fix** (and verify).
The user has said "do plan first then fix": show the plan briefly, then go straight into fixing; don't stop to ask for
approval unless a finding needs a decision only they can make.

## 1. Scope the audit

- Read [references/progress.md](references/progress.md) first. If the user named no area, or said "next" / "continue",
  audit the first area there that isn't done, and say which one you picked. Note findings an earlier audit left for
  the user's decision, so you don't re-raise them as new.
- Check `git status` for features that landed since the area was last audited: their new code is where stale copy and
  missing wiring hide.
- Read every file in the target folder, then follow what it depends on: components, server actions, `lib/` services,
  and the API routes that share the same service (web and mobile often both call it). Bugs usually live one layer down
  from the page.
- Read the project instructions (CLAUDE.md / AGENTS.md). In this repo Next.js is a newer version than your training
  data: check `node_modules/next/dist/docs/` before relying on an API (e.g. `error.tsx` gets `retry`, `proxy.ts`
  replaces middleware).
- Project specifics (test setup, dev server, fixtures, known patterns) are in
  [references/eguard.md](references/eguard.md). Read it before verifying anything.
- Run the baseline first (`npx tsc --noEmit`, `npx eslint <paths>`, `npx vitest run`) so you know what was already broken.

## 2. Audit checklist

Go through every item for the area. Each one has produced real bugs here before.

**Security** is part of every audit, not an extra. Work through [references/security.md](references/security.md) for
the area: who is calling, whose data, what goes out, untrusted input, abuse, platform. If the user asks for a security
audit only, do that list in full and the items below only where they overlap.

**Correctness of what's shown**
- Every state: no children, children but no devices, devices offline, unverified email, Free vs paid plan, family admin
  vs other parent, many items (10 children, 20 devices, 200 apps), empty strings and names.
- Copy that claims something false ("verified" while offline, "keeps no history" when history is on, "All healthy"
  with zero devices, "Not set" when a value applies). Read every sentence as the parent would.
- Consistency between pages: the same fact (limits, location state, health) computed one way everywhere. Prefer an
  existing helper (`childLocation`, `limitOn`, `computeHealth`) over re-deriving it.
- Dates and time zones: weekend vs weekday, month boundaries ("Sep 25 – 1"), the family's time zone, values computed
  once at module load (`new Date()` in a schema).
- Hardcoded totals (`/ 10`) that should come from data, and hardcoded plan facts ("Free: 1 child") that should come
  from `entitlementsFor`.
- Copy that went stale when a feature shipped: grep the area for "yet", "coming soon", "isn't sent", and check each
  against the code (a "weekly summary isn't sent yet" line outlived the digest that sends it).

**Wiring**
- Every button and form reaches a server action, the action reaches the service, and `revalidatePath` covers every
  page that shows the changed data.
- Every preference the page saves is actually read somewhere (grep the field). A saved switch nothing reads is either
  a bug or a product decision; say which.
- The mobile API twin of each action (`src/app/api/mobile/v1`) applies the same rules and validation; share one schema
  instead of two copies.

**Error handling**
- Calls to outside services (PayMongo, Google Play, FCM, mail) during a page load or action: a network error or
  timeout throws a plain `TypeError`/`AbortError`, not a `ServiceError`, so code that only catches `ServiceError`
  crashes the page. Wrap the fetch with a timeout and turn failures into a `ServiceError`.
- `findUniqueOrThrow` and similar on a page are fine only when the row must exist; otherwise expect the error panel.

**Server side and data safety**
- Authorization: every ID from a URL, form or body is checked against the caller's family before use.
- Server actions and API handlers receive arbitrary input: validate type, enum and range (zod) before Prisma; a bad
  value should be a readable 400, never a 500.
- Plan entitlements: a limited feature must not leak through another page or card (e.g. app names past the Free limit).
- Check-then-act races (count, then create; read, then write the whole object): two tabs, two parents, web and app at
  once. Fix with a transaction lock or compare-and-swap on a version.
- Stale forms that save the whole object can silently undo a change made elsewhere: send the base version, refuse stale
  saves with a clear message.
- Data from devices or other clients is rendered later: validate its shape before storing it.

**State management**
- `useState(prop)` copies a server value once and never follows it after `router.refresh()` or `revalidatePath`, so
  a change made by another parent or the app doesn't show. Re-sync when the prop changes (store the previous prop and
  compare during render).
- Optimistic updates revert on error and are disabled while pending; confirm steps close on failure.
- Forms reset or keep values deliberately after success; feedback has `role="status"`/`role="alert"`.

**UI behaviour**
- A `<select>` whose current value isn't among its options silently shows the first option, and saving changes the
  data (birth year, age rating). Always include the current value.
- Number inputs: empty means 0 via `Number("")`; bounds; whole numbers.
- Empty, loading and error states for every section; dead ends get a next step (link to pair a device, add a child).
- Accessibility: labels, `role`/`aria-*` on tabs and progress bars, keyboard use, focus in dialogs.
- Lists without limits need paging or a cap that says so.

## 3. Write the plan

Rank findings, then show them before fixing:

- **P1**: wrong information shown, data loss or corruption, security or plan-limit leaks. Every reachable security
  finding is P1; say who can do what to whom.
- **P2**: broken edge cases, crashes on unusual data, accessibility gaps.
- **P3**: polish and copy.

Also list what you checked and found fine, so the user knows it was covered. If a finding needs a product decision
(a policy, a pricing rule), say so and leave it for the user instead of guessing.

## 4. Fix

- Fix at the right layer: a shared service fixes web and mobile together; update the other caller if you change a
  rule (e.g. both the web action and the mobile PATCH).
- Match the surrounding code: its comment density, naming and idiom. Comments explain why, briefly.
- Keep API changes backward compatible (optional fields) and update the docs that describe them (`docs/mobile-api.md`,
  `docs/child-app-spec.md`).
- A `page.tsx` may only export what Next allows (`default`, `generateMetadata`, config); keep helpers unexported.
- Add focused unit tests for logic you fix (validation, date math, safe-redirect checks), mocking `server-only` and the
  database the way existing `src/lib/*.test.ts` files do.

## 5. Verify

Run `tsc`, `eslint` and `vitest` again. Then check the real thing: render the changed pages and call the changed
endpoints against the running dev server, using the session and fixture helpers in
[references/eguard.md](references/eguard.md). For concurrency fixes, fire real concurrent requests and count the rows.

Prove security checks with real requests, not by reading code: a second fixture family's IDs with the first family's
session (expect 404), a non-admin parent's session on admin actions (expect 403), a removed parent's old token
(expect 401), and bad or oversized input (expect 400). Keep the requests and status codes for the report.

Safety rules that come from real incidents:
- **Before anything that sends email** (registering, the API test suite), confirm mail goes to Mailpit, not a real
  provider. See the mail section of the reference; a misconfigured run sent test mail through a live account.
- Never stop or restart the user's dev server. If you start one, track it and stop its whole process tree when done.
- Never print or copy secrets (passwords, API keys, SMTP URLs) into output, files or the skill. A session token you
  mint goes in a shell variable or the scratchpad, never the repo or `/tmp`, and is deleted with `qa.mts cleanup`.
- Clean up every fixture, session and test row you create, and report anything you left behind.

## 6. Report

End with a summary written for the user, in this order:
1. One line: what was audited and the outcome, with verification status (tests, typecheck, lint, what you checked live
   and what you didn't).
2. What was fixed, grouped by severity, each with the concrete symptom it caused and a link to the file.
3. What you checked and found fine.
4. Anything needing their decision, and anything you couldn't verify.
5. Test data left behind, if any, and that nothing is committed (don't commit unless asked).
Then suggest the next area to audit.

Before reporting, update [references/progress.md](references/progress.md): mark the area done with today's date, a
one-line outcome, and any open decisions, so the next session can pick up from there.
