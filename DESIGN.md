---
name: eGuard
description: Calm, sky-lit parent web app that shows what each device has verified, with problems flagged clearly and never alarmingly.
colors:
  navy-ink: "#0B2348"
  slate-ink: "#34496A"
  mist-ink: "#5A6E91"
  sky-accent: "#2498F3"
  deep-sky-ink: "#1570C0"
  button-blue: "#1673C4"
  button-blue-hover: "#0F63AC"
  sky-wash: "#E7F4FF"
  morning-bg: "#F5FAFF"
  paper-surface: "#FFFFFF"
  cloud-surface: "#F3F8FE"
  haze-surface: "#E9F3FD"
  hairline: "#E2ECF7"
  hairline-strong: "#CCDDEF"
  verified-green: "#18A957"
  verified-green-ink: "#0F7F43"
  verified-green-soft: "#E4F6EC"
  amber-attention: "#F4A62A"
  amber-attention-ink: "#94580A"
  amber-attention-soft: "#FEF3E0"
  coral-critical: "#EF5350"
  coral-critical-ink: "#B92E2A"
  coral-critical-soft: "#FDEBEA"
  muted-soft: "#EEF2F7"
typography:
  display:
    fontFamily: "Sora, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Sora, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Sora, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
  metric:
    fontFamily: "Sora, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  mono:
    fontFamily: "ui-monospace, SF Mono, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.92em"
    fontWeight: 600
    letterSpacing: "0.04em"
rounded:
  xs: "8px"
  sm: "10px"
  control: "12px"
  md: "14px"
  lg: "20px"
  hero: "24px"
  pill: "13px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "28px"
  gutter: "32px"
components:
  button-primary:
    backgroundColor: "{colors.button-blue}"
    textColor: "{colors.paper-surface}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.button-blue-hover}"
  button-secondary:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.cloud-surface}"
  button-ghost:
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  card:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.lg}"
    padding: "22px 24px"
  pill-ok:
    backgroundColor: "{colors.verified-green-soft}"
    textColor: "{colors.verified-green-ink}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "26px"
  pill-warn:
    backgroundColor: "{colors.amber-attention-soft}"
    textColor: "{colors.amber-attention-ink}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "26px"
  pill-crit:
    backgroundColor: "{colors.coral-critical-soft}"
    textColor: "{colors.coral-critical-ink}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "26px"
  input:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.sky-wash}"
    textColor: "{colors.deep-sky-ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  ico-tile:
    backgroundColor: "{colors.sky-wash}"
    textColor: "{colors.deep-sky-ink}"
    rounded: "11px"
    size: "38px"
---

# Design System: eGuard

## Overview

**Creative North Star: "The Clear-Sky Checkup"**

Every screen is a reassuring checkup under an open sky. The parent arrives asking "is my family protected?", and the
page answers in calm daylight blues: soft morning backgrounds, white paper surfaces layered on top, deep navy ink
for what matters. When something needs them, it shows up as a warm amber or coral note with the fix right beside
it. It's clear and specific, and never alarming. The system is about verified facts on devices, so it reads like a
well-kept checklist, not a security console.

Density is moderate and friendly. Targets are a generous 44px, corners are rounded but not bubbly, and type pairs
a geometric display face (Sora) for headings and numbers with a warm grotesque (Hanken Grotesk) for everything
people read. The one photographic moment is the dashboard hero: a sunlit family scene behind a pale wash, with the
greeting and status chips in fixed navy so they stay legible in both themes. Everywhere else, color carries meaning
rather than decoration.

The app supports light, dark and system themes from the same tokens. Dark mode is a deep night-navy version of the
same sky, not an inversion. The public landing page (`src/app/landing.css`) is a separate, light-only marketing
variant that shares the ink, fonts and blue family but has its own bigger buttons and gradients. This document
covers the signed-in app.

**Key Characteristics:**
- Soft, layered daylight surfaces: morning background → paper cards → cloud and haze insets.
- Navy ink hierarchy in three steps; sky blue for action and selection only.
- Status is spoken in three tones (verified green, attention amber, critical coral), each with a soft fill and a
  darker ink.
- Sora for headings and figures, Hanken Grotesk for reading, tabular numerals for every count and time.
- Friendly and precise: rounded 10–20px corners, 44px targets, labels that name the action.

## Colors

A cool, sky-lit palette of navy inks and pale blue surfaces, with three warm-to-green status tones that only appear
when they mean something.

