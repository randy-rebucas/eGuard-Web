/**
 * Plans, what each includes, and the products that sell them. Family.plan holds the plan's name and
 * Family.deviceLimit its device cap (both set by applyEntitlement); everything else comes from here.
 */
export type PlanId = "FREE" | "PLUS" | "PRO";
export type PaidPlanId = Exclude<PlanId, "FREE">;

/** What a plan unlocks. Checked on the server; the apps get it to hide or badge features. */
export type Entitlements = {
  childLimit: number;
  deviceLimit: number;
  /** Current location and location history */
  locationSharing: boolean;
  /** How many of a child's apps can be seen and managed; null for all */
  appMonitoringLimit: number | null;
  /** Push notifications for alerts (lib/push, sent by the maintenance job); without it alerts still show in the app and by email */
  realtimeAlerts: boolean;
  /** 30-day reports, custom ranges longer than a week (lib/reports BASIC_RANGE_DAYS), and CSV export */
  advancedReports: boolean;
  /** Daily limits per app category ("Gaming time"); per-app limits are on every plan */
  categoryLimits: boolean;
  /** Organization API keys (/api/org/v1, docs/organization-api.md) for organizations this family's parents manage */
  apiAccess: boolean;
};

export type PlanFeature = { key: string; label: string; included: boolean };

export type Plan = {
  id: PlanId;
  name: string;
  blurb: string;
  /** Web price in pesos per month (PRICE_PLUS_MONTHLY / PRICE_PRO_MONTHLY override it); 0 for Free */
  monthlyPesos: number;
  /** Web price in pesos per year, two months free (PRICE_PLUS_YEARLY / PRICE_PRO_YEARLY override it); 0 for Free */
  yearlyPesos: number;
  /** Google Play subscription product id; null for Free */
  googlePlayProductId: string | null;
  entitlements: Entitlements;
  /** In display order; `label` is what the pricing card says */
  features: PlanFeature[];
};

export const FREE_APP_LIMIT = 5;

const FREE: Entitlements = { childLimit: 1, deviceLimit: 2, locationSharing: false, appMonitoringLimit: FREE_APP_LIMIT, realtimeAlerts: false, advancedReports: false, apiAccess: false, categoryLimits: false };
const PLUS: Entitlements = { childLimit: 5, deviceLimit: 10, locationSharing: true, appMonitoringLimit: null, realtimeAlerts: true, advancedReports: false, apiAccess: false, categoryLimits: true };
const PRO: Entitlements = { childLimit: 10, deviceLimit: 20, locationSharing: true, appMonitoringLimit: null, realtimeAlerts: true, advancedReports: true, apiAccess: true, categoryLimits: true };
/** "Up to 5 children and 10 devices", from the limits, so the card can't drift from what pairing allows */
const capacity = (e: Entitlements) => `Up to ${e.childLimit} ${e.childLimit === 1 ? "child" : "children"} and ${e.deviceLimit} devices`;

// Every protection and its verification are on every plan (the comparison table says so): cards list only what differs
export const PLANS: Plan[] = [
  {
    id: "FREE", name: "Free", blurb: "Get started with essential protection tools.", monthlyPesos: 0, yearlyPesos: 0, googlePlayProductId: null,
    entitlements: FREE,
    features: [
      { key: "children", label: capacity(FREE), included: true },
      { key: "protection", label: "All 10 protections and Configuration Health", included: true },
      { key: "screen_time", label: "Screen time and per-app limits", included: true },
      { key: "apps", label: `${FREE_APP_LIMIT} apps per child`, included: true },
      { key: "alerts", label: "Push for security alerts", included: true },
      { key: "support", label: "Email support", included: true },
    ],
  },
  {
    id: "PLUS", name: "eGuard Plus", blurb: "Complete protection for growing families.", monthlyPesos: 149, yearlyPesos: 1490, googlePlayProductId: "eguard_plus",
    entitlements: PLUS,
    features: [
      { key: "children", label: capacity(PLUS), included: true },
      { key: "apps", label: "See and manage every app", included: true },
      { key: "category_limits", label: "Category limits, like gaming time", included: true },
      { key: "location", label: "Location sharing", included: true },
      { key: "alerts", label: "Push for every alert", included: true },
      { key: "support", label: "Priority support", included: true },
    ],
  },
  {
    id: "PRO", name: "Family Pro", blurb: "Advanced features for larger families.", monthlyPesos: 249, yearlyPesos: 2490, googlePlayProductId: "eguard_pro",
    entitlements: PRO,
    features: [
      { key: "children", label: capacity(PRO), included: true },
      { key: "plus", label: "All Plus features", included: true },
      { key: "reports", label: "30-day reports and CSV export", included: true },
      { key: "api", label: "API access (schools/organizations)", included: true },
      // Answered before Plus and Free (the plan is on every ticket: lib/support, the console list)
      { key: "support", label: "Top-priority support", included: true },
    ],
  },
];

/** The plan every family starts on, and goes back to when a paid plan ends. */
export const BASE_PLAN = "Free";

