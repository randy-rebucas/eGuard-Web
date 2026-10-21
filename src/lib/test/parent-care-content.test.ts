import { describe, expect, it } from "vitest";
import { ARTICLES, articleBySlug } from "../learn";
import { ACTIVITIES, TIP_FRESH_DAYS, activityByKey, articleAges, fitsAges, pickPlan, pickTip, suggestible, tipByKey, tipKey } from "../parent-care/content";
import { TEMPLATES, render, safeLink } from "../parent-care/templates";
import { AUTOMATIONS } from "../parent-care/definitions";

const NOW = new Date("2026-10-21T11:30:00Z");

describe("parent-care content", () => {
  it("links every activity to a real knowledge-center article, with unique keys", () => {
    for (const a of ACTIVITIES) expect(articleBySlug(a.article), a.key).not.toBeNull();
    expect(new Set(ACTIVITIES.map((a) => a.key)).size).toBe(ACTIVITIES.length);
  });

  it("names templates and toggles that exist for every automation", () => {
    for (const a of AUTOMATIONS) expect(TEMPLATES.some((t) => t.key === a.templateKey), a.key).toBe(true);
  });

  it("takes tips from article takeaways and reads them back by key", () => {
    const a = ARTICLES[0];
    expect(tipByKey(tipKey(a.slug, 0))?.text).toBe(a.takeaways[0]);
    expect(tipByKey("tip:no-such-article:0")).toBeNull();
    expect(tipByKey(tipKey(a.slug, 99))).toBeNull();
  });

  it("never sends the same tip twice, and covers first takeaways before second ones", () => {
    const sent = new Set<string>();
    const picked: string[] = [];
    for (let i = 0; i < 30; i++) {
      const t = pickTip({ ages: [10], sent, now: NOW, seed: 7 })!;
      expect(sent.has(t.key)).toBe(false);
      sent.add(t.key);
      picked.push(t.key);
    }
    expect(picked.every((k) => k.endsWith(":0"))).toBe(true);
  });

  it("leaves grooming and exploitation out of unasked tips", () => {
    const sent = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const t = pickTip({ ages: [14], sent, now: NOW, seed: 1 });
      if (!t) break;
      expect(t.article.topic).not.toBe("exploitation");
      sent.add(t.key);
    }
  });

  it("stops when articles haven't been reviewed recently enough, rather than send stale advice", () => {
    const later = new Date(new Date(`${ARTICLES[0].reviewed}T00:00:00Z`).getTime() + (TIP_FRESH_DAYS + 1) * 864e5);
    expect(pickTip({ ages: [10], sent: new Set(), now: later, seed: 0 })).toBeNull();
  });

  it("fits tips and activities to the children's ages", () => {
    expect(articleAges({ slug: "screens-and-toddlers", topic: "screen-time" })).toEqual([0, 5]);
    expect(fitsAges([10, 17], [6])).toBe(false);
    expect(fitsAges([10, 17], [6, 12])).toBe(true);
    // No children yet: only broad, general advice
    expect(fitsAges([0, 17], [])).toBe(true);
    expect(fitsAges([12, 17], [])).toBe(false);
    for (let i = 0; i < 20; i++) {
      const t = pickTip({ ages: [4], sent: new Set(), now: NOW, seed: i })!;
      const [lo, hi] = articleAges(ARTICLES.find((a) => a.slug === t.article.slug)!);
      expect(lo <= 4 && hi >= 4).toBe(true);
    }
  });

  it("plans one or two activities, unfinished ones first, skipping done and dismissed ones", () => {
    const plan = pickPlan({ ages: [10], states: [], now: NOW });
    expect(plan.length).toBeGreaterThanOrEqual(1);
    expect(plan.length).toBeLessThanOrEqual(2);
    const started = pickPlan({ ages: [10], states: [{ activityKey: "caregiver-rules", status: "STARTED", completedAt: null }], now: NOW });
    expect(started[0]).toBe("caregiver-rules");
    const states = [
      { activityKey: "school-night-bedtime", status: "COMPLETED", completedAt: new Date("2026-10-01") },
      { activityKey: "online-life-talk", status: "DISMISSED", completedAt: null },
    ];
    const next = pickPlan({ ages: [10], states, now: NOW });
    expect(next).not.toContain("school-night-bedtime");
    expect(next).not.toContain("online-life-talk");
  });

  it("keeps a plan under about half an hour", () => {
    for (let skip = 0; skip < ACTIVITIES.length - 1; skip++) {
      const states = ACTIVITIES.slice(0, skip).map((a) => ({ activityKey: a.key, status: "COMPLETED", completedAt: NOW }));
      const keys = pickPlan({ ages: [10], states, now: NOW });
      if (keys.length === 2) expect(keys.reduce((s, k) => s + activityByKey(k)!.minutes, 0)).toBeLessThanOrEqual(30);
    }
  });

  it("brings back a repeatable activity once enough time has passed", () => {
    const talk = activityByKey("online-life-talk")!;
    expect(suggestible(talk, { activityKey: talk.key, status: "COMPLETED", completedAt: new Date(NOW.getTime() - 10 * 864e5) }, NOW)).toBe(false);
    expect(suggestible(talk, { activityKey: talk.key, status: "COMPLETED", completedAt: new Date(NOW.getTime() - 31 * 864e5) }, NOW)).toBe(true);
    const once = activityByKey("family-media-plan")!;
    expect(suggestible(once, { activityKey: once.key, status: "COMPLETED", completedAt: new Date("2025-01-01") }, NOW)).toBe(false);
  });
});

