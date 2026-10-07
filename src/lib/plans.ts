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
  /** Push notifications for alerts (delivery not wired up yet); without it alerts still show in the app and by email */
  realtimeAlerts: boolean;
  /** 30-day and custom report ranges, and CSV export */
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
  /** Google Play subscription product id; null for Free */
  googlePlayProductId: string | null;
  entitlements: Entitlements;
  /** In display order; `label` is what the pricing card says */
  features: PlanFeature[];
};

export const FREE_APP_LIMIT = 5;

export const PLANS: Plan[] = [
  {
    id: "FREE", name: "Free", blurb: "Get started with essential protection tools.", monthlyPesos: 0, googlePlayProductId: null,
    entitlements: { childLimit: 1, deviceLimit: 2, locationSharing: false, appMonitoringLimit: FREE_APP_LIMIT, realtimeAlerts: false, advancedReports: false, apiAccess: false, categoryLimits: false },
    features: [
      { key: "children", label: "Up to 1 child", included: true },
      { key: "protection", label: "Basic protection setup", included: true },
      { key: "screen_time", label: "Screen time management", included: true },
      { key: "apps", label: "App monitoring (limited)", included: true },
      { key: "support", label: "Email support", included: true },
    ],
  },
  {
    id: "PLUS", name: "eGuard Plus", blurb: "Complete protection for growing families.", monthlyPesos: 149, googlePlayProductId: "eguard_plus",
    entitlements: { childLimit: 5, deviceLimit: 10, locationSharing: true, appMonitoringLimit: null, realtimeAlerts: true, advancedReports: false, apiAccess: false, categoryLimits: true },
    features: [
      { key: "children", label: "Up to 5 children", included: true },
      { key: "protection", label: "Full protection features", included: true },
      { key: "verification", label: "Configuration verification", included: true },
      { key: "alerts", label: "Push alerts (coming soon)", included: true },
      { key: "location", label: "Location sharing", included: true },
      { key: "category_limits", label: "Category limits, like gaming time", included: true },
      { key: "support", label: "Priority support", included: true },
    ],
  },
  {
    id: "PRO", name: "Family Pro", blurb: "Advanced features for larger families.", monthlyPesos: 249, googlePlayProductId: "eguard_pro",
    entitlements: { childLimit: 10, deviceLimit: 20, locationSharing: true, appMonitoringLimit: null, realtimeAlerts: true, advancedReports: true, apiAccess: true, categoryLimits: true },
    features: [
      { key: "children", label: "Up to 10 children", included: true },
      { key: "plus", label: "All Plus features", included: true },
      { key: "reports", label: "Advanced reports", included: true },
      { key: "api", label: "API access (schools/organizations)", included: true },
      { key: "support", label: "Dedicated support", included: true },
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
 * What the web sells through PayMongo, monthly only. Auto-renew charges a card or Maya every month (PayMongo
 * Subscriptions); a pass is paid once with any method (GCash, QR Ph, …) and doesn't renew.
 * `legacy` products were sold before these plans; purchases of them still grant Family Pro but they aren't sold.
 */
export type WebProduct = { id: string; plan: PaidPlanId; interval: Interval; autoRenew: boolean; legacy?: true };

export const WEB_PRODUCTS: WebProduct[] = [
  { id: "plus_monthly", plan: "PLUS", interval: "month", autoRenew: true },
  { id: "plus_pass_month", plan: "PLUS", interval: "month", autoRenew: false },
  { id: "pro_monthly", plan: "PRO", interval: "month", autoRenew: true },
  { id: "pro_pass_month", plan: "PRO", interval: "month", autoRenew: false },
  { id: "family_monthly", plan: "PRO", interval: "month", autoRenew: true, legacy: true },
  { id: "family_yearly", plan: "PRO", interval: "year", autoRenew: true, legacy: true },
  { id: "family_pass_month", plan: "PRO", interval: "month", autoRenew: false, legacy: true },
  { id: "family_pass_year", plan: "PRO", interval: "year", autoRenew: false, legacy: true },
];

export const webProduct = (id: string) => WEB_PRODUCTS.find((p) => p.id === id) ?? null;
export const webProductFor = (plan: PaidPlanId, autoRenew: boolean) => WEB_PRODUCTS.find((p) => p.plan === plan && p.autoRenew === autoRenew && !p.legacy)!;

/** Monthly web price in centavos. Configurable so it can change without a release. */
export function webPrice(plan: PaidPlanId, env: Record<string, string | undefined> = process.env) {
  const raw = plan === "PLUS" ? env.PRICE_PLUS_MONTHLY : env.PRICE_PRO_MONTHLY;
  const pesos = Number(raw?.trim() || byId(plan).monthlyPesos);
  if (!Number.isFinite(pesos) || pesos < 1) throw new Error(`Invalid price for ${plan}: ${raw}`);
  return Math.round(pesos * 100);
}

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