const byId = (id: PlanId) => PLANS.find((p) => p.id === id)!;
export const planById = byId;
/** Unknown names (including plans retired before these) fall back to Free. */
export const planByName = (name: string) => PLANS.find((p) => p.name === name) ?? byId("FREE");
export const entitlementsFor = (planName: string) => planByName(planName).entitlements;

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** "one child", "five children"; `digits`: "1 child". For copy that states a plan's child limit. */
export const childCount = (n: number, { digits = false } = {}) => `${digits ? n : NUMBER_WORDS[n] ?? n} ${n === 1 ? "child" : "children"}`;
/** What Free covers ("Free for one child"), from the plan itself, so the site's copy follows a change to it. */
export const FREE_CHILDREN = childCount(byId("FREE").entitlements.childLimit);

/** The next plan up from this one, if any: what "Upgrade" offers. */
export function nextPlan(planName: string) {
  const i = PLANS.indexOf(planByName(planName));
  return PLANS[i + 1] ?? null;
}

/**
 * Google Play products that grant a plan. `eguard_family` was sold before these plans (15 devices);
 * its subscribers keep what they paid for as Family Pro.
 */
const LEGACY_GOOGLE_PLAY: Record<string, PaidPlanId> = { eguard_family: "PRO" };
export function planByGoogleProduct(productId: string) {
  const plan = PLANS.find((p) => p.googlePlayProductId === productId);
  if (plan) return plan;
  return LEGACY_GOOGLE_PLAY[productId] ? byId(LEGACY_GOOGLE_PLAY[productId]) : null;
}

export type Interval = "month" | "year";

/**
 * What the web sells through PayMongo, by the month or by the year. Auto-renew charges a card or Maya every period
 * (PayMongo Subscriptions); a pass is paid once with any method (GCash, QR Ph, …) and doesn't renew.
 * `legacy` products were sold before these plans; purchases of them still grant Family Pro but they aren't sold.
 */
export type WebProduct = { id: string; plan: PaidPlanId; interval: Interval; autoRenew: boolean; legacy?: true };

export const WEB_PRODUCTS: WebProduct[] = [
  { id: "plus_monthly", plan: "PLUS", interval: "month", autoRenew: true },
  { id: "plus_pass_month", plan: "PLUS", interval: "month", autoRenew: false },
  { id: "pro_monthly", plan: "PRO", interval: "month", autoRenew: true },
  { id: "pro_pass_month", plan: "PRO", interval: "month", autoRenew: false },
  { id: "plus_yearly", plan: "PLUS", interval: "year", autoRenew: true },
  { id: "plus_pass_year", plan: "PLUS", interval: "year", autoRenew: false },
  { id: "pro_yearly", plan: "PRO", interval: "year", autoRenew: true },
  { id: "pro_pass_year", plan: "PRO", interval: "year", autoRenew: false },
  { id: "family_monthly", plan: "PRO", interval: "month", autoRenew: true, legacy: true },
  { id: "family_yearly", plan: "PRO", interval: "year", autoRenew: true, legacy: true },
  { id: "family_pass_month", plan: "PRO", interval: "month", autoRenew: false, legacy: true },
  { id: "family_pass_year", plan: "PRO", interval: "year", autoRenew: false, legacy: true },
];

export const webProduct = (id: string) => WEB_PRODUCTS.find((p) => p.id === id) ?? null;
export const webProductFor = (plan: PaidPlanId, autoRenew: boolean, interval: Interval = "month") =>
  WEB_PRODUCTS.find((p) => p.plan === plan && p.autoRenew === autoRenew && p.interval === interval && !p.legacy)!;

/**
 * Web price in centavos for one month or one year. Configurable so it can change without a release:
 * PRICE_PLUS_MONTHLY, PRICE_PRO_MONTHLY, PRICE_PLUS_YEARLY, PRICE_PRO_YEARLY (pesos).
 */
export function webPrice(plan: PaidPlanId, env: Record<string, string | undefined> = process.env, interval: Interval = "month") {
  const yearly = interval === "year";
  const raw = plan === "PLUS" ? (yearly ? env.PRICE_PLUS_YEARLY : env.PRICE_PLUS_MONTHLY) : (yearly ? env.PRICE_PRO_YEARLY : env.PRICE_PRO_MONTHLY);
  const pesos = Number(raw?.trim() || (yearly ? byId(plan).yearlyPesos : byId(plan).monthlyPesos));
  if (!Number.isFinite(pesos) || pesos < 1) throw new Error(`Invalid ${yearly ? "yearly " : ""}price for ${plan}: ${raw}`);
  return Math.round(pesos * 100);
}

/** The yearly price for a plan, in centavos (webPrice with interval "year"). */
export const webYearlyPrice = (plan: PaidPlanId, env: Record<string, string | undefined> = process.env) => webPrice(plan, env, "year");

/** The plan a store product grants (Google Play or web). */
export function planByProduct(productId: string) {
  const web = webProduct(productId);
  return web ? byId(web.plan) : planByGoogleProduct(productId);
}

export function planFeatures(planName: string): PlanFeature[] {
  return planByName(planName).features;
}

/** The cheapest plan whose entitlements pass `has`, for "Upgrade to …". */
export function planWith(has: (e: Entitlements) => boolean) {
  let p = planByName("Free");
  for (let next = nextPlan(p.name); next && !has(p.entitlements); next = nextPlan(p.name)) p = next;
  return p;
}
