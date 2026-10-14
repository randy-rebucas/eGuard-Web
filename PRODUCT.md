# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Parents**, usually the family admin (`FAMILY_ADMIN`), plus other parents (`PARENT`) the admin invites. They
  set protections for their children's phones, tablets and browsers, then come back to check that those
  protections are still in place and to answer requests (apps, extra time, blocked sites).
- They use the parent web app **on phones and on desktops about equally**: setup and reviews often happen at a
  computer, quick check-ins on a phone. Neither layout may be second-class.
- **Organization admins** (schools, community groups, businesses) manage join codes and sponsor codes. They see
  counts only, never a family's data.
- **Children** see eGuard only through the child-device app and the browser extension (separate clients), never
  this web app.

## Product Purpose

eGuard is a family digital-safety platform for Android and iOS phones and tablets, and for Chrome, Edge and Firefox
through the browser extension. This repository is the parent web app and the backend every client uses.

It lets parents set up 10 protections (Screen Time, Bedtime, App Restrictions, App Approval, Content, Web Filtering,
Downloads, Location, Notification Controls, Uninstall Protection) and shows **Configuration Health**: whether each
protection is set up *and verified* on each device. Success is a parent who can see at a glance that what they asked
for is actually in force, and fix anything that isn't in a few steps.

## Positioning

**Nothing is reported as done until the device confirms it.** A parent's change becomes a request per device and
counts only once the device reports the config it actually has. When a setting drifts (a child turns something
off), eGuard says so.

Configuration Health measures how devices are configured. **It never scores a child's behavior.**

The product was built first for Filipino families (peso pricing, GCash/Maya/QR Ph payments, local school terms),
but the positioning must not depend on the Philippines: it is meant to reach a wider market.

## Operating Context

- Parent web app with light, dark and system themes; sidebar on desktop, icon rail on tablet, bottom nav and drawer
  on phones. A parent mobile app (iOS/Android) uses the same service layer through `/api/mobile/v1`.
- Platform capability per protection: `AVAILABLE` (applied and verified), `GUIDED` (parent follows steps on the
  device, then verifies), `VERIFY_ONLY` (parent sets it, eGuard confirms), `UNSUPPORTED` (never counted against
  health). iOS often needs guided steps.
- Alerts carry an action (fix the setting, view the device, review the request). A weekly summary email goes out on
  Sunday evening in the family's time zone.
- Plans: Free (1 child, 2 devices), eGuard Plus (5 children, 10 devices), Family Pro (10 children, 20 devices).
  Phones, tablets and browsers all count as devices. Plans are bought on the web only.

## Capabilities and Constraints

- Terminology the UI uses consistently: Configuration Health, protections, verified, guided setup, configuration
  check, pairing code, sponsor code, join code, Family Protection score (*n* / 10).
- The child's device and browser never hold parent credentials.
- Location sharing and location history are plan- and privacy-gated; activity is kept 90 days.
- Not built yet: native apps in production, buying in the apps, realtime updates (the UI polls), choosing the
  retention period.

## Brand Commitments

- Name **eGuard**. Logo files in `public/brand/` (mark, horizontal, full, light and dark variants, app icon).
- Sidebar tagline "Digital Safety for Brighter Tomorrows"; site tagline (`SITE_TAGLINE` in `src/lib/site.ts`)
  "Protections you set once, verified on every device".
- Voice: plain, calm and specific. Say what is true about a device and what the parent can do next; never alarm,
  never blame the child.
- Operator and legal details come from `src/lib/legal.ts` (DevCom Digital Marketing Services).

## Evidence on Hand

- Real product behavior, the demo family seed (`prisma/seed.ts`) and a demo organization for screenshots.
- Hero image `public/web/dashboard-hero.jpg` and page background `public/web/page-bg.jpg`.
- Press release draft (`docs/press-release.md`) and store listing copy (`docs/app-listing.md`).
- **No testimonials, customer counts, ratings, press coverage or partner logos exist.** Future work must not invent
  them.

## Product Principles

1. **Verified, not assumed.** Show what the device confirmed. Pending, guided and failed states are first-class,
   never dressed up as success.
2. **Configuration, not surveillance.** Describe settings and devices, never grade or shame the child.
3. **Every problem comes with its fix.** An issue shown to a parent links to the action that resolves it.
4. **Calm at a glance, detail on demand.** The first view answers "is my family protected?"; depth sits one step
   away.
5. **Works for the family's real devices.** Budget Android phones on slow connections are a primary case, not an
   edge case.

## Accessibility & Inclusion

- **WCAG 2.2 AA** is the required floor for the web app.
- **Language:** English only today, but the UI must be ready for Filipino (Tagalog) copy: longer strings,
  externalizable text, no layouts that break when labels grow.
- **Performance is an accessibility constraint:** many parents use low-end Android phones on slow or metered
  connections. Keep pages light, stream slow sections, avoid heavy client code.
