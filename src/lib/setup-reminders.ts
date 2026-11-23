import "server-only";
import type { Platform, Prisma, ProtectionKey } from "@prisma/client";
import { STORE_LINKS } from "@/components/brand-marks";
import { db } from "./db";
import { PROTECTION_BY_KEY } from "./protections";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";
import { localMinute } from "./parent-care/schedule";

/**
 * Setup reminders: a family with nothing paired has nothing protected, and the in-app banner only reaches them if they
 * come back. The maintenance job emails these, each a few times at most and then never again:
 * - no children yet (Family.childReminders): add your child, then connect their phone and browser. Adding a child ends it.
 * - children but no paired device (Family.setupReminders): the steps to pair the phone and add the browser extension.
 *   Pairing any device ends it. A family that finishes the first sequence by adding a child then gets this one.
 * - a child left out (Child.setupReminders): the family has a device, this child has none. Ends when theirs is paired.
 * - a phone but no browser (Child.browserNudgedAt): one suggestion to add the extension.
 * - a phone whose protections never started working after pairing (Device.setupNudgedAt): once, naming them. Protection
 *   alerts only fire when a working protection stops (lib/engine), so nothing else tells the parent.
 *
 * Sent to the family's parents with a verified address and "Email alerts" on (unverified parents can't pair a device
 * anyway, and get the verification email instead). Each step is claimed on the family's counter first, so two
 * overlapping runs never send one step twice.
 */

/** Days after the start (family created / first child added) that each reminder is due */
export const STEPS = [1, 4, 10] as const;

/** A sequence whose start is older than this when the scan first finds it isn't started (no mailing old accounts) */
export const START_WITHIN_DAYS = 60;

/** Only sent between these local times (minutes after midnight), so nobody gets one at 3 AM */
export const SEND_FROM = 9 * 60;
export const SEND_UNTIL = 20 * 60;

/** Families looked at per run; the rest wait for the next run, 10 minutes later */
const BATCH = 200;

const DAY = 864e5;

/** `since`: when the sequence's clock starts (the family was created, or its first child added) */
export type ReminderState = { since: Date; sent: number; lastAt: Date | null; timezone: string };

/** Whether it's daytime in `timezone`, when these emails may go */
export function inSendingHours(now: Date, timezone: string) {
  const m = localMinute(now, timezone);
  return m >= SEND_FROM && m < SEND_UNTIL;
}

/** Whether the next reminder of a sequence should go now. Pure, so it's tested without a database. */
export function reminderDue(s: ReminderState, now = new Date(), steps: readonly number[] = STEPS) {
  if (s.sent >= steps.length) return false;
  const age = now.getTime() - s.since.getTime();
  if (age < steps[s.sent] * DAY) return false;
  if (s.sent === 0 && age > START_WITHIN_DAYS * DAY) return false;
  // A family found late (this shipped after their sequence started) still gets the steps spaced out, not all at once
  if (s.sent > 0 && s.lastAt && now.getTime() - s.lastAt.getTime() < (steps[s.sent] - steps[s.sent - 1]) * DAY) return false;
  return inSendingHours(now, s.timezone);
}

/** A child left out (the family has another device): two reminders, the family is already set up */
export const CHILD_STEPS = [1, 5] as const;

/** The browser suggestion goes this many days after the child's first phone was paired */
export const BROWSER_NUDGE_DAYS = 3;

/** A phone whose protections still aren't working this long after pairing gets the email; older ones never do */
export const UNFINISHED_AFTER_DAYS = 1;
export const UNFINISHED_WITHIN_DAYS = 30;

