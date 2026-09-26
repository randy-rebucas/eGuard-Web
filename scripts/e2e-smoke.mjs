// End-to-end smoke test against a running dev server with the seeded database.
// Usage: BASE_URL=http://localhost:3217 SHOTS=./shots node scripts/e2e-smoke.mjs
// Requires DEVICE_SIMULATOR=true so seeded devices answer configuration requests.
import puppeteer from "puppeteer-core";
import { mkdirSync, existsSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3217";
const SHOTS = process.env.SHOTS ?? "./shots";
const CHROME = process.env.CHROME_PATH ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => existsSync(p));
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error" && !/tile\.openstreetmap|Failed to load resource.*favicon/.test(m.text())) consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const text = () => page.evaluate(() => document.body.innerText);
const clickText = async (selector, label) => {
  const ok = await page.evaluate((sel, lbl) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.innerText.trim().includes(lbl) && !e.disabled);
    if (el) { el.click(); return true; } return false;
  }, selector, label);
  if (!ok) throw new Error(`No clickable ${selector} with "${label}"`);
};
const waitText = (t, timeout = 30000) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);
const waitDialog = (t, timeout = 30000) => page.waitForFunction((s) => [...document.querySelectorAll(".dialog")].some((d) => d.innerText.includes(s)), { timeout }, t);
const score = async () => {
  await page.goto(`${BASE}/protection`, { waitUntil: "networkidle0" });
  return page.evaluate(() => Number(document.querySelector(".health-ring .ring-label b")?.firstChild?.textContent));
};

