import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PASSWORD, RUN, applyAndReport, call, cleanup, db, email, pairDevice, verificationToken, verifyInbox } from "./helpers";

/**
 * End-to-end tests of the parent mobile API, screen by screen from public/ios.png.
 * Each run registers its own families and deletes them afterwards.
 */

let token = ""; // Randy (family admin)
let miaId = "";
let android: Awaited<ReturnType<typeof pairDevice>>;

afterAll(cleanup);

describe("public endpoints", () => {
  it("app info reports API version and which sign-in methods are available", async () => {
    const r = await call("GET", "/app-info");
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ apiVersion: "1", signIn: { password: true } });
  });

  it("help & support lists categories, searches and opens articles", async () => {
    const all = await call("GET", "/help");
    expect(all.data.categories.map((c: { id: string }) => c.id)).toEqual(["SETUP", "TROUBLESHOOTING", "PRIVACY", "FAQ"]);
    const hit = await call("GET", "/help?q=offline");
    expect(hit.data.articles.map((a: { slug: string }) => a.slug)).toContain("device-offline");
    const art = await call("GET", "/help/device-offline");
    expect(art.data.body.length).toBeGreaterThan(0);
    expect((await call("GET", "/help/nope")).status).toBe(404);
    expect((await call("GET", "/help?category=BOGUS")).status).toBe(400);
  });
});

describe("3. Create account / sign in", () => {
  it("registers a family from name, email, password and the parent/guardian confirmation", async () => {
    const r = await call("POST", "/auth/register", { body: { name: "Randy Cruz", email: email("randy"), password: PASSWORD, guardian: true } });
    expect(r.status).toBe(201);
    expect(r.data.token).toBeTruthy();
    expect(r.data.user).toMatchObject({ name: "Randy Cruz", firstName: "Randy", role: "FAMILY_ADMIN", family: { name: "Cruz Family" } });
    token = r.data.token;
    const log = await db.auditLog.findFirst({ where: { familyId: r.data.user.family.id, action: "account.created" } });
    expect(log?.detail).toMatch(/parent or legal guardian/);
  });

  it("only parents and guardians can sign up", async () => {
    for (const guardian of [undefined, false, "true", 1]) {
      const kid = email(`kid${String(guardian)}`);
      const r = await call("POST", "/auth/register", { body: { name: "Kid Cruz", email: kid, password: PASSWORD, guardian } });
      expect(r.status).toBe(400);
      expect(r.data.error).toMatch(/^guardian: .*parent or legal guardian/);
      expect(await db.user.count({ where: { email: kid } })).toBe(0);
    }
  });

  it("ignores a role in the body: a new account is always the family admin", async () => {
    const r = await call("POST", "/auth/register", { body: { name: "Rhea Cruz", email: email("rhea"), password: PASSWORD, guardian: true, role: "CHILD" } });
    expect(r.status).toBe(201);
    expect(r.data.user.role).toBe("FAMILY_ADMIN");
  });

  it("rejects a duplicate email, in any case or padding, and explains invalid fields", async () => {
    for (const e of [email("randy"), email("randy").toUpperCase(), `  ${email("randy")} `]) {
      const dup = await call("POST", "/auth/register", { body: { name: "Randy Cruz", email: e, password: PASSWORD, guardian: true } });
      expect(dup.status).toBe(409);
      expect(dup.data.code).toBe("conflict");
    }
    const bad = await call("POST", "/auth/register", { body: { name: "Randy", email: "nope", password: "short" } });
    expect(bad.status).toBe(400);
    expect(bad.data.error).toMatch(/^email: /);
    const notJson = await call("POST", "/auth/register", { raw: "{oops", headers: { "content-type": "application/json" } });
    expect(notJson.data.code).toBe("invalid_json");
  });

  it("rejects another spelling of the same mailbox: +tags, and dots or googlemail for Gmail", async () => {
    const gmail = `qa.${RUN}@gmail.com`;
    const first = await call("POST", "/auth/register", { body: { name: "Gia Cruz", email: gmail, password: PASSWORD, guardian: true } });
    expect(first.status).toBe(201);
    for (const alias of [`qa${RUN}@gmail.com`, `q.a.${RUN}+kids@googlemail.com`, email("randy").replace("@", "+second@")]) {
      const r = await call("POST", "/auth/register", { body: { name: "Alias", email: alias, password: PASSWORD, guardian: true } });
      expect(r.status, alias).toBe(409);
    }
    // Changing your email to someone else's alias is caught too
    const moved = await call("PATCH", "/me", { token: first.data.token, body: { email: email("randy").replace("@", "+x@") } });
    expect(moved.status).toBe(409);
    await db.family.delete({ where: { id: first.data.user.family.id } });
  });

  it("a double-tapped Create Account makes exactly one account; the rest get 409, never 500", async () => {
    const body = { name: "Double Tap", email: email("double"), password: PASSWORD, guardian: true };
    const results = await Promise.all(Array.from({ length: 8 }, () => call("POST", "/auth/register", { body })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409, 409, 409]);
    expect(await db.user.count({ where: { email: email("double") } })).toBe(1);
    expect(await db.family.count({ where: { users: { none: {} } } })).toBe(0);
  });

  it("signs in with the right password only", async () => {
    expect((await call("POST", "/auth/login", { body: { email: email("randy"), password: "wrong-password" } })).status).toBe(401);
    const ok = await call("POST", "/auth/login", { body: { email: email("randy").toUpperCase(), password: PASSWORD } });
    expect(ok.status).toBe(200);
    expect(ok.data.user.email).toBe(email("randy"));
  });

  it("requires a valid bearer token", async () => {
    expect((await call("GET", "/me")).status).toBe(401);
    expect((await call("GET", "/me", { token: "not-a-real-token" })).status).toBe(401);
    expect((await call("GET", "/me", { token })).data.email).toBe(email("randy"));
  });

  it("reports social sign-in as not set up when no client ids are configured", async () => {
    const r = await call("POST", "/auth/social", { body: { provider: "apple", idToken: "a".repeat(40) } });
    expect([401, 501]).toContain(r.status); // 501 unless APPLE_CLIENT_IDS is set on the server
  });

  it("logout ends only that session", async () => {
    const other = await call("POST", "/auth/login", { body: { email: email("randy"), password: PASSWORD } });
    expect((await call("POST", "/auth/logout", { token: other.data.token })).status).toBe(200);
    expect((await call("GET", "/me", { token: other.data.token })).status).toBe(401);
    expect((await call("GET", "/me", { token })).status).toBe(200);
  });
});