/** "Mia", "Mia and Leo", "Mia, Leo and Sam" */
export function nameList(names: string[]) {
  if (names.length <= 1) return names[0] ?? "your child";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>`;
const link = (href: string, label: string) => `<a href="${href}" style="color:#1a73e8">${escapeHtml(label)}</a>`;
const ol = (steps: string[]) => `<ol style="padding-left:20px;margin:8px 0">${steps.map((s) => `<li style="margin-bottom:6px">${escapeHtml(s)}</li>`).join("")}</ol>`;
const numbered = (steps: string[]) => steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
const h3 = (s: string) => `<h3 style="margin:20px 0 4px">${escapeHtml(s)}</h3>`;
const footnote = (s: string) => `<p style="color:#555;font-size:13px">${escapeHtml(s)}</p>`;

/**
 * The email for reminder `step` (0-based). The steps match the in-app guide (components/connect-guide), so keep them
 * in step when the child apps' buttons change. `hasBrowser`: an extension is already connected, so it's acknowledged
 * rather than asked for again.
 */
export function setupReminderEmail(o: { step: number; parent: string; children: string[]; hasBrowser: boolean; protectedSiblings?: string[] }) {
  const base = appUrl();
  const kids = nameList(o.children);
  const one = o.children.length === 1;
  const their = one ? `${kids}'s` : "your children's";
  const them = one ? kids : "your children";
  const phone = one ? "phone" : "phones", device = one ? "phone or tablet" : "phones or tablets";
  const hi = o.parent ? `Hi ${o.parent},` : "Hi,";
  const pair = `${base}/devices#pair`, addBrowser = `${base}/devices#add-browser`, guide = `${base}/how-it-works#setup`;
  // One child left out while a brother or sister is protected (`children` is that one child)
  const siblings = o.protectedSiblings?.length ? nameList(o.protectedSiblings) : null;
  const sibVerb = o.protectedSiblings?.length === 1 ? "is" : "are";

  const subject = (siblings ? [
    `${kids} isn't protected by eGuard yet`,
    `Reminder: connect ${their} phone to eGuard`,
  ] : [
    `Finish setting up eGuard: connect ${their} ${phone}`,
    `${kids} ${one ? "isn't" : "aren't"} protected yet`,
    `Last reminder: ${their} devices still need eGuard`,
  ])[o.step] ?? `Connect ${their} ${phone} to eGuard`;

  const intro = (siblings ? [
    `${siblings} ${sibVerb} protected by eGuard, but ${kids} has no device connected yet, so ${their} phone isn't protected. It takes about 5 minutes. Here's how.`,
    `${kids} still has no device connected to eGuard. Keep ${their} phone nearby and on Wi-Fi, and follow these steps.`,
  ] : [
    `You added ${kids} to eGuard, but no device is connected yet, so nothing is protected so far. It takes about 5 minutes. Here's how.`,
    `${kids} ${one ? "is" : "are"} set up in eGuard, but ${their} ${one ? "phone isn't" : "phones aren't"} connected yet. Until then, screen time limits, app approvals and web filtering can't do anything. Keep the ${phone} nearby and on Wi-Fi, and follow these steps.`,
    `This is our last reminder. ${kids} ${one ? "has" : "have"} no device connected to eGuard, so ${their} ${phone} and ${one ? "browser aren't" : "browsers aren't"} protected. When you're ready, it takes about 5 minutes.`,
  ])[o.step] ?? `You added ${kids} to eGuard, but no device is connected yet.`;

  const phoneSteps = [
    `Get a pairing code: in eGuard, open Devices › Pair a device, choose ${one ? kids : "your child"} and select "Get pairing code". The code works for 15 minutes.`,
    `On ${one ? `${kids}'s phone or tablet` : "each child's phone or tablet"}, install eGuard from Google Play.`,
    `Open eGuard, tap "Get Started", then "This is my child's device".`,
    `Enter the code and a name you'll recognise, like "${o.children[0] ?? "Mia"}'s phone", then tap "Connect".`,
    `Allow what eGuard asks for. It explains each permission before Android asks.`,
  ];
  const browserSteps = [
    `In eGuard, open Devices › Add a browser, choose ${one ? kids : "your child"}, name the computer and select "Get pairing code".`,
    `On ${their} computer, add the eGuard extension to the browser they use: Chrome, Edge or Firefox.`,
    `The extension opens a setup page: choose "Get started" and enter the code.`,
    `Repeat for each browser ${them} ${one ? "uses" : "use"}, so none is left unprotected.`,
  ];
  const browserIntro = o.hasBrowser
    ? `${one ? `${kids}'s browser is` : "A browser is"} already protected. Connecting ${their} ${phone} too covers apps, screen time and location.`
    : `Children browse on computers too. The eGuard extension filters websites and blocks adult content in Chrome, Edge and Firefox:`;
  const ios = o.hasBrowser
    ? `Using an iPhone or iPad? The iPhone app is coming soon.`
    : `Using an iPhone or iPad? The iPhone app is coming soon. Until then, protect ${their} browsing with the extension below.`;
  const why = `You get this because "Email alerts" is on in Settings › Notifications. These reminders stop once a device is connected${siblings ? ` for ${kids}` : ""}.`;

  const text = [
    hi, intro,
    `Connect ${their} Android ${device}:\n${phoneSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nPair a device: ${pair}\nGoogle Play: ${STORE_LINKS.googlePlay}`,
    ios,
    o.hasBrowser
      ? browserIntro
      : `Protect ${their} browser too\n${browserIntro}\n${browserSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nAdd a browser: ${addBrowser}\nChrome: ${STORE_LINKS.chrome}\nEdge: ${STORE_LINKS.edge}\nFirefox: ${STORE_LINKS.firefox}`,
    `The full setup guide, with pictures of each step: ${guide}`,
    `— eGuard`, why,
  ].join("\n\n");

  const html = `<p>${escapeHtml(hi)}</p><p>${escapeHtml(intro)}</p>`
    + `<h3 style="margin:20px 0 4px">Connect ${escapeHtml(their)} Android ${device}</h3>${ol(phoneSteps)}`
    + `<p>${button(pair, "Pair a device")}</p>`
    + `<p>Get eGuard for the phone: ${link(STORE_LINKS.googlePlay, "Google Play")}</p>`
    + `<p style="color:#555">${escapeHtml(ios)}</p>`
    + (o.hasBrowser
      ? `<p>${escapeHtml(browserIntro)}</p>`
      : `<h3 style="margin:20px 0 4px">Protect ${escapeHtml(their)} browser too</h3><p>${escapeHtml(browserIntro)}</p>${ol(browserSteps)}`
        + `<p>${button(addBrowser, "Add a browser")}</p>`
        + `<p>Get the extension: ${link(STORE_LINKS.chrome, "Chrome")} · ${link(STORE_LINKS.edge, "Edge")} · ${link(STORE_LINKS.firefox, "Firefox")}</p>`)
    + `<p>${link(guide, "See the full setup guide, with pictures of each step")}</p>`
    + `<p style="color:#555;font-size:13px">${escapeHtml(why)}</p>`;

  return { subject, text, html };
}

