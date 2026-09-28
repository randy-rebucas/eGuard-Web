import type { CheckStatus, Platform, PrismaClient, ProtectionKey, Prisma, Role } from "@prisma/client";
import { PROTECTIONS, defaultConfig, type ProtectionConfig } from "../src/lib/protections";

/**
 * The demo family (Mia, Lucas, Sophie and 5 devices) with two weeks of screen time, alerts and history.
 * Used by prisma/seed.ts (local development) and scripts/seed-demo.ts (store reviewers and testers).
 * Only creates rows; callers decide what, if anything, to delete first.
 */

const TZ = "Asia/Manila";
const H = 3600_000;

const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

type Kid = {
  name: string; age: number; hue: number;
  limit: number; weekend: number;
  todayApps: [string, number][];
  week: number[]; last: number[];
  apps: [string, Prisma.ChildAppCreateWithoutChildInput["approval"]][];
  devices: { name: string; model: string; kind: "PHONE" | "TABLET"; platform: Platform; os: string; battery: number | null; seenHoursAgo: number; loc?: [number, number, string] | "off" }[];
};

const KIDS: Kid[] = [
  {
    name: "Mia", age: 12, hue: 205, limit: 180, weekend: 240,
    todayApps: [["YouTube", 54], ["Roblox", 42], ["Chrome", 28], ["Others", 10]],
    week: [168, 142, 151, 139, 160, 187], last: [181, 160, 158, 170, 149, 202, 196],
    apps: [["YouTube", "ALLOWED"], ["Roblox", "ALLOWED"], ["Chrome", "FILTERED"], ["Google Classroom", "ALWAYS_ALLOWED"]],
    devices: [
      { name: "Galaxy A54", model: "SM-A546E", kind: "PHONE", platform: "ANDROID", os: "Android 14", battery: 72, seenHoursAgo: 0.3, loc: [14.6507, 121.0494, "Home"] },
      { name: "Galaxy Tab S6 Lite", model: "SM-P620", kind: "TABLET", platform: "ANDROID", os: "Android 13", battery: 48, seenHoursAgo: 0.9 },
    ],
  },
  {
    name: "Lucas", age: 9, hue: 160, limit: 120, weekend: 180,
    todayApps: [["YouTube Kids", 32], ["Minecraft", 21], ["Khan Academy Kids", 12]],
    week: [88, 62, 70, 58, 75, 120], last: [95, 70, 66, 72, 80, 118, 110],
    apps: [["YouTube Kids", "ALLOWED"], ["Minecraft", "ALLOWED"], ["Khan Academy Kids", "ALWAYS_ALLOWED"]],
    devices: [
      { name: "iPad 9th Gen", model: "iPad12,1", kind: "TABLET", platform: "IOS", os: "iPadOS 17", battery: 91, seenHoursAgo: 0.6, loc: [14.6545, 121.0685, "Riverside Park"] },
      { name: "Galaxy Tab A8", model: "SM-X200", kind: "TABLET", platform: "ANDROID", os: "Android 13", battery: null, seenHoursAgo: 72 },
    ],
  },
  {
    name: "Sophie", age: 14, hue: 330, limit: 210, weekend: 270,
    todayApps: [["Spotify", 58], ["Messages", 47], ["Safari", 36], ["Others", 20]],
    week: [192, 171, 166, 158, 180, 214], last: [175, 160, 170, 150, 172, 205, 198],
    apps: [["Spotify", "ALLOWED"], ["Messages", "ALWAYS_ALLOWED"], ["Safari", "FILTERED"], ["Instagram", "BLOCKED"]],
    devices: [
      { name: "iPhone 13", model: "iPhone14,5", kind: "PHONE", platform: "IOS", os: "iOS 17", battery: 64, seenHoursAgo: 0.4, loc: "off" },
    ],
  },
];

/** Splits a day's minutes over 7 AM – 9 PM, heavier after school. Sums to `total`. */
function spreadOverDay(total: number) {
  const weights = Array.from({ length: 24 }, (_, h): number => (h < 7 || h > 21 ? 0 : h >= 16 ? 3 : h >= 12 ? 1 : 2));
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((total * w) / sum));
  out[19] += total - out.reduce((a, b) => a + b, 0);
  return out;
}

function strip(c: ProtectionConfig): Record<string, unknown> {
  return Object.fromEntries(Object.entries(c).filter(([k]) => k !== "key"));
}

export type DemoParent = {
  email: string; name: string; role: Role; passwordHash: string;
  twoFactor?: boolean;
  /** Off for accounts whose inbox nobody reads, so the maintenance job doesn't email it */
  notifyEmail?: boolean;
};