describe("3b. Verify email", () => {
  let kidId = "";
  // Free covers one child: make sure Pip is gone before section 4 adds Mia, even if a test below fails
  afterAll(async () => { if (kidId) await db.child.deleteMany({ where: { id: kidId } }); });

  it("a new parent starts unverified and can't pair a device yet", async () => {
    expect((await call("GET", "/me", { token })).data.emailVerified).toBe(false);
    kidId = (await call("POST", "/children", { token, body: { name: "Pip", age: 9 } })).data.id;
    const code = await call("POST", `/children/${kidId}/pairing-code`, { token });
    expect(code.status).toBe(403);
    expect(code.data.code).toBe("email_unverified");
  });

  it("the emailed link verifies once, then unlocks pairing", async () => {
    const t = await verificationToken(email("randy"));
    expect((await call("POST", "/auth/verify-email", { body: { token: t } })).status).toBe(200);
    const again = await call("POST", "/auth/verify-email", { body: { token: t } });
    expect(again.data.code).toBe("link_invalid");
    expect((await call("GET", "/me", { token })).data.emailVerified).toBe(true);
    expect((await call("POST", `/children/${kidId}/pairing-code`, { token })).status).toBe(201);
    expect((await call("POST", "/me/verify-email", { token })).data.sent).toBe(false);
    await call("DELETE", `/children/${kidId}`, { token, body: { password: PASSWORD } });
  });

  it("resending replaces the old link, and is limited to once a minute", async () => {
    const r = await call("POST", "/auth/register", { body: { name: "Rex Cruz", email: email("rex"), password: PASSWORD, guardian: true } });
    const first = await verificationToken(email("rex"));
    const sentAt = Date.now() - 1000;
    await db.emailVerification.updateMany({ where: { user: { email: email("rex") } }, data: { createdAt: new Date(Date.now() - 120_000) } });
    expect((await call("POST", "/me/verify-email", { token: r.data.token })).status).toBe(202);
    const limited = await call("POST", "/me/verify-email", { token: r.data.token });
    expect(limited.status).toBe(429);
    const second = await verificationToken(email("rex"), { after: sentAt });
    expect(second).not.toBe(first);
    expect((await call("POST", "/auth/verify-email", { body: { token: first } })).data.code).toBe("link_invalid");
    // An expired link says so
    await db.emailVerification.updateMany({ where: { user: { email: email("rex") } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call("POST", "/auth/verify-email", { body: { token: second } })).data.code).toBe("link_expired");
  });

  it("changing email needs verifying again, and old links stop working", async () => {
    const r = await call("POST", "/auth/register", { body: { name: "Moe Cruz", email: email("moe"), password: PASSWORD, guardian: true } });
    const oldLink = await verificationToken(email("moe"));
    await verifyInbox(email("moe"));
    // Moving the account to another address needs the password
    expect((await call("PATCH", "/me", { token: r.data.token, body: { email: email("moe2") } })).data.code).toBe("wrong_password");
    expect((await call("PATCH", "/me", { token: r.data.token, body: { email: email("moe2"), password: "not-it-at-all" } })).status).toBe(403);
    const moved = await call("PATCH", "/me", { token: r.data.token, body: { email: email("moe2"), password: PASSWORD } });
    expect(moved.data).toMatchObject({ email: email("moe2"), emailVerified: false });
    expect((await call("POST", "/auth/verify-email", { body: { token: oldLink } })).data.code).toBe("link_invalid");
    await verifyInbox(email("moe2"));
    expect((await call("GET", "/me", { token: r.data.token })).data.emailVerified).toBe(true);
  });

  it("rejects missing or made-up tokens", async () => {
    expect((await call("POST", "/auth/verify-email", { body: {} })).status).toBe(400);
    expect((await call("POST", "/auth/verify-email", { body: { token: "made-up-token" } })).data.code).toBe("link_invalid");
  });
});

describe("4–6. Add child, protection profile, recommended setup", () => {
  it("adds a child by age", async () => {
    const r = await call("POST", "/children", { token, body: { name: "Mia", age: 12 } });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ name: "Mia", age: 12, status: "notconfigured", deviceCount: 0, photoUrl: null, dailyLimitMinutes: 180 });
    miaId = r.data.id;
    expect((await call("POST", "/children", { token, body: { name: "Old", age: 19 } })).status).toBe(400);
    expect((await call("POST", "/children", { token, body: { name: "NoAge" } })).data.error).toMatch(/age/);
  });

  it("Free covers one child and no location; the rest of this flow runs on eGuard Plus", async () => {
    const second = await call("POST", "/children", { token, body: { name: "Leo", age: 8 } });
    expect(second.status).toBe(409);
    expect(second.data).toMatchObject({ code: "plan_limit", error: expect.stringContaining("Upgrade to eGuard Plus") });
    const loc = await call("GET", "/locations", { token });
    expect(loc.status).toBe(403);
    expect(loc.data.code).toBe("plan_required");
    const fam = (await call("GET", "/family", { token })).data;
    expect(fam).toMatchObject({ plan: "Free", childCount: 1, childLimit: 1, entitlements: { locationSharing: false, appMonitoringLimit: 5 } });
    // As if the family bought Plus (purchases themselves are covered in billing.test.ts and web-billing.test.ts)
    await db.family.update({ where: { id: fam.id }, data: { plan: "eGuard Plus", deviceLimit: 10 } });
  });

  it("offers profiles with Protected recommended for a 12 year old", async () => {
    const r = await call("GET", "/profiles?age=12", { token });
    expect(r.data.profiles.find((p: { recommended: boolean }) => p.recommended).id).toBe("PROTECTED");
  });

  it("recommends settings for the child's age", async () => {
    const r = await call("GET", `/children/${miaId}/recommendations`, { token });
    expect(r.data.profile).toBe("PROTECTED");
    expect(r.data.settings).toHaveLength(10);
    const bed = r.data.settings.find((s: { key: string }) => s.key === "BEDTIME");
    expect(bed.label).toBe("9:30 PM – 6:00 AM");
    const balanced = await call("GET", `/children/${miaId}/recommendations?profile=BALANCED`, { token });
    expect(balanced.data.settings.find((s: { key: string }) => s.key === "SCREEN_TIME").config.dailyMinutes).toBe(240);
  });

  it("with no device yet, setup saves the policy directly (nothing to verify)", async () => {
    const r = await call("POST", `/children/${miaId}/setup`, { token, body: { profile: "BALANCED" } });
    expect(r.status).toBe(201);
    expect(r.data.batchId).toBeNull();
    expect(r.data.saved).toHaveLength(10);
    const p = await call("GET", `/children/${miaId}/protections`, { token });
    expect(p.data.protections.find((x: { key: string }) => x.key === "SCREEN_TIME").policy.dailyMinutes).toBe(240);
    const kid = await call("GET", `/children/${miaId}`, { token });
    expect(kid.data.child.dailyLimitMinutes).toBe(240);
  });
});