describe("parent-care templates", () => {
  const act = ACTIVITIES[0];

  it("renders each automation's message with one tip and one action, linking into the app", () => {
    const tip = tipKey(ARTICLES[0].slug, 0);
    const r = render("briefing", "en", { params: { tipKey: tip, activityKey: act.key } })!;
    expect(r.body).toContain(ARTICLES[0].takeaways[0]);
    expect(r.body).toContain(act.title.toLowerCase());
    expect(r.link).toBe(`/plan/${act.key}`);
    expect(render("follow_up", "en", { params: { activityKey: act.key } })!.link).toBe(`/plan/${act.key}`);
    expect(render("weekly_plan", "en", { params: { activityKeys: [act.key] } })!.body).toMatch(/^One thing to try this week/);
    expect(render("monthly_report", "en", { params: { month: "2026-09" }, report: { month: "2026-09", completed: 2, started: 3, protectionChanges: 1, planWeeks: 4 } })!.body)
      .toBe("In September you completed 2 safety activities and your family made 1 protection change. See the details and a next step.");
  });

  it("closes the check-in sequence respectfully, without guilt or fear", () => {
    const last = render("check_in", "en", { params: { step: 2 } })!;
    expect(last.body).toMatch(/We'll stop these check-ins now/);
    for (const step of [0, 1, 2]) {
      const r = render("check_in", "en", { params: { step, activityKey: act.key } })!;
      expect(`${r.title} ${r.body}`).not.toMatch(/miss(ed)? you|danger|at risk|don't let|before it's too late|worried/i);
    }
  });

  it("never claims a family is safe or that something reduced risk", () => {
    const report = render("monthly_report", "en", { params: { month: "2026-09" }, report: { month: "2026-09", completed: 5, started: 5, protectionChanges: 9, planWeeks: 4 } })!;
    expect(`${report.title} ${report.body}`).not.toMatch(/\bsafe(r|st)?\b|reduc|protected from/i);
  });

  it("sends English until a language's text is approved", () => {
    const r = render("follow_up", "fil", { params: { activityKey: act.key } })!;
    expect(r.language).toBe("en");
    expect(r.title).toMatch(/^Ready to finish/);
  });

  it("renders nothing when the content is gone, rather than a half-empty message", () => {
    expect(render("follow_up", "en", { params: { activityKey: "removed-activity" } })).toBeNull();
    expect(render("briefing", "en", { params: { tipKey: "tip:gone:0" } })).toBeNull();
    expect(render("no_such_template", "en", { params: {} })).toBeNull();
  });

  it("only links to app paths", () => {
    expect(safeLink("/plan/school-night-bedtime")).toBe("/plan/school-night-bedtime");
    expect(safeLink("/plan/report?month=2026-09")).toBe("/plan/report?month=2026-09");
    expect(safeLink("https://evil.example")).toBe("/plan");
    expect(safeLink("//evil.example")).toBe("/plan");
    expect(safeLink("/x\"onmouseover")).toBe("/plan");
  });
});