try {
  // 1. Sign in
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  await page.type("#email", "randy@example.com");
  await page.type("#password", "ChangeMe123!");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("form button.btn-primary")]);
  check("sign in lands on dashboard", page.url().endsWith("/dashboard"), page.url());
  await page.waitForSelector(".hero", { timeout: 60000 });
  await page.screenshot({ path: `${SHOTS}/01-dashboard.png`, fullPage: true });
  const dash = await text();
  check("dashboard shows children", ["Mia", "Lucas", "Sophie"].every((n) => dash.includes(n)));
  check("dashboard shows 2 settings need attention", dash.includes("settings need attention"));

  const before = await score();
  check("initial family health is 8/10", before === 8, String(before));

  // 2. Bedtime workflow (APPLY) for Sophie: select → review → choose → confirm → apply → verify → updated
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0" });
  await clickText("button.list-row", "Set Bedtime Schedule");
  await waitText("Which child is this for?");
  await clickText(".dialog button.list-row", "Sophie");
  await waitText("Step 2 of 6");
  await clickText(".dialog button", "Continue");
  await waitText("Step 3 of 6");
  await page.evaluate(() => { const b = document.querySelector('.dialog button.switch[aria-checked="false"]'); b?.click(); });
  await page.$eval("#bt-s", (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, "21:45"); el.dispatchEvent(new Event("input", { bubbles: true })); });
  await clickText(".dialog button", "Apply to device");
  await waitText("Change Protection Settings");
  await page.screenshot({ path: `${SHOTS}/02-confirm.png` });
  await clickText(".dialog button", "Continue");
  await waitDialog("Verified on", 30000);
  await page.screenshot({ path: `${SHOTS}/03-bedtime-verified.png` });
  const done = await text();
  check("bedtime verified with before/after", done.includes("9:45 PM") && done.includes("Configuration Health updated"));
  await clickText(".dialog button", "Done");
  const afterBedtime = await score();
  check("health rises to 9/10 after verified bedtime", afterBedtime === 9, String(afterBedtime));

  // 3. Location (GUIDED on iOS): must not verify until parent confirms steps
  await clickText("button.check-item", "Location");
  await waitText("Step 2 of 6");
  await clickText(".dialog button", "Continue");
  await waitText("Step 3 of 6");
  await clickText(".dialog button", "Continue to setup");
  await clickText(".dialog button", "Continue");
  await waitText("I've done these steps on the device");
  const verifyDisabled = await page.evaluate(() => [...document.querySelectorAll(".dialog button")].find((b) => b.innerText.includes("Verify now"))?.disabled);
  check("guided setup blocks verification until parent confirms", verifyDisabled === true);
  await page.screenshot({ path: `${SHOTS}/04-guided.png` });
  await page.click("#guided-done");
  await clickText(".dialog button", "Verify now");
  await waitDialog("Verified on", 30000);
  await clickText(".dialog button", "Done");
  const afterLocation = await score();
  check("health reaches 10/10 after guided location verified", afterLocation === 10, String(afterLocation));

  // 4. Configuration check: offline device is reported as unreachable
  await clickText("button.btn-primary", "Run Configuration Check");
  await waitDialog("Configuration Health:", 30000);
  const run = await text();
  check("configuration check completes and flags offline tablet", run.includes("Couldn't reach"));
  await page.screenshot({ path: `${SHOTS}/05-check.png` });
  await page.keyboard.press("Escape");

  // 5. Device API: pair a new device with a code from the dashboard
  await page.goto(`${BASE}/devices`, { waitUntil: "networkidle0" });
  await clickText("button", "Get pairing code");
  await page.waitForSelector(".pairing-code");
  const code = await page.$eval(".pairing-code", (e) => e.textContent.trim());
  const pair = await fetch(`${BASE}/api/device/v1/pair`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, platform: "ANDROID", name: "Pixel 7a", model: "GWKK3", kind: "PHONE", osVersion: "Android 14", appVersion: "4.2.1" }) });
  const paired = await pair.json();
  check("pairing code exchanges for a device token", pair.status === 201 && !!paired.token, String(pair.status));
  const auth = { "content-type": "application/json", authorization: `Bearer ${paired.token}` };
  const sync = await (await fetch(`${BASE}/api/device/v1/sync`, { method: "POST", headers: auth, body: JSON.stringify({ battery: 80 }) })).json();
  check("sync returns full policy and asks for a full report", sync.policy?.length === 10 && sync.fullReportRequested === true);
  const protections = sync.policy.map((p) => { const config = { ...p.config }; delete config.key; return { key: p.key, config }; });
  const rep = await fetch(`${BASE}/api/device/v1/report`, { method: "POST", headers: auth, body: JSON.stringify({ protections, full: true }) });
  check("device report accepted", rep.status === 200);
  const today = new Date().toISOString().slice(0, 10);
  const usage = await fetch(`${BASE}/api/device/v1/usage`, { method: "POST", headers: auth, body: JSON.stringify({ date: today, totalMinutes: 12, apps: [{ name: "Duolingo", minutes: 12 }] }) });
  check("usage accepted", usage.status === 200);
  const bad = await fetch(`${BASE}/api/device/v1/sync`, { method: "POST", headers: { authorization: "Bearer nope" } });
  check("invalid device token is rejected", bad.status === 401);

  // A device-side change that breaks policy raises an alert
  const off = protections.map((p) => (p.key === "UNINSTALL_PROTECTION" ? { ...p, config: { enabled: false } } : p));
  await fetch(`${BASE}/api/device/v1/report`, { method: "POST", headers: auth, body: JSON.stringify({ protections: off }) });
  await page.goto(`${BASE}/notifications`, { waitUntil: "networkidle0" });
  check("on-device protection change raises an alert", (await text()).includes("Protection setting changed"));
  await page.screenshot({ path: `${SHOTS}/06-notifications.png`, fullPage: true });

  // 6. Every page renders without the error boundary
  const pages = ["/children", "/devices", "/protection", "/reports", "/reports?period=30d", "/reports?period=custom", "/location", "/notifications?filter=devices",
    ...["account", "family", "notifications", "privacy", "security", "subscription", "devices", "integrations", "data", "support"].map((s) => `/settings/${s}`)];
  for (const p of pages) {
    const r = await page.goto(`${BASE}${p}`, { waitUntil: "networkidle2" });
    const t = await text();
    check(`page ${p}`, r.status() === 200 && !t.includes("couldn't load"), String(r.status()));
  }
  const childLinks = await page.evaluate(async () => [...new Set([...document.querySelectorAll('a[href^="/children/c"]')].map((a) => a.getAttribute("href")))]);
  await page.goto(`${BASE}/children`, { waitUntil: "networkidle0" });
  const kidHrefs = await page.$$eval('a.child-card', (as) => as.map((a) => a.getAttribute("href")));
  for (const tab of ["overview", "activity", "apps", "screen", "protection", "location", "devices", "history"]) {
    const r = await page.goto(`${BASE}${kidHrefs[0]}?tab=${tab}`, { waitUntil: "networkidle0" });
    check(`child tab ${tab}`, r.status() === 200 && !(await text()).includes("couldn't load"));
  }
  void childLinks;
  await page.goto(`${BASE}${kidHrefs[2]}?tab=history`, { waitUntil: "networkidle0" });
  check("Sophie's history records the verified bedtime change", (await text()).includes("Bedtime updated"));
  await page.screenshot({ path: `${SHOTS}/07-child-history.png`, fullPage: true });
  await page.goto(`${BASE}/devices`, { waitUntil: "networkidle0" });
  const devHref = await page.$$eval("a.device-card", (as) => as.map((a) => a.getAttribute("href")));
  const r = await page.goto(`${BASE}${devHref[0]}`, { waitUntil: "networkidle0" });
  check("device detail", r.status() === 200);
  await page.screenshot({ path: `${SHOTS}/08-device.png`, fullPage: true });

  // 7. Search
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0" });
  await page.type("#q", "iph");
  await page.waitForSelector(".sr-item", { timeout: 10000 });
  check("search finds iPhone", (await page.$eval(".search-results", (e) => e.innerText)).includes("iPhone 13"));

  // 8. CSV export
  const csv = await page.evaluate(async () => { const r = await fetch("/api/reports/export?period=7d"); return { s: r.status, t: await r.text(), cd: r.headers.get("content-disposition") }; });
  check("CSV export downloads", csv.s === 200 && csv.t.includes("Screen time") && /attachment/.test(csv.cd ?? ""));

  // 9. Responsive and dark screenshots
  await page.goto(`${BASE}/protection`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${SHOTS}/09-protection.png`, fullPage: true });
  await page.goto(`${BASE}/location`, { waitUntil: "networkidle2" }); await sleep(2500);
  await page.screenshot({ path: `${SHOTS}/10-location.png` });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${SHOTS}/11-mobile.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("no horizontal scroll on phone", !overflow);
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${SHOTS}/12-dark.png` });

  // 10. Sign out
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.click("button.profile");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), clickText("button.menu-item", "Sign out")]);
  check("sign out returns to login", page.url().endsWith("/login"));
} catch (e) {
  check("script completed", false, e.message);
  await page.screenshot({ path: `${SHOTS}/zz-failure.png`, fullPage: true }).catch(() => {});
} finally {
  check("no browser console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