describe("7–9. Pair a device, setup progress, configuration health", () => {
  beforeAll(async () => {
    android = await pairDevice(token, miaId, "ANDROID", "Galaxy A54");
  });

  it("a newly paired device gets the policy and a full-report request", async () => {
    const sync = await applyAndReport(android.send);
    expect(sync.fullReportRequested).toBe(true);
    expect(sync.policy).toHaveLength(10);
    const h = await call("GET", `/health?childId=${miaId}`, { token });
    expect(h.data).toMatchObject({ score: 10, total: 10, label: "Fully protected", toFix: [] });
  });

  it("Review & Configure sends the whole profile as one batch, verified by the device", async () => {
    const r = await call("POST", `/children/${miaId}/setup`, {
      token, body: { profile: "PROTECTED", overrides: [{ key: "SCREEN_TIME", dailyMinutes: 150, weekendMinutes: 200 }] },
    });
    expect(r.status).toBe(201);
    expect(r.data.requested).toHaveLength(10);
    expect(r.data.progress.summary).toMatchObject({ total: 10, verified: 0, inProgress: 10 });
    const batchId = r.data.batchId;

    // Nothing is reported as done before the device answers
    expect((await call("GET", `/batches/${batchId}`, { token })).data.done).toBe(false);
    await applyAndReport(android.send);
    const done = await call("GET", `/batches/${batchId}`, { token });
    expect(done.data).toMatchObject({ done: true, summary: { verified: 10, failed: 0 }, health: { score: 10 } });

    const kid = await call("GET", `/children/${miaId}`, { token });
    expect(kid.data.child.dailyLimitMinutes).toBe(150); // mirrors the verified Screen Time policy
    expect(kid.data.bedtime).toMatchObject({ enabled: true, start: "21:30", label: "9:30 PM – 6:00 AM" });
  });

  it("changing one protection is verified per device and lands in history", async () => {
    const r = await call("PUT", `/children/${miaId}/protections/bedtime`, { token, body: { enabled: true, start: "21:00", end: "06:30", days: "SCHOOL_NIGHTS" } });
    expect(r.status).toBe(202);
    expect(r.data.items[0]).toMatchObject({ key: "BEDTIME", status: "PENDING", to: "9:00 PM – 6:30 AM" });
    await applyAndReport(android.send);
    const b = await call("GET", `/batches/${r.data.batchId}`, { token });
    expect(b.data.items[0].status).toBe("VERIFIED");
    const hist = await call("GET", `/children/${miaId}/history`, { token });
    expect(hist.data.changes[0]).toMatchObject({ key: "BEDTIME", title: "Bedtime updated", toValue: "9:00 PM – 6:30 AM" });
    expect(hist.data.changes[0].actor).toMatch(/Randy Cruz on iOS app · verified on Galaxy A54/);
  });

  it("marks a change FAILED when the device reports something else", async () => {
    const r = await call("PUT", `/children/${miaId}/protections/CONTENT`, { token, body: { maxAgeRating: 9 } });
    await android.send("/sync");
    await android.send("/report", { protections: [{ key: "CONTENT", config: { maxAgeRating: 13 } }] });
    const b = await call("GET", `/batches/${r.data.batchId}`, { token });
    expect(b.data.items[0]).toMatchObject({ status: "FAILED" });
    expect(b.data.items[0].devices[0].failureReason).toMatch(/Rated 13\+/);
    const h = await call("GET", `/health?childId=${miaId}`, { token });
    expect(h.data.toFix).toEqual([expect.objectContaining({ key: "CONTENT", childId: miaId, deviceId: android.deviceId })]);
  });

  it("validates protection configs", async () => {
    expect((await call("PUT", `/children/${miaId}/protections/BEDTIME`, { token, body: { enabled: true, start: "9pm" } })).status).toBe(400);
    expect((await call("PUT", `/children/${miaId}/protections/NOPE`, { token, body: {} })).status).toBe(400);
    expect((await call("PUT", `/children/${miaId}/protections/SCREEN_TIME`, { token, body: { dailyMinutes: 5, weekendMinutes: 60 } })).status).toBe(400);
  });

  it("cancels a batch that hasn't been verified", async () => {
    const r = await call("PUT", `/children/${miaId}/protections/LOCATION`, { token, body: { sharing: true } });
    const c = await call("DELETE", `/batches/${r.data.batchId}`, { token });
    expect(c.data.cancelled).toBe(1);
    expect((await call("GET", `/batches/${r.data.batchId}`, { token })).data).toMatchObject({ done: true, summary: { cancelled: 1 } });
  });

  it("iOS guided setup waits for the parent, then verifies", async () => {
    const leo = await call("POST", "/children", { token, body: { name: "Leo", age: 8 } });
    const ipad = await pairDevice(token, leo.data.id, "IOS", "iPad");
    await applyAndReport(ipad.send);

    const r = await call("PUT", `/children/${leo.data.id}/protections/WEB`, { token, body: { mode: "FILTER", blockedSites: 50 } });
    expect(r.data.items[0].status).toBe("AWAITING_PARENT");
    expect(r.data.items[0].devices[0].guide.length).toBeGreaterThan(0);

    const confirm = await call("POST", `/batches/${r.data.batchId}/confirm`, { token });
    expect(confirm.data.confirmed).toBe(1);
    expect(confirm.data.items[0].status).toBe("DELIVERED");
    await ipad.send("/report", { protections: [{ key: "WEB", config: { mode: "FILTER", blockedSites: 50 } }], full: false });
    expect((await call("GET", `/batches/${r.data.batchId}`, { token })).data.items[0].status).toBe("VERIFIED");

    // Notification controls don't exist on iOS: a single change is refused, not silently "done"
    const n = await call("PUT", `/children/${leo.data.id}/protections/NOTIFICATIONS`, { token, body: { quietDuringBedtime: true } });
    expect(n.status).toBe(409);
  });
});

