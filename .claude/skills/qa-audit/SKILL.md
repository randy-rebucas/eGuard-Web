---
name: qa-audit
description: Expert QA audit of one feature, route or area of this app (e.g. src/app/(app)/dashboard, src/app/(app)/children/[id], the mobile API), planned first and then fixed, until it's complete, functional and production ready. Use this whenever the user asks to audit, QA, review for production readiness, harden, or "check and fix" a page, feature, folder, flow or API, or says "next <path>" / "proceed" while working through such an audit, even if they don't say "QA". Not for a plain code review of a diff (use code-review) or for pure visual/design polish.
---

# QA audit: plan, then fix

You are acting as an expert QA engineer. The goal for the area the user names is that it is **complete, functional and
production ready**: it shows parents correct information in every state, rejects bad input cleanly, can't leak or lose
data, and works for every plan, role and device situation. A page that renders is not the bar.

Work in two phases, in one turn unless the user says otherwise: **plan** (findings, ranked), then **fix** (and verify).
The user has said "do plan first then fix": show the plan briefly, then go straight into fixing; don't stop to ask for
approval unless a finding needs a decision only they can make.

## 1. Scope the audit

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

**Correctness of what's shown**
- Every state: no children, children but no devices, devices offline, unverified email, Free vs paid plan, family admin
  vs other parent, many items (10 children, 20 devices, 200 apps), empty strings and names.
- Copy that claims something false ("verified" while offline, "keeps no history" when history is on, "All healthy"
  with zero devices, "Not set" when a value applies). Read every sentence as the parent would.
- Consistency between pages: the same fact (limits, location state, health) computed one way everywhere. Prefer an
  existing helper (`childLocation`, `limitOn`, `computeHealth`) over re-deriving it.
- Dates and time zones: weekend vs weekday, month boundaries ("Sep 25 – 1"), the family's time zone, values computed
  once at module load (`new Date()` in a schema).
- Hardcoded totals (`/ 10`) that should come from data.

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

**UI behaviour**
- A `<select>` whose current value isn't among its options silently shows the first option, and saving changes the
  data (birth year, age rating). Always include the current value.
- Number inputs: empty means 0 via `Number("")`; bounds; whole numbers.
- Empty, loading and error states for every section; dead ends get a next step (link to pair a device, add a child).
- Accessibility: labels, `role`/`aria-*` on tabs and progress bars, keyboard use, focus in dialogs.
- Lists without limits need paging or a cap that says so.

## 3. Write the plan

Rank findings, then show them before fixing:

- **P1**: wrong information shown, data loss or corruption, security or plan-limit leaks.
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
- Add focused unit tests for logic you fix (validation, date math, safe-redirect checks), mocking `server-only` and the
  database the way existing `src/lib/*.test.ts` files do.

## 5. Verify

Run `tsc`, `eslint` and `vitest` again. Then check the real thing: render the changed pages and call the changed
endpoints against the running dev server, using the session and fixture helpers in
[references/eguard.md](references/eguard.md). For concurrency fixes, fire real concurrent requests and count the rows.

Safety rules that come from real incidents:
- **Before anything that sends email** (registering, the API test suite), confirm mail goes to Mailpit, not a real
  provider. See the mail section of the reference; a misconfigured run sent test mail through a live account.
- Never stop or restart the user's dev server. If you start one, track it and stop its whole process tree when done.
- Never print or copy secrets (passwords, API keys, SMTP URLs) into output, files or the skill.
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