export async function createDemoFamily(db: PrismaClient, { familyName, parents }: { familyName: string; parents: DemoParent[] }) {
  const today = new Date(`${dayKey(new Date())}T00:00:00.000Z`);
  const daysAgo = (n: number) => new Date(today.getTime() - n * 864e5);
  const ago = (ms: number) => new Date(Date.now() - ms);

  const family = await db.family.create({
    // On Family Pro so the demo shows every feature (several children, location, advanced reports)
    data: { name: familyName, timezone: TZ, plan: "Family Pro", deviceLimit: 20, renewsAt: null },
  });
  for (const p of parents) {
    await db.user.create({
      data: {
        familyId: family.id, email: p.email, name: p.name, passwordHash: p.passwordHash, role: p.role,
        twoFactor: p.twoFactor ?? false, notifyEmail: p.notifyEmail ?? true, emailVerifiedAt: new Date(),
      },
    });
  }
  const admin = parents[0].name;
  const other = parents[1] ? `${parents[1].name} (Parent)` : `${admin} (Family Admin)`;

  const ids: Record<string, { child: string; devices: string[] }> = {};

  for (const k of KIDS) {
    const child = await db.child.create({
      data: {
        familyId: family.id, name: k.name, birthYear: new Date().getFullYear() - k.age, hue: k.hue,
        dailyLimitMinutes: k.limit, weekendLimitMinutes: k.weekend,
        apps: { create: k.apps.map(([name, approval], i) => ({ name, approval, installedAt: name === "Roblox" ? ago(5 * H) : daysAgo(60 + i) })) },
      },
    });
    ids[k.name] = { child: child.id, devices: [] };

    // Policies (desired state)
    const policies: Record<string, ProtectionConfig> = {};
    for (const p of PROTECTIONS) {
      let cfg = defaultConfig(p.key, k.age);
      if (p.key === "SCREEN_TIME") cfg = { key: "SCREEN_TIME", dailyMinutes: k.limit, weekendMinutes: k.weekend };
      if (p.key === "BEDTIME" && k.name === "Sophie") cfg = { key: "BEDTIME", enabled: false, start: "22:00", end: "06:00", days: "EVERY_DAY" };
      if (p.key === "BEDTIME" && k.name === "Lucas") cfg = { key: "BEDTIME", enabled: true, start: "20:30", end: "07:00", days: "EVERY_DAY" };
      policies[p.key] = cfg;
      await db.childPolicy.create({ data: { childId: child.id, key: p.key, config: cfg as Prisma.InputJsonValue } });
    }

    for (const [i, d] of k.devices.entries()) {
      const seen = ago(d.seenHoursAgo * H);
      const dev = await db.device.create({
        data: {
          familyId: family.id, childId: child.id, name: d.name, model: d.model, kind: d.kind, platform: d.platform,
          osVersion: d.os, battery: d.battery, lastSeenAt: seen, isPrimary: i === 0, appVersion: "4.2.1",
          simulated: true, simulatedOnline: seen > ago(24 * H),
          createdAt: k.name === "Mia" && i === 1 ? ago(5 * 24 * H) : daysAgo(90),
        },
      });
      ids[k.name].devices.push(dev.id);

      for (const p of PROTECTIONS) {
        const cap = p.caps[d.platform];
        let reported: ProtectionConfig = policies[p.key];
        let status: CheckStatus = cap === "UNSUPPORTED" ? "UNSUPPORTED" : "PASS";
        let message: string | null = null;
        if (k.name === "Sophie" && p.key === "BEDTIME") { status = "NOT_CONFIGURED"; message = "Not configured on Sophie's iPhone 13"; }
        if (k.name === "Sophie" && p.key === "LOCATION") { reported = { key: "LOCATION", sharing: false }; status = "WARNING"; message = "Sharing turned off on Sophie's iPhone 13"; }
        await db.deviceProtection.create({
          data: {
            deviceId: dev.id, key: p.key as ProtectionKey, status, message,
            reported: { key: p.key, ...strip(reported) } as Prisma.InputJsonValue,
            lastVerifiedAt: seen,
          },
        });
      }

      if (d.loc) {
        await db.deviceLocation.create({
          data: d.loc === "off"
            ? { deviceId: dev.id, sharing: false }
            : { deviceId: dev.id, sharing: true, lat: d.loc[0], lng: d.loc[1], accuracyM: 25, placeLabel: d.loc[2], locatedAt: new Date(seen.getTime() - 10 * 60_000) },
        });
      }
    }

    // Screen time: 13 previous days + today
    const todayTotal = k.todayApps.reduce((s, [, m]) => s + m, 0);
    const series = [...k.last, ...k.week, todayTotal]; // 7 + 6 + 1 = 14
    for (let i = 0; i < 14; i++) {
      const date = daysAgo(13 - i);
      const total = series[i];
      const devs = ids[k.name].devices;
      const share = devs.length > 1 && !(k.name === "Lucas" && i >= 11) ? 0.8 : 1; // Lucas's tablet offline since 3 days
      const main = Math.round(total * share), rest = total - main;
      // Today's rows carry an hourly breakdown (for the app's Screen Time chart)
      const hourly = (m: number) => (i === 13 ? spreadOverDay(m) : []);
      await db.screenTimeDaily.create({ data: { childId: child.id, deviceId: devs[0], date, minutes: main, hourly: hourly(main) } });
      if (share < 1) await db.screenTimeDaily.create({ data: { childId: child.id, deviceId: devs[1], date, minutes: rest, hourly: hourly(rest) } });
      for (const [app, m] of k.todayApps) {
        await db.appUsageDaily.create({ data: { childId: child.id, deviceId: devs[0], date, app, minutes: Math.round((m / todayTotal) * total) } });
      }
    }
  }

  const mia = ids.Mia, lucas = ids.Lucas, sophie = ids.Sophie;
  const alerts: Prisma.AlertCreateManyInput[] = [
    { familyId: family.id, childId: sophie.child, deviceId: sophie.devices[0], severity: "ATTENTION", category: "PROTECTION", icon: "moon",
      title: "Bedtime not configured", body: "No bedtime schedule is set on this device. Other protections are working.",
      subject: "Sophie's iPhone 13", resolveKey: `BEDTIME:${sophie.devices[0]}`, createdAt: ago(2 * H) },
    { familyId: family.id, childId: mia.child, deviceId: mia.devices[0], severity: "INFO", category: "APPS", icon: "layout-grid",
      title: "New app installed", body: "Roblox was approved and installed. Rated 13+ with parental controls on.",
      subject: "Roblox · Mia's Galaxy A54", createdAt: ago(5 * H) },
    { familyId: family.id, childId: lucas.child, deviceId: lucas.devices[0], severity: "INFO", category: "SCREEN_TIME", icon: "hourglass",
      title: "Screen time limit reached", body: "Lucas reached his 2 hour daily limit. Apps were paused as scheduled.",
      subject: "Lucas's iPad 9th Gen", createdAt: ago(20 * H) },
    { familyId: family.id, childId: sophie.child, deviceId: sophie.devices[0], severity: "ACTION_REQUIRED", category: "LOCATION", icon: "map-pin-off",
      title: "Location sharing turned off", body: "Location sharing was switched off on the device. iOS needs a guided setup to turn it back on.",
      subject: "Sophie's iPhone 13", resolveKey: `LOCATION:${sophie.devices[0]}`, createdAt: ago(24 * H) },
    { familyId: family.id, childId: lucas.child, deviceId: lucas.devices[1], severity: "ATTENTION", category: "DEVICES", icon: "wifi-off",
      title: "Device hasn't synced in over a day", body: "Settings stay active offline, but eGuard can't verify them until the device reconnects.",
      subject: "Lucas's Galaxy Tab A8", resolveKey: `OFFLINE:${lucas.devices[1]}`, createdAt: ago(48 * H) },
    { familyId: family.id, childId: mia.child, deviceId: mia.devices[0], severity: "ACTION_REQUIRED", category: "PROTECTION", icon: "shield-alert",
      title: "Protection setting changed", body: `Weekend bedtime was changed on the device by ${other}.`,
      subject: "Mia's Galaxy A54", fromValue: "9:30 PM – 6:00 AM", toValue: "10:30 PM – 6:30 AM", createdAt: ago(50 * H) },
    { familyId: family.id, childId: mia.child, deviceId: mia.devices[1], severity: "INFO", category: "DEVICES", icon: "refresh-cw",
      title: "New device synchronized", body: "Galaxy Tab S6 Lite joined your family and passed its first configuration check.",
      subject: "Mia's Galaxy Tab S6 Lite", createdAt: ago(5 * 24 * H) },
    { familyId: family.id, severity: "INFO", category: "SYSTEM", icon: "crown",
      title: "Welcome to Family Pro", body: "Your family can now protect up to 10 children on 20 devices.", subject: "Subscription", createdAt: ago(5 * 24 * H + 3 * H) },
  ];
  await db.alert.createMany({ data: alerts });

  await db.configChange.createMany({
    data: [
      { familyId: family.id, childId: mia.child, key: "BEDTIME", title: "Weekend bedtime changed", actor: `${other} on Galaxy A54`,
        fromValue: "9:30 PM – 6:00 AM", toValue: "10:30 PM – 6:30 AM", createdAt: ago(50 * H) },
      { familyId: family.id, childId: mia.child, key: "APP_APPROVAL", title: "Roblox approved", actor: `${admin} on web`, createdAt: ago(5.5 * H) },
      { familyId: family.id, childId: lucas.child, key: "SCREEN_TIME", title: "Daily limit changed", actor: `${admin} on web`,
        fromValue: "1h 30m / day", toValue: "2h / day", createdAt: ago(4 * 24 * H) },
      { familyId: family.id, childId: sophie.child, key: "LOCATION", title: "Location sharing turned off", actor: "Changed on iPhone 13",
        fromValue: "Sharing", toValue: "Sharing off", createdAt: ago(24 * H) },
      { familyId: family.id, childId: mia.child, key: "UNINSTALL_PROTECTION", title: "Galaxy Tab S6 Lite added", actor: `${admin} via eGuard Android app`,
        createdAt: ago(5 * 24 * H) },
    ],
  });

  return family;
}