describe("10–11. Dashboard and child profile", () => {
  it("dashboard has greeting, family score, children and alerts", async () => {
    const r = await call("GET", "/dashboard", { token });
    expect(r.status).toBe(200);
    expect(r.data.user.firstName).toBe("Randy");
    expect(r.data.greeting).toMatch(/^Good (morning|afternoon|evening),$/);
    expect(r.data.health).toMatchObject({ total: 10 });
    expect(r.data.children.map((c: { name: string }) => c.name)).toEqual(["Mia", "Leo"]);
    expect(Array.isArray(r.data.recentAlerts)).toBe(true);
    expect(typeof r.data.unreadAlerts).toBe("number");
  });

  it("child overview covers screen time, apps, bedtime, location and device protection", async () => {
    const r = await call("GET", `/children/${miaId}`, { token });
    expect(Object.keys(r.data)).toEqual(expect.arrayContaining(["child", "health", "today", "bedtime", "location", "deviceProtection", "devices", "recentChanges"]));
    expect(r.data.devices[0]).toMatchObject({ name: "Galaxy A54", platform: "ANDROID", state: expect.any(String) });
  });

  it("renames a child and changes their age", async () => {
    const r = await call("PATCH", `/children/${miaId}`, { token, body: { name: "Mia Cruz", age: 11 } });
    expect(r.data.child).toMatchObject({ name: "Mia Cruz", age: 11 });
    await call("PATCH", `/children/${miaId}`, { token, body: { name: "Mia", age: 12 } });
  });
});