/**
 * The email for a family with no children yet, reminder `step` (0-based): add the child first (each device is paired
 * to a child), then an overview of connecting their phone and browser.
 */
export function addChildReminderEmail(o: { step: number; parent: string }) {
  const base = appUrl();
  const hi = o.parent ? `Hi ${o.parent},` : "Hi,";
  const addChild = `${base}/children/new`, guide = `${base}/how-it-works#setup`;

  const subject = [
    "Finish setting up eGuard: add your child",
    "Your child isn't protected by eGuard yet",
    "Last reminder: finish setting up eGuard",
  ][o.step] ?? "Finish setting up eGuard";

  const intro = [
    "Thanks for joining eGuard. Your account is ready, but you haven't added your child yet, so nothing is protected so far. Setting up takes about 10 minutes.",
    "Your eGuard account is ready, but no child has been added yet. Until you add your child and connect their phone, screen time limits, app approvals and web filtering can't do anything.",
    "This is our last reminder. Your eGuard account has no child added yet, so your child's phone and browser aren't protected. When you're ready, it takes about 10 minutes.",
  ][o.step] ?? "Your eGuard account is ready, but you haven't added your child yet.";

  const steps = [
    `Add your child: their name and birth year. eGuard suggests protections that fit their age.`,
    `Connect their phone: in Devices › Pair a device, get a pairing code. On your child's Android phone or tablet, install eGuard from Google Play, tap "Get Started", then "This is my child's device", and enter the code.`,
    `Protect their browser: in Devices › Add a browser, get a code, then add the eGuard extension to Chrome, Edge or Firefox on their computer and enter it. It filters websites and blocks adult content.`,
  ];
  const ios = "Using an iPhone or iPad? The iPhone app is coming soon. Until then, protect your child's browsing with the extension.";
  const why = `You get this because "Email alerts" is on in Settings › Notifications. These reminders stop once you add a child.`;

  const text = [
    hi, intro,
    `Three steps to protect your child:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
    `Add your child: ${addChild}`,
    `Google Play: ${STORE_LINKS.googlePlay}\nChrome: ${STORE_LINKS.chrome}\nEdge: ${STORE_LINKS.edge}\nFirefox: ${STORE_LINKS.firefox}`,
    ios,
    `The full setup guide, with pictures of each step: ${guide}`,
    `— eGuard`, why,
  ].join("\n\n");

  const html = `<p>${escapeHtml(hi)}</p><p>${escapeHtml(intro)}</p>`
    + `<h3 style="margin:20px 0 4px">Three steps to protect your child</h3>`
    + `<ol style="padding-left:20px;margin:8px 0">${steps.map((s) => `<li style="margin-bottom:6px">${escapeHtml(s)}</li>`).join("")}</ol>`
    + `<p>${button(addChild, "Add your child")}</p>`
    + `<p>Get eGuard for the phone: ${link(STORE_LINKS.googlePlay, "Google Play")}</p>`
    + `<p>Get the browser extension: ${link(STORE_LINKS.chrome, "Chrome")} · ${link(STORE_LINKS.edge, "Edge")} · ${link(STORE_LINKS.firefox, "Firefox")}</p>`
    + `<p style="color:#555">${escapeHtml(ios)}</p>`
    + `<p>${link(guide, "See the full setup guide, with pictures of each step")}</p>`
    + `<p style="color:#555;font-size:13px">${escapeHtml(why)}</p>`;

  return { subject, text, html };
}

/** A child whose phone is paired but who has no browser protected: one suggestion to add the extension. */
export function browserNudgeEmail(o: { parent: string; child: string }) {
  const base = appUrl();
  const hi = o.parent ? `Hi ${o.parent},` : "Hi,";
  const addBrowser = `${base}/devices#add-browser`;
  const subject = `${o.child}'s phone is protected. What about their computer?`;
  const intro = `${o.child}'s phone is connected to eGuard. If ${o.child} also uses a computer, for school or games, its browser isn't protected yet. The eGuard extension filters websites and blocks adult content in Chrome, Edge and Firefox.`;
  const steps = [
    `In eGuard, open Devices › Add a browser, choose ${o.child}, name the computer and select "Get pairing code".`,
    `On ${o.child}'s computer, add the eGuard extension to the browser they use.`,
    `The extension opens a setup page: choose "Get started" and enter the code.`,
    `Repeat for each browser ${o.child} uses, so none is left unprotected.`,
  ];
  const why = `You get this because "Email alerts" is on in Settings › Notifications. We only send this suggestion once.`;
  const text = [
    hi, intro, `Add the browser extension:\n${numbered(steps)}`,
    `Add a browser: ${addBrowser}\nChrome: ${STORE_LINKS.chrome}\nEdge: ${STORE_LINKS.edge}\nFirefox: ${STORE_LINKS.firefox}`,
    `No computer? Then there's nothing to do.`, `— eGuard`, why,
  ].join("\n\n");
  const html = `<p>${escapeHtml(hi)}</p><p>${escapeHtml(intro)}</p>${h3("Add the browser extension")}${ol(steps)}`
    + `<p>${button(addBrowser, "Add a browser")}</p>`
    + `<p>Get the extension: ${link(STORE_LINKS.chrome, "Chrome")} · ${link(STORE_LINKS.edge, "Edge")} · ${link(STORE_LINKS.firefox, "Firefox")}</p>`
    + `<p style="color:#555">No computer? Then there's nothing to do.</p>${footnote(why)}`;
  return { subject, text, html };
}

/** What an Android phone needs allowed for a protection to work, in the in-app guide's words (components/connect-guide) */
const ANDROID_HINT: Partial<Record<ProtectionKey, string[]>> = {
  // The app's own needs (Android AndroidDeviceSources.canEnforce); App Restrictions and Content are set in Google Play
  SCREEN_TIME: ["accessibility", "usage access"], BEDTIME: ["accessibility"], APP_APPROVAL: ["accessibility"],
  DOWNLOADS: ["accessibility"], NOTIFICATIONS: ["Do Not Disturb access"],
  UNINSTALL_PROTECTION: ["device admin"], WEB: ["the web filtering step"], LOCATION: ["location"],
};

/**
 * A phone paired a while ago where protections the parent set never started working: usually a permission wasn't
 * allowed during setup. Protection alerts only fire when a working protection stops (lib/engine), so nothing else
 * tells the parent.
 */
export function unfinishedSetupEmail(o: { parent: string; child: string; deviceName: string; deviceId: string; platform: Platform; keys: ProtectionKey[] }) {
  const base = appUrl();
  const hi = o.parent ? `Hi ${o.parent},` : "Hi,";
  const phone = `${o.child}'s ${o.deviceName}`;
  const page = `${base}/devices/${encodeURIComponent(o.deviceId)}`;
  const names = nameList(o.keys.map((k) => PROTECTION_BY_KEY[k]?.checkName ?? k));
  const hints = o.platform === "ANDROID" ? [...new Set(o.keys.flatMap((k) => ANDROID_HINT[k] ?? []))] : [];
  const subject = `Finish setting up ${phone}: ${o.keys.length === 1 ? "a protection isn't" : "some protections aren't"} working yet`;
  const intro = `${phone} is connected to eGuard, but ${o.keys.length === 1 ? "this protection isn't" : "these protections aren't"} working on it yet: ${names}. Usually a permission wasn't allowed during setup.`;
  const steps = [
    `Open eGuard on ${phone} and allow what it asks for${hints.length ? ` (for these: ${nameList(hints)})` : ""}.`,
    `Keep the phone on and online for a few minutes. Each protection shows as working on the device page once the phone reports it.`,
  ];
  const why = `You get this because "Email alerts" is on in Settings › Notifications. We send this once per device.`;
  const text = [hi, intro, `To finish:\n${numbered(steps)}`, `See ${phone}: ${page}`, `— eGuard`, why].join("\n\n");
  const html = `<p>${escapeHtml(hi)}</p><p>${escapeHtml(intro)}</p>${h3("To finish")}${ol(steps)}`
    + `<p>${button(page, `See ${phone}`)}</p>${footnote(why)}`;
  return { subject, text, html };
}

/** `scanned`: families, children or devices the scan found; `due`: claimed and emailed */
type Tally = { scanned: number; due: number; sent: number; failed: number };

/** Emails each verified parent with "Email alerts" on. A pending invitation is unverified, so it's already left out. */
async function mailParents(familyId: string, t: Tally, make: (firstName: string) => { subject: string; text: string; html: string }) {
  const parents = await db.user.findMany({
    where: { familyId, notifyEmail: true, emailVerifiedAt: { not: null } },
    select: { email: true, name: true },
  });
  for (const p of parents) {
    try {
      await sendMail({ to: p.email, ...make(p.name.split(/\s+/)[0]) });
      t.sent++;
    } catch (e) {
      t.failed++;
      console.error("[setup-reminders] email failed", familyId, e);
    }
  }
}

/** Sequences found later than this are never started (reminderDue), so they aren't scanned; 30 days' slack lets one finish */
const scanFrom = (now: Date) => new Date(now.getTime() - (START_WITHIN_DAYS + 30) * DAY);

/** Connected and reporting, not just paired: an unfinished pairing is removed after a day */
const workingBrowser = { revokedAt: null, lastHealthAt: { not: null } };

const PHONES = { kind: { in: ["PHONE", "TABLET"] } } satisfies Prisma.DeviceWhereInput;

/** Families with no children: the "add your child" sequence, timed from when the family was created */
async function remindNoChildren(now: Date): Promise<Tally> {
  const families = await db.family.findMany({
    where: { childReminders: { lt: STEPS.length }, children: { none: {} }, createdAt: { gte: scanFrom(now) } },
    select: { id: true, timezone: true, createdAt: true, childReminders: true, childRemindedAt: true },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  const t: Tally = { scanned: families.length, due: 0, sent: 0, failed: 0 };
  for (const f of families) {
    if (!reminderDue({ since: f.createdAt, sent: f.childReminders, lastAt: f.childRemindedAt, timezone: f.timezone }, now)) continue;
    // Claim the step first: a second run, or a child added meanwhile, makes this match nothing
    const claimed = await db.family.updateMany({
      where: { id: f.id, childReminders: f.childReminders, children: { none: {} } },
      data: { childReminders: f.childReminders + 1, childRemindedAt: now },
    });
    if (!claimed.count) continue;
    t.due++;
    await mailParents(f.id, t, (parent) => addChildReminderEmail({ step: f.childReminders, parent }));
  }
  return t;
}

/** Families with children but no paired device: the pairing steps, timed from when the first child was added */
async function remindNoDevices(now: Date): Promise<Tally> {
  const families = await db.family.findMany({
    where: {
      setupReminders: { lt: STEPS.length }, devices: { none: {} },
      // Every child recent enough, so the first one is: a family too old to start never fills the batch
      children: { some: {}, every: { createdAt: { gte: scanFrom(now) } } },
    },
    select: {
      id: true, timezone: true, setupReminders: true, setupRemindedAt: true,
      children: { select: { name: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      browsers: { where: workingBrowser, select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  const t: Tally = { scanned: families.length, due: 0, sent: 0, failed: 0 };
  for (const f of families) {
    if (!reminderDue({ since: f.children[0].createdAt, sent: f.setupReminders, lastAt: f.setupRemindedAt, timezone: f.timezone }, now)) continue;
    // Claim the step first: a second run, or a device paired meanwhile, makes this match nothing
    const claimed = await db.family.updateMany({
      where: { id: f.id, setupReminders: f.setupReminders, devices: { none: {} } },
      data: { setupReminders: f.setupReminders + 1, setupRemindedAt: now },
    });
    if (!claimed.count) continue;
    t.due++;
    const children = f.children.map((c) => c.name), hasBrowser = f.browsers.length > 0;
    await mailParents(f.id, t, (parent) => setupReminderEmail({ step: f.setupReminders, parent, children, hasBrowser }));
  }
  return t;
}

/**
 * A child left out: the family has a paired device, this child has none. Timed from when the child was added or the
 * family's first device was paired, whichever is later, so parents pairing one child after another aren't interrupted.
 */
async function remindLeftOutChildren(now: Date): Promise<Tally> {
  const children = await db.child.findMany({
    where: { setupReminders: { lt: CHILD_STEPS.length }, devices: { none: {} }, family: { devices: { some: {} } }, createdAt: { gte: scanFrom(now) } },
    select: {
      id: true, name: true, familyId: true, createdAt: true, setupReminders: true, setupRemindedAt: true,
      browsers: { where: workingBrowser, select: { id: true }, take: 1 },
      family: {
        select: {
          timezone: true,
          devices: { select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
          children: { where: { devices: { some: {} } }, select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  const t: Tally = { scanned: children.length, due: 0, sent: 0, failed: 0 };
  for (const c of children) {
    const firstDevice = c.family.devices[0]?.createdAt ?? c.createdAt;
    const since = firstDevice > c.createdAt ? firstDevice : c.createdAt;
    if (!reminderDue({ since, sent: c.setupReminders, lastAt: c.setupRemindedAt, timezone: c.family.timezone }, now, CHILD_STEPS)) continue;
    const claimed = await db.child.updateMany({
      where: { id: c.id, setupReminders: c.setupReminders, devices: { none: {} } },
      data: { setupReminders: c.setupReminders + 1, setupRemindedAt: now },
    });
    if (!claimed.count) continue;
    t.due++;
    const protectedSiblings = c.family.children.map((s) => s.name), hasBrowser = c.browsers.length > 0;
    await mailParents(c.familyId, t, (parent) => setupReminderEmail({ step: c.setupReminders, parent, children: [c.name], hasBrowser, protectedSiblings }));
  }
  return t;
}

/**
 * A child with a phone or tablet paired but no browser, and no computer (eGuard on a computer links its browsers
 * itself): one suggestion to add the extension, BROWSER_NUDGE_DAYS after a phone was paired.
 */
async function nudgeBrowsers(now: Date): Promise<Tally> {
  const children = await db.child.findMany({
    where: {
      browserNudgedAt: null, browsers: { none: { revokedAt: null } },
      devices: {
        some: { ...PHONES, createdAt: { gte: new Date(now.getTime() - START_WITHIN_DAYS * DAY), lte: new Date(now.getTime() - BROWSER_NUDGE_DAYS * DAY) } },
        none: { kind: "COMPUTER" },
      },
    },
    select: { id: true, name: true, familyId: true, family: { select: { timezone: true } } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  const t: Tally = { scanned: children.length, due: 0, sent: 0, failed: 0 };
  for (const c of children) {
    if (!inSendingHours(now, c.family.timezone)) continue;
    const claimed = await db.child.updateMany({ where: { id: c.id, browserNudgedAt: null, browsers: { none: { revokedAt: null } } }, data: { browserNudgedAt: now } });
    if (!claimed.count) continue;
    t.due++;
    await mailParents(c.familyId, t, (parent) => browserNudgeEmail({ parent, child: c.name }));
  }
  return t;
}

const OPEN_REQUEST = ["PENDING", "DELIVERED", "AWAITING_PARENT"] as const;
const FAILING = { status: { in: ["WARNING", "ACTION_REQUIRED"] } } satisfies Prisma.DeviceProtectionWhereInput;

/**
 * Phones paired UNFINISHED_AFTER_DAYS ago or more (up to UNFINISHED_WITHIN_DAYS), online lately, where a protection the
 * parent set isn't working. Left out: a protection with a change still on its way (it's mid-change), and one with an
 * open alert (it worked and stopped, and the parents were told). Once per device.
 */
async function remindUnfinishedSetup(now: Date): Promise<Tally> {
  const devices = await db.device.findMany({
    where: {
      ...PHONES, setupNudgedAt: null,
      createdAt: { gte: new Date(now.getTime() - UNFINISHED_WITHIN_DAYS * DAY), lte: new Date(now.getTime() - UNFINISHED_AFTER_DAYS * DAY) },
      // A quiet phone gets the offline alert instead
      lastSeenAt: { gte: new Date(now.getTime() - 2 * DAY) },
      protections: { some: FAILING },
    },
    select: {
      id: true, name: true, platform: true, familyId: true,
      child: { select: { name: true } }, family: { select: { timezone: true } },
      protections: { where: FAILING, select: { key: true } },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  const t: Tally = { scanned: devices.length, due: 0, sent: 0, failed: 0 };
  for (const d of devices) {
    if (!inSendingHours(now, d.family.timezone)) continue;
    const keys = d.protections.map((p) => p.key);
    const [changing, alerted] = await Promise.all([
      db.configRequest.findMany({ where: { deviceId: d.id, key: { in: keys }, status: { in: [...OPEN_REQUEST] } }, select: { key: true } }),
      db.alert.findMany({ where: { familyId: d.familyId, resolvedAt: null, resolveKey: { in: keys.map((k) => `${k}:${d.id}`) } }, select: { resolveKey: true } }),
    ]);
    const skip = new Set<string>([...changing.map((r) => r.key), ...alerted.map((a) => (a.resolveKey ?? "").split(":")[0])]);
    const open = keys.filter((k) => !skip.has(k));
    // Nothing to tell now; looked at again next run (a change may still fail to apply)
    if (!open.length) continue;
    const claimed = await db.device.updateMany({ where: { id: d.id, setupNudgedAt: null }, data: { setupNudgedAt: now } });
    if (!claimed.count) continue;
    t.due++;
    await mailParents(d.familyId, t, (parent) =>
      unfinishedSetupEmail({ parent, child: d.child.name, deviceName: d.name, deviceId: d.id, platform: d.platform, keys: open }));
  }
  return t;
}

/**
 * The maintenance step: each sequence in turn, every family, child or device sent its next email when due. Returns
 * what each did, for console › System status.
 */
export async function sendSetupReminders(now = new Date()) {
  return {
    noChildren: await remindNoChildren(now),
    noDevices: await remindNoDevices(now),
    childLeftOut: await remindLeftOutChildren(now),
    browserNudge: await nudgeBrowsers(now),
    unfinishedSetup: await remindUnfinishedSetup(now),
  };
}