### Primary
- **Sky Accent** (`--accent`): focus rings, active nav bar, progress fills, meters, chart bars and icons that mark
  "this is the interactive or selected thing". Dark theme: a brighter sky (#4AA8F5).
- **Deep Sky Ink** (`--accent-ink`): text-weight blue for links, "View all", active nav labels and icon tiles.
  Use it, not Sky Accent, for any blue text (contrast).
- **Button Blue** (`--accent-btn`) and **Button Blue Hover** (`--accent-btn-hover`): primary button fill and its
  hover, deep enough for white text.
- **Sky Wash** (`--accent-soft`, plus `--accent-soft-2` #DCEEFF): the selected nav item, icon tiles, input focus
  halo, accent pills.

### Neutral
- **Navy Ink** (`--ink`): headings, titles, primary text. Also the fixed hero ink, which doesn't flip in dark mode.
- **Slate Ink** (`--ink-2`): secondary text, labels, inactive nav.
- **Mist Ink** (`--ink-3`): metadata, timestamps, placeholders, axis labels.
- **Morning Background** (`--bg`): the page, with the soft `page-bg.jpg` art fixed behind it in light mode.
- **Paper Surface** (`--surface`): cards, dialogs, menus, inputs.
- **Cloud Surface** (`--surface-2`) and **Haze Surface** (`--surface-3`): insets inside cards (activity tiles,
  device visuals, tab tracks), hover fills.
- **Hairline** (`--line`) and **Strong Hairline** (`--line-strong`): card borders, dividers, secondary button and
  input strokes.
- **Muted Soft** (`--muted-soft`): neutral pills ("Offline", "Not configured").

### Status
- **Verified Green** (`--ok`, `--ok-ink`, `--ok-soft`): verified, healthy, protected.
- **Amber Attention** (`--warn`, `--warn-ink`, `--warn-soft`): needs attention, issues, approaching a limit (bar at
  ≥ 85%). Also the dashed daily-limit line in charts (`--limit`).
- **Coral Critical** (`--crit`, `--crit-ink`, `--crit-soft`): action required, over the limit, unread badge,
  error toasts.

Dark theme values for every token live in `src/app/globals.css` (`prefers-color-scheme: dark` and
`[data-theme="dark"]`, kept identical). Dark surfaces step from #071226 (bg) through #0E1C35 (surface) to #172C4E
(surface-3).

### Named Rules
**The Ink-for-Text Rule.** Text is always an `-ink` token (`--ink`, `--ink-2`, `--ink-3`, `--accent-ink`,
`--ok-ink`, `--warn-ink`, `--crit-ink`), never the bright fill (`--accent`, `--ok`, `--warn`, `--crit`). Bright
fills are for bars, dots, icons and meters.

**The Soft-Fill Pairing Rule.** Every status shows as its soft fill with its ink on top (pill, icon tile, callout),
so a state reads the same anywhere it appears.

**The Sky Is Not Decoration Rule.** Blue means "you can act here" or "this is selected". Don't use it to color
headings, borders or empty space.

## Typography

**Display Font:** Sora (500/600/700, via `next/font`, with Hanken Grotesk and system sans fallback)
**Body Font:** Hanken Grotesk (400/500/600/700, with ui-sans-serif, system-ui, Segoe UI, Roboto fallback)
**Mono:** the platform monospace (ui-monospace, SF Mono, Consolas), only for things a parent types or copies
exactly: pairing, join and sponsor codes, inline `code`, and the blocked/allowed site lists.

**Character:** Sora's round geometry gives headings and big numbers a friendly, modern confidence. Hanken Grotesk is
warm and highly legible at 13–15px for labels, metadata and long settings text. All headings use slight negative
tracking (-0.015em) and balanced wrapping.

### Hierarchy
- **Display** (600, 44px, 1.05): the dashboard hero's first name only. 40px at ≤ 1180px, 34px on phones.
- **Headline** (600, 34px): page titles (`.page-head h1`). 28px on phones.
- **Hero lede** (Sora 500, 22px, 1.3): the hero status sentence. 20px / 18px as the screen narrows.
- **Section title** (600, 21px): headings outside cards ("Your Children").
- **Title** (600, 18px): card headings. Card subtitles are Hanken 13px Mist Ink.
- **Metric** (Sora 600, 32px, -0.02em, tabular): metric card values; the "/ 10" suffix drops to 18px Mist Ink. 26px
  on phones.
- **Body** (400, 15px, 1.5): default text. Page intros cap at 62ch.
- **Item title** (600, 14.5px, 1.3): list rows, child and device names.
- **Label / meta** (600 13px for field labels; 400 13px Mist Ink for metadata; 600 12.5px in pills).

### Named Rules
**The Tabular Figures Rule.** Every count, score, duration and time gets `.num` (`font-variant-numeric:
tabular-nums`) so numbers don't jitter as they update.

**The Two-Face Rule.** Sora is for headings, the brand name, avatars' initials and large figures. Everything a parent
reads in sentences is Hanken Grotesk.

## Layout

- **Shell:** a 252px sidebar plus fluid main column on desktop. At ≤ 1180px the sidebar collapses to an 84px icon
  rail. At ≤ 767px a fixed 5-item bottom nav replaces it (content gets bottom padding for the nav and safe area).
  A sticky, translucent top bar holds search, alerts and the profile.
- **Content:** max 1480px wide, padded 32px (24px at ≤ 1180px, 16px on phones). Sections stack with a 28px gap
  (22px on phones); columns inside use 24px.
- **Dashboard:** a two-column grid (fluid main + 360px side column, 320px at ≤ 1320px). Alerts sit at the top of the
  side column and come first in the source, so a single column (≤ 1180px) reads summary → alerts → detail.
- **Grids fit the content count:** cards sit 3 across (2 at ≤ 1320px, 1 on phones). A lone item becomes one wide row
  instead of a third-width tile (`.children-grid.solo`, `.activity-grid.solo`, `.devices-grid.rows`).
- **Rhythm:** a 4px base with 8, 12, 14, 16, 22–24 and 28px as the common steps. Inside a card: 16px under the
  card head, 12–14px between items, 2px between list rows (the rows carry their own padding).
- **Breakpoints:** 1320, 1180, 900 (hero stacks), 767 (phone), 420 and 340 (narrowest metric reflow).

### Named Rules
**The No Empty Thirds Rule.** A grid of one or two items must not leave a blank two-thirds of a row: switch to a
wide row layout.

## Elevation & Depth

Depth comes from **soft layering**. The morning background, white paper cards and cloud/haze insets create the
structure, and a navy-tinted ambient shadow makes the paper feel lifted from the sky. Shadows are always tinted with
navy ink (rgba 11,35,72), never neutral black, in light mode. In dark mode they become deeper black shadows on navy
surfaces.

### Shadow Vocabulary
- **Rest** (`--shadow-sm`: `0 1px 2px rgba(11,35,72,.05)`): every card at rest, the selected tab and segment.
- **Lift** (`--shadow`: `0 1px 2px rgba(11,35,72,.04), 0 8px 24px -12px rgba(11,35,72,.12)`): interactive cards on
  hover, together with a 2px rise and a stronger border.
- **Float** (`--shadow-lg`: `0 24px 60px -20px rgba(11,35,72,.35)`): menus, search results, dialogs, toasts,
  tooltips.
- **Glass** (hero only): the hero's status card and chips are translucent white with backdrop blur over the photo.

### Named Rules
**The Three Layers Rule.** Background, paper, inset. A card never sits inside another card. Use a Cloud Surface
inset (`.act`, `.device-visual`) for a sub-region.

**The Lift-Means-Clickable Rule.** Only `.interactive` cards rise and gain the Lift shadow on hover. Static cards stay
at Rest.

## Shapes

Gently rounded and consistent, never pill-shaped buttons or square edges. Radii step with the size of the surface:
inputs and small buttons 10px, buttons, nav items, tabs and list rows 12px, icon tiles 11px, insets, menus and the sidebar
plan card 14px (`--r`), cards and dialogs 20px (`--r-lg`), and the hero 24px. Pills and badges are fully round (13px on
a 26px height). Avatars are circles with a 2px surface ring so they stack cleanly. Dividers and borders are 1px
hairlines.

## Components

### Buttons
Friendly and precise: solid, clearly labeled, always at least 44px tall.
- **Shape:** 12px radius (`btn-sm`: 36px tall, 10px radius).
- **Primary:** Button Blue fill with white 600-weight 14.5px text, 18px side padding, optional leading icon (8px gap).
- **Hover / Focus:** Button Blue Hover fill. A 2px Sky Accent outline, offset 2px, on `:focus-visible`.
- **Secondary:** Paper Surface with Strong Hairline border and Navy Ink text; hover to Cloud Surface.
- **Ghost:** Slate Ink text, no fill; hover to Cloud Surface.
- **Link button:** Deep Sky Ink 600 14px with a trailing arrow; underline on hover.
- **Disabled:** 50% opacity, not-allowed cursor.

### Chips (pills)
- **Style:** 26px tall, fully round, 12.5px 600 text with a 14px leading icon. Tones: ok, warn, crit, muted, accent,
  always soft fill plus ink.
- **Use:** status only (Healthy, Needs attention, Offline, *n* issues, plan badges). Hero chips are the glass variant.

### Cards / Containers
- **Corner Style:** 20px (`--r-lg`).
- **Background:** Paper Surface with a 1px Hairline border.
- **Shadow Strategy:** Rest; Lift on hover when interactive (see Elevation & Depth).
- **Internal Padding:** 22px × 24px (18px on phones); metric cards 20px × 22px.
- **Card head:** title on the left, "View all →" link or a date on the right, 13px Mist Ink subtitle beneath.

### Inputs / Fields
- **Style:** 44px tall, 10px radius, Strong Hairline stroke on Paper Surface. Labels above, 13px 600 Slate Ink, 6px gap.
- **Focus:** the border turns Sky Accent, with a 4px Sky Wash halo.
- **Search:** 12px radius, a leading icon and a `/` key hint.
- **Switch:** 46 × 28 track, white knob with a small shadow, eased slide.

### Navigation
- **Sidebar items:** 44px tall, 12px radius, Slate Ink 500. Hover fills Cloud Surface. Active: Sky Wash fill, Deep Sky
  Ink 600 label, and a 3px Sky Accent bar on the left edge. Attention counts are small amber pills.
- **Tabs:** a segmented track (Cloud Surface, 4px inset) where the selected tab is a Paper Surface chip with the Rest
  shadow; or an underline variant with a 2px Sky Accent bar.
- **Phones:** a bottom nav with icon plus 11.5px label; the active icon sits in a Sky Wash capsule.

### Icon tiles and list rows
- **Icon tile:** a 38px rounded square (11px) in a soft tone with a 18px Lucide icon in its ink. It leads every quick
  action, alert row and metric card.
- **List row:** 56px minimum height, 12px radius, icon tile + title + chevron. On hover, Cloud Surface and the chevron
  nudges 2px right in Deep Sky Ink.

### Dashboard hero (signature)
A 24px-radius banner with the licensed family photo (`public/web/dashboard-hero.jpg`) covering the right side and a
pale left-to-right wash keeping the copy legible. The greeting, first name (Display) and status sentence are in fixed
navy in both themes. Glass status chips follow, and a glass "Current status" card lists up to four children. On
tablet the card stacks under the copy; on phones it's hidden, since the child cards follow right after.

### Meters and charts
- **Segment meter:** 10 rounded 6px segments, one per protection: Sky Accent for verified, Amber for failing, Hairline
  for empty.
- **Progress bar:** 8px track in Hairline, Sky Accent fill, amber at ≥ 85%, coral when over.
- **Weekly chart:** small multiples per child. Sky bars (today faded), a navy tick for last week's same day, and a
  dashed amber limit line, with a Table toggle for the same numbers.

## Do's and Don'ts

### Do:
- **Do** pair every status with its soft fill and ink (`tone-ok`, `tone-warn`, `tone-crit`, `tone-muted`) and an icon,
  so status never relies on color alone.
- **Do** keep touch targets at least 44px (buttons, nav items, list rows, icon buttons).
- **Do** use `.num` tabular figures for every number and time.
- **Do** give every surface its light and dark value from the tokens. Never hard-code a color outside the hero.
- **Do** put the fix next to the problem: a warn or crit state in a card links to the action that resolves it.
- **Do** let lone items fill the row (the No Empty Thirds Rule).

### Don't:
- **Don't** darken a surface behind Mist Ink beyond Haze Surface. Mist Ink was tuned to clear 4.5:1 (WCAG AA) on every light surface up to Haze and on muted pills; anything darker needs Slate Ink.
- **Don't** use the bright status fills or Sky Accent for text. Use the `-ink` variant.
- **Don't** nest a card inside a card. Use a Cloud Surface inset.
- **Don't** add new shadow recipes or neutral-black shadows in light mode. Use Rest, Lift or Float.
- **Don't** use blue for decoration. It marks actions and selection.
- **Don't** add glass or blur outside the hero.