describe("12. Screen time", () => {
  it("returns today's total, limit, 24-hour breakdown and apps", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const hourly = Array(24).fill(0);
    hourly[8] = 30; hourly[16] = 44; hourly[19] = 60;
    const u = await android.send("/usage", { date: today, totalMinutes: 134, hourly, apps: [{ name: "YouTube", minutes: 54 }, { name: "Roblox", minutes: 42 }] });
    expect(u.status).toBe(200);

    const r = await call("GET", `/children/${miaId}/screen-time?period=today`, { token });
    expect(r.data).toMatchObject({ period: "today", totalMinutes: 134, from: today, to: today });
    expect(r.data.hourly[16]).toBe(44);
    expect(r.data.apps[0]).toMatchObject({ name: "YouTube", minutes: 54 });
    expect([150, 200]).toContain(r.data.limitMinutes); // weekday or weekend limit
  });

  it("returns a daily series for 7 and 30 days", async () => {
    const w = await call("GET", `/children/${miaId}/screen-time?period=7d`, { token });
    expect(w.data.days).toHaveLength(7);
    expect(w.data.hourly).toBeNull();
    expect(w.data.days[6].minutes).toBe(134);
    expect((await call("GET", `/children/${miaId}/screen-time?period=30d`, { token })).data.days).toHaveLength(30);
    expect((await call("GET", `/children/${miaId}/screen-time?period=year`, { token })).status).toBe(400);
  });
});

describe("13. App management", () => {
  let tiktok = "";

  it("shows an app the child asked for as pending, with an alert", async () => {
    await android.send("/events", { type: "APP_REQUESTED", app: "TikTok" });
    const r = await call("GET", `/children/${miaId}/apps?filter=pending`, { token });
    expect(r.data.apps).toEqual([expect.objectContaining({ name: "TikTok", approval: "PENDING", allowed: false })]);
    tiktok = r.data.apps[0].id;
    const alerts = await call("GET", "/alerts?filter=APPS", { token });
    expect(alerts.data.alerts[0]).toMatchObject({ title: "App approval requested", action: { type: "REVIEW_APPS", childId: miaId } });
  });

  it("blocking it resolves the request and moves it to Blocked", async () => {
    const r = await call("PATCH", `/apps/${tiktok}`, { token, body: { approval: "BLOCKED" } });
    expect(r.data).toMatchObject({ approval: "BLOCKED", approvalLabel: "Blocked" });
    const blocked = await call("GET", `/children/${miaId}/apps?filter=blocked`, { token });
    expect(blocked.data.apps.map((a: { name: string }) => a.name)).toEqual(["TikTok"]);
    expect(blocked.data.counts).toMatchObject({ blocked: 1, pending: 0 });
    const alerts = await call("GET", "/alerts?filter=APPS", { token });
    expect(alerts.data.alerts.find((a: { title: string }) => a.title === "App approval requested")).toBeUndefined();
  });

  it("parent can add an app ahead of time and set a daily limit the device receives", async () => {
    const r = await call("POST", `/children/${miaId}/apps`, { token, body: { name: "Khan Academy", approval: "ALWAYS_ALLOWED" } });
    expect(r.status).toBe(201);
    expect((await call("POST", `/children/${miaId}/apps`, { token, body: { name: "Khan Academy" } })).status).toBe(409);
    const lim = await call("PATCH", `/apps/${r.data.id}`, { token, body: { dailyLimitMinutes: 60 } });
    expect(lim.data.dailyLimitMinutes).toBe(60);
    const sync = await android.send("/sync");
    expect(sync.data.apps).toEqual(expect.arrayContaining([{ name: "Khan Academy", approval: "ALWAYS_ALLOWED", dailyLimitMinutes: 60 }]));
    expect((await call("PATCH", `/apps/${r.data.id}`, { token, body: {} })).status).toBe(400);
  });
});

describe("14. Location", () => {
  it("shows only the current location while history is off", async () => {
    await android.send("/location", { lat: 11.2800, lng: 125.0600, placeLabel: "Home" });
    const r = await call("GET", `/children/${miaId}/location`, { token });
    expect(r.data).toMatchObject({ sharing: true, current: { placeLabel: "Home" }, history: { enabled: false, visits: [] } });
  });

  it("records visits once the admin turns on location history", async () => {
    const p = await call("PATCH", "/family/privacy", { token, body: { keepLocationHistory: true } });
    expect(p.data.keepLocationHistory).toBe(true);
    await android.send("/location", { lat: 11.2800, lng: 125.0600, placeLabel: "Home" });
    await android.send("/location", { lat: 11.2801, lng: 125.0601, placeLabel: "Home" }); // same place, extends the visit
    await android.send("/location", { lat: 11.2900, lng: 125.0700, placeLabel: "Babatngon Central School" });
    const r = await call("GET", `/children/${miaId}/location`, { token });
    expect(r.data.current.placeLabel).toBe("Babatngon Central School");
    expect(r.data.history.visits.map((v: { placeLabel: string }) => v.placeLabel)).toEqual(["Babatngon Central School", "Home"]);
    expect(r.data.history.visits[0].day.label).toBe("Today");

    const fam = await call("GET", "/locations", { token });
    expect(fam.data.children.find((c: { childId: string }) => c.childId === miaId)).toMatchObject({ state: "located" });
  });

  it("turning history off deletes the visits", async () => {
    await call("PATCH", "/family/privacy", { token, body: { keepLocationHistory: false } });
    expect(await db.locationVisit.count({ where: { childId: miaId } })).toBe(0);
  });
});

