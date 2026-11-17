import "server-only";
import { STORE_LINKS } from "@/components/brand-marks";
import { db } from "./db";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";
import { localMinute } from "./parent-care/schedule";

/**
 * Setup reminders: a family with nothing paired has nothing protected, and the in-app banner only reaches them if they
 * come back. The maintenance job emails two sequences, each up to STEPS.length times and then never again:
 * - no children yet (Family.childReminders): add your child, then connect their phone and browser. Adding a child ends it.
 * - children but no paired device (Family.setupReminders): the steps to pair the phone and add the browser extension.
 *   Pairing any device ends it. A family that finishes the first sequence by adding a child then gets this one.
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

/** Whether the family's next reminder should go now. Pure, so it's tested without a database. */
export function reminderDue(s: ReminderState, now = new Date()) {
  if (s.sent >= STEPS.length) return false;
  const age = now.getTime() - s.since.getTime();
  if (age < STEPS[s.sent] * DAY) return false;
  if (s.sent === 0 && age > START_WITHIN_DAYS * DAY) return false;
  // A family found late (this shipped after their sequence started) still gets the steps spaced out, not all at once
  if (s.sent > 0 && s.lastAt && now.getTime() - s.lastAt.getTime() < (STEPS[s.sent] - STEPS[s.sent - 1]) * DAY) return false;
  const m = localMinute(now, s.timezone);
  return m >= SEND_FROM && m < SEND_UNTIL;
}

/** "Mia", "Mia and Leo", "Mia, Leo and Sam" */
export function nameList(names: string[]) {
  if (names.length <= 1) return names[0] ?? "your child";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>`;
const link = (href: string, label: string) => `<a href="${href}" style="color:#1a73e8">${escapeHtml(label)}</a>`;

/**
 * The email for reminder `step` (0-based). The steps match the in-app guide (components/connect-guide), so keep them
 * in step when the child apps' buttons change. `hasBrowser`: an extension is already connected, so it's acknowledged
 * rather than asked for again.
 */
export function setupReminderEmail(o: { step: number; parent: string; children: string[]; hasBrowser: boolean }) {
  const base = appUrl();
  const kids = nameList(o.children);
  const one = o.children.length === 1;
  const their = one ? `${kids}'s` : "your children's";
  const them = one ? kids : "your children";
  const phone = one ? "phone" : "phones", device = one ? "phone or tablet" : "phones or tablets";
  const hi = o.parent ? `Hi ${o.parent},` : "Hi,";
  const pair = `${base}/devices#pair`, addBrowser = `${base}/devices#add-browser`, guide = `${base}/how-it-works#setup`;

  const subject = [
    `Finish setting up eGuard: connect ${their} ${phone}`,
    `${kids} ${one ? "isn't" : "aren't"} protected yet`,
    `Last reminder: ${their} devices still need eGuard`,
  ][o.step] ?? `Connect ${their} ${phone} to eGuard`;

  const intro = [
    `You added ${kids} to eGuard, but no device is connected yet, so nothing is protected so far. It takes about 5 minutes. Here's how.`,
    `${kids} ${one ? "is" : "are"} set up in eGuard, but ${their} ${one ? "phone isn't" : "phones aren't"} connected yet. Until then, screen time limits, app approvals and web filtering can't do anything. Keep the ${phone} nearby and on Wi-Fi, and follow these steps.`,
    `This is our last reminder. ${kids} ${one ? "has" : "have"} no device connected to eGuard, so ${their} ${phone} and ${one ? "browser aren't" : "browsers aren't"} protected. When you're ready, it takes about 5 minutes.`,
  ][o.step] ?? `You added ${kids} to eGuard, but no device is connected yet.`;

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
  const why = `You get this because "Email alerts" is on in Settings › Notifications. These reminders stop once a device is connected.`;

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

  const ol = (steps: string[]) => `<ol style="padding-left:20px;margin:8px 0">${steps.map((s) => `<li style="margin-bottom:6px">${escapeHtml(s)}</li>`).join("")}</ol>`;
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

type Tally = { families: number; due: number; sent: number; failed: number };

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

/** Families with no children: the "add your child" sequence, timed from when the family was created */
async function remindNoChildren(now: Date): Promise<Tally> {
  const families = await db.family.findMany({
    where: {
      childReminders: { lt: STEPS.length }, children: { none: {} },
      // Old accounts are never started (reminderDue), so they needn't be scanned; 30 days' slack lets a started one finish
      createdAt: { gte: new Date(now.getTime() - (START_WITHIN_DAYS + 30) * DAY) },
    },
    select: { id: true, timezone: true, createdAt: true, childReminders: true, childRemindedAt: true },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  const t: Tally = { families: families.length, due: 0, sent: 0, failed: 0 };
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
    where: { setupReminders: { lt: STEPS.length }, children: { some: {} }, devices: { none: {} } },
    select: {
      id: true, timezone: true, setupReminders: true, setupRemindedAt: true,
      children: { select: { name: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      // Connected and reporting, not just paired: an unfinished pairing is removed after a day
      browsers: { where: { revokedAt: null, lastHealthAt: { not: null } }, select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  const t: Tally = { families: families.length, due: 0, sent: 0, failed: 0 };
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
 * The maintenance step: families with no children, then families with children but no paired device, each sent its
 * next reminder when due. Returns what it did, for console › System status.
 */
export async function sendSetupReminders(now = new Date()) {
  return { noChildren: await remindNoChildren(now), noDevices: await remindNoDevices(now) };
}