describe("15. Alerts", () => {
  it("filters, marks read and dismisses", async () => {
    await android.send("/events", { type: "APP_INSTALLED", app: "Duolingo" });
    await android.send("/events", { type: "APP_REQUESTED", app: "Discord" });
    const all = await call("GET", "/alerts", { token });
    expect(all.data.alerts.length).toBeGreaterThanOrEqual(2);
    expect(all.data.alerts[0].day).toEqual({ key: expect.any(String), label: "Today" });
    const installed = all.data.alerts.find((a: { title: string }) => a.title === "New app installed");
    const request = all.data.alerts.find((a: { title: string }) => a.title === "App approval requested");
    expect(installed.dismissible).toBe(true);

    const before = (await call("GET", "/alerts/unread-count", { token })).data.unread;
    expect(before).toBeGreaterThan(0);
    const read = await call("POST", `/alerts/${request.id}/read`, { token });
    expect(read.data.unread).toBe(before - 1);

    expect((await call("POST", `/alerts/${request.id}/dismiss`, { token })).status).toBe(409);
    expect((await call("POST", `/alerts/${installed.id}/dismiss`, { token })).status).toBe(200);
    const after = await call("GET", "/alerts", { token });
    expect(after.data.alerts.find((a: { id: string }) => a.id === installed.id)).toBeUndefined();

    await call("POST", "/alerts/read-all", { token });
    expect((await call("GET", "/alerts/unread-count", { token })).data.unread).toBe(0);
    expect((await call("GET", "/alerts?filter=NOPE", { token })).status).toBe(400);
  });

  it("pages with nextBefore", async () => {
    const p1 = await call("GET", "/alerts?limit=1&includeResolved=true", { token });
    expect(p1.data.alerts).toHaveLength(1);
    const p2 = await call("GET", `/alerts?limit=1&includeResolved=true&before=${encodeURIComponent(p1.data.nextBefore)}`, { token });
    expect(p2.data.alerts[0].id).not.toBe(p1.data.alerts[0].id);
  });
});

describe("child photo", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

  it("uploads, serves and deletes a photo", async () => {
    const up = await call("PUT", `/children/${miaId}/photo`, { token, raw: png, headers: { "content-type": "image/png" } });
    expect(up.status).toBe(200);
    expect(up.data.photoUrl).toMatch(new RegExp(`/children/${miaId}/photo\\?v=\\d+`));

    const get = await call("GET", up.data.photoUrl.replace("/api/mobile/v1", ""), { token });
    expect(get.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(get.data as ArrayBuffer).equals(png)).toBe(true);
    expect((await call("GET", `/children/${miaId}/photo`)).status).toBe(401);

    const kids = await call("GET", "/children", { token });
    expect(kids.data.children.find((c: { id: string }) => c.id === miaId).photoUrl).toBe(up.data.photoUrl);

    expect((await call("DELETE", `/children/${miaId}/photo`, { token })).status).toBe(200);
    expect((await call("GET", `/children/${miaId}/photo`, { token })).status).toBe(404);
  });

  it("rejects files that aren't the image type they claim, or are too big", async () => {
    const fake = await call("PUT", `/children/${miaId}/photo`, { token, raw: Buffer.from("<svg onload=alert(1)>"), headers: { "content-type": "image/png" } });
    expect(fake.status).toBe(415);
    expect((await call("PUT", `/children/${miaId}/photo`, { token, raw: png, headers: { "content-type": "image/svg+xml" } })).status).toBe(415);
    const big = Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]);
    expect((await call("PUT", `/children/${miaId}/photo`, { token, raw: big, headers: { "content-type": "image/png" } })).status).toBe(413);
  });
});

describe("devices and configuration checks", () => {
  it("lists, renames and details devices", async () => {
    const list = await call("GET", "/devices", { token });
    expect(list.data.devices).toHaveLength(2);
    const r = await call("PATCH", `/devices/${android.deviceId}`, { token, body: { name: "Mia's phone" } });
    expect(r.data).toMatchObject({ name: "Mia's phone", childName: "Mia" });
    expect(r.data.protections).toHaveLength(10);
  });

  it("runs a check that completes when the device reports", async () => {
    const start = await call("POST", "/checks", { token, body: { deviceId: android.deviceId } });
    expect(start.status).toBe(202);
    const sync = await applyAndReport(android.send);
    expect(sync.fullReportRequested).toBe(true);
    const r = await call("GET", `/checks/${start.data.runId}`, { token });
    expect(r.data).toMatchObject({ done: true, results: [expect.objectContaining({ reachable: true, reported: true })] });
  });
});

describe("16–17. Settings and subscription", () => {
  let anaToken = "";
  let anaId = "";

  it("updates account and notification preferences", async () => {
    const me = await call("PATCH", "/me", { token, body: { timezone: "Asia/Manila", name: "Randy Cruz" } });
    expect(me.data.family.timezone).toBe("Asia/Manila");
    expect((await call("PATCH", "/me", { token, body: { timezone: "Mars/Olympus" } })).status).toBe(400);
    const n = await call("PATCH", "/me/notifications", { token, body: { weeklySummary: false } });
    expect(n.data).toMatchObject({ weeklySummary: false, notifyPush: true });
  });

  it("registers and removes a push token", async () => {
    expect((await call("POST", "/me/push-tokens", { token, body: { token: "apns-token-1234567890", platform: "IOS" } })).status).toBe(201);
    expect(await db.pushToken.count({ where: { token: "apns-token-1234567890" } })).toBe(1);
    await call("DELETE", "/me/push-tokens", { token, body: { token: "apns-token-1234567890" } });
    expect(await db.pushToken.count({ where: { token: "apns-token-1234567890" } })).toBe(0);
  });

  it("family admin adds a parent, who can't change admin-only settings", async () => {
    const add = await call("POST", "/family/members", { token, body: { name: "Ana Cruz", email: email("ana"), password: PASSWORD } });
    expect(add.status).toBe(201);
    anaId = add.data.id;
    anaToken = (await call("POST", "/auth/login", { body: { email: email("ana"), password: PASSWORD } })).data.token;
    const fam = await call("GET", "/family", { token: anaToken });
    expect(fam.data).toMatchObject({ name: "Cruz Family", canManage: false });
    expect(fam.data.members).toHaveLength(2);
    expect((await call("PATCH", "/family/privacy", { token: anaToken, body: { shareAnalytics: true } })).status).toBe(403);
    expect((await call("POST", "/family/members", { token: anaToken, body: { name: "X Y", email: email("x"), password: PASSWORD } })).status).toBe(403);
    // Parents do see the family's children
    expect((await call("GET", `/children/${miaId}`, { token: anaToken })).status).toBe(200);
  });

  it("removes a parent", async () => {
    expect((await call("DELETE", `/family/members/${anaId}`, { token })).status).toBe(200);
    expect((await call("GET", "/me", { token: anaToken })).status).toBe(401);
  });

  it("shows the plan, renewal, features and device usage", async () => {
    const r = await call("GET", "/subscription", { token });
    expect(r.data).toMatchObject({ plan: "eGuard Plus", planId: "PLUS", status: "ACTIVE", usage: { devicesUsed: 2, deviceLimit: 10, children: 2, childLimit: 5 } });
    // Set directly in this test, so there's no purchase and no renewal date
    expect(r.data).toMatchObject({ renewsAt: null, renewsLabel: null });
    expect(r.data.features.find((f: { key: string }) => f.key === "children").label).toBe("Up to 5 children");
    expect(r.data.entitlements).toMatchObject({ locationSharing: true, realtimeAlerts: true, advancedReports: false });
  });

  it("files a support request", async () => {
    const t = await call("POST", "/support/tickets", { token, body: { category: "DEVICE", subject: "Tablet offline", message: "Mia's tablet shows offline since Monday." } });
    expect(t.status).toBe(201);
    expect((await call("GET", "/support/tickets", { token })).data.tickets[0]).toMatchObject({ subject: "Tablet offline", status: "OPEN" });
    expect((await call("POST", "/support/tickets", { token, body: { subject: "Hi", message: "short" } })).status).toBe(400);
  });

  it("changing the password signs out other sessions", async () => {
    const other = (await call("POST", "/auth/login", { body: { email: email("randy"), password: PASSWORD } })).data.token;
    expect((await call("GET", "/me/sessions", { token })).data.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    expect((await call("POST", "/me/password", { token, body: { current: "wrong", next: "AnotherPass456!" } })).status).toBe(403);
    expect((await call("POST", "/me/password", { token, body: { current: PASSWORD, next: "short" } })).status).toBe(400);
    expect((await call("POST", "/me/password", { token, body: { current: PASSWORD, next: "AnotherPass456!" } })).status).toBe(200);
    expect((await call("GET", "/me", { token: other })).status).toBe(401);
    expect((await call("GET", "/me", { token })).status).toBe(200);
    await call("POST", "/me/password", { token, body: { current: "AnotherPass456!", next: PASSWORD } });
  });
});

describe("family isolation", () => {
  it("another family can't see or change this family's data", async () => {
    const eve = (await call("POST", "/auth/register", { body: { name: "Eve", email: email("eve"), password: PASSWORD, guardian: true } })).data;
    expect(eve.user.family.name).toBe("Eve's Family");
    const t = eve.token;
    const app = await db.childApp.findFirstOrThrow({ where: { childId: miaId, approval: { not: "BLOCKED" } } });
    const checks: [string, string, unknown?][] = [
      ["GET", `/children/${miaId}`], ["GET", `/children/${miaId}/screen-time`], ["GET", `/children/${miaId}/apps`],
      ["GET", `/children/${miaId}/location`], ["GET", `/children/${miaId}/photo`], ["GET", `/children/${miaId}/protections`],
      ["PUT", `/children/${miaId}/protections/LOCATION`, { sharing: false }], ["POST", `/children/${miaId}/pairing-code`],
      ["PATCH", `/apps/${app.id}`, { approval: "BLOCKED" }], ["GET", `/devices/${android.deviceId}`],
      ["DELETE", `/devices/${android.deviceId}`, { password: PASSWORD }], ["POST", "/checks", { deviceId: android.deviceId }],
    ];
    for (const [m, path, b] of checks) {
      const r = await call(m, path, { token: t, body: b });
      expect({ path, status: r.status }).toEqual({ path, status: 404 });
    }
    expect((await call("GET", "/dashboard", { token: t })).data.children).toEqual([]);
    expect((await db.childApp.findUniqueOrThrow({ where: { id: app.id } })).approval).not.toBe("BLOCKED");
  });
});

describe("Android design additions (public/android.png)", () => {
  const android_ = (token?: string) => ({ token, headers: { "x-eguard-client": "android" } });

  it("15. raises one 'App blocked' alert per app per hour", async () => {
    for (let i = 0; i < 3; i++) expect((await android.send("/events", { type: "APP_BLOCKED", app: "TikTok" })).status).toBe(200);
    const r = await call("GET", "/alerts?filter=APPS", { token });
    const blocked = r.data.alerts.filter((a: { title: string }) => a.title === "App blocked");
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({ severity: "INFO", subject: "TikTok · Mia's Mia's phone", dismissible: true, action: { type: "REVIEW_APPS", childId: miaId } });
    expect(blocked[0].body).toBe("Mia tried to open TikTok, which is blocked.");
    await android.send("/events", { type: "APP_BLOCKED", app: "Snapchat" });
    const again = await call("GET", "/alerts?filter=APPS", { token });
    expect(again.data.alerts.filter((a: { title: string }) => a.title === "App blocked")).toHaveLength(2);
  });

  it("14. 'View All' pages through every kept visit", async () => {
    const off = await call("GET", `/children/${miaId}/location/visits`, { token });
    expect(off.data).toMatchObject({ enabled: false, visits: [], nextBefore: null });

    await call("PATCH", "/family/privacy", { token, body: { keepLocationHistory: true } });
    const places: [number, string][] = [[0, "Home"], [0.02, "School"], [0.04, "Park"]];
    for (const [d, label] of places) await android.send("/location", { lat: 11.28 + d, lng: 125.06, placeLabel: label });
    const p1 = await call("GET", `/children/${miaId}/location/visits?limit=2`, { token });
    expect(p1.data.visits.map((v: { placeLabel: string }) => v.placeLabel)).toEqual(["Park", "School"]);
    expect(p1.data.retentionDays).toBe(90);
    const p2 = await call("GET", `/children/${miaId}/location/visits?limit=2&before=${encodeURIComponent(p1.data.nextBefore)}`, { token });
    expect(p2.data).toMatchObject({ visits: [expect.objectContaining({ placeLabel: "Home" })], nextBefore: null });
    await call("PATCH", "/family/privacy", { token, body: { keepLocationHistory: false } });
  });

  it("7. has a help article for Google Family Link", async () => {
    const r = await call("GET", "/help?q=family link", android_());
    expect(r.data.articles.map((a: { slug: string }) => a.slug)).toContain("android-family-link");
  });

  it("17. lists Free, Plus and Family Pro with the Google Play product for the upgrade", async () => {
    const r = await call("GET", "/subscription/plans", android_(token));
    expect(r.data.plans.map((p: { id: string; current: boolean }) => [p.id, p.current])).toEqual([["FREE", false], ["PLUS", true], ["PRO", false]]);
    const pro = r.data.plans.find((p: { id: string }) => p.id === "PRO");
    expect(pro).toMatchObject({ name: "Family Pro", monthlyPesos: 249, childLimit: 10, googlePlayProductId: "eguard_pro" });
    expect(pro.features.map((f: { label: string }) => f.label)).toContain("Advanced reports");

    const sub = await call("GET", "/subscription", android_(token));
    expect(sub.data).toMatchObject({ plan: "eGuard Plus", store: null, upgrade: { planId: "PRO", googlePlayProductId: "eguard_pro" } });
  });

  it("17. purchase verification refuses bad input and reports when Play billing isn't configured", async () => {
    expect((await call("POST", "/subscription/google-play", { ...android_(token), body: { productId: "eguard_family" } })).status).toBe(400);
    const r = await call("POST", "/subscription/google-play", { ...android_(token), body: { productId: "eguard_family", purchaseToken: "a".repeat(40) } });
    // This dev server has no GOOGLE_PLAY_* config; with it, the fake-Play tests in billing.test.ts cover the rest
    expect([501, 400]).toContain(r.status);
    if (r.status === 501) expect(r.data.code).toBe("billing_not_configured");
  });
});

describe("removing things", () => {
  it("removes a device with the parent's password; its token stops working and the family is told", async () => {
    const leo = (await call("GET", "/children", { token })).data.children.find((c: { name: string }) => c.name === "Leo");
    const ipad = (await call("GET", "/devices", { token })).data.devices.find((d: { childId: string }) => d.childId === leo.id);
    expect((await call("DELETE", `/devices/${ipad.id}`, { token })).data.code).toBe("wrong_password");
    expect((await call("DELETE", `/devices/${ipad.id}`, { token, body: { password: "nope" } })).status).toBe(403);
    expect((await call("DELETE", `/devices/${ipad.id}`, { token, body: { password: PASSWORD } })).status).toBe(200);
    expect((await call("GET", `/devices/${ipad.id}`, { token })).status).toBe(404);
    const alerts = (await call("GET", "/alerts?filter=DEVICES", { token })).data.alerts;
    expect(alerts.some((a: { title: string }) => a.title === "Device removed")).toBe(true);
  });

  it("deleting a child needs the admin's password", async () => {
    expect((await call("DELETE", `/children/${miaId}`, { token, body: { password: "nope" } })).status).toBe(403);
    expect((await call("DELETE", `/children/${miaId}`, { token, body: { password: PASSWORD } })).status).toBe(200);
    expect((await call("GET", `/children/${miaId}`, { token })).status).toBe(404);
    expect((await android.send("/sync")).status).toBe(401);
  });
});
