import { topicById } from "../learn";
import { activityByKey, tipByKey } from "./content";

/**
 * Parent-care message templates. Versioned: a message records the version it was sent with. Each language has an
 * approval status; only APPROVED text is sent, anything else falls back to English. Filipino is drafted and waits
 * for a native speaker's review (docs/features/parent-care.md › Content approval).
 *
 * Templates never mention a child by name or anything a child did: a notification preview can be read by anyone
 * near the phone.
 */

export const SUPPORTED_LANGUAGES = { en: "English", fil: "Filipino" } as const;
export type Language = keyof typeof SUPPORTED_LANGUAGES;
export const isLanguage = (s: string): s is Language => s in SUPPORTED_LANGUAGES;

export type Approval = "APPROVED" | "PENDING_REVIEW";

export type Rendered = { title: string; body: string; cta: string; link: string };

/** What a template is given: the job's payload, and numbers looked up when sending (the monthly report's). */
export type RenderInput = { params: Record<string, unknown>; report?: MonthlyNumbers | null };

export type MonthlyNumbers = { month: string; completed: number; started: number; protectionChanges: number; planWeeks: number };

type Copy = { [K in Language]?: { approval: Approval; render: (i: RenderInput) => Rendered | null } };
type Template = { key: string; version: number; name: string; copy: Copy };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const minutes = (n: number) => `about ${n} minutes`;

const monthName = (ym: string, locale = "en-PH") =>
  /^\d{4}-\d{2}$/.test(ym) ? new Date(`${ym}-15T00:00:00Z`).toLocaleDateString(locale, { month: "long", timeZone: "UTC" }) : "last month";

export const TEMPLATES: Template[] = [
  {
    key: "briefing", version: 1, name: "Family safety briefing",
    copy: {
      en: {
        approval: "APPROVED",
        render: ({ params }) => {
          const tip = tipByKey(str(params.tipKey));
          if (!tip) return null;
          const act = activityByKey(str(params.activityKey));
          const topic = topicById(tip.article.topic)?.label ?? "Family safety";
          return {
            title: `Tip: ${topic}`,
            body: act ? `${tip.text} Try this: ${act.title.toLowerCase()} (${minutes(act.minutes)}).` : tip.text,
            cta: act ? "See how" : "Read more",
            link: act ? `/plan/${act.key}` : `/learn/${tip.article.slug}`,
          };
        },
      },
      fil: {
        approval: "PENDING_REVIEW",
        render: ({ params }) => {
          const tip = tipByKey(str(params.tipKey));
          if (!tip) return null;
          const act = activityByKey(str(params.activityKey));
          return {
            title: "Tip mula sa eGuard",
            body: act ? `${tip.text} Subukan: ${act.title.toLowerCase()}.` : tip.text,
            cta: act ? "Tingnan kung paano" : "Magbasa pa",
            link: act ? `/plan/${act.key}` : `/learn/${tip.article.slug}`,
          };
        },
      },
    },
  },
  {
    key: "follow_up", version: 1, name: "Incomplete activity follow-up",
    copy: {
      en: {
        approval: "APPROVED",
        render: ({ params }) => {
          const act = activityByKey(str(params.activityKey));
          return act ? {
            title: `Ready to finish "${act.title}"?`,
            body: `You started this yesterday. It takes ${minutes(act.minutes)}, and your progress is saved.`,
            cta: "Continue", link: `/plan/${act.key}`,
          } : null;
        },
      },
      fil: {
        approval: "PENDING_REVIEW",
        render: ({ params }) => {
          const act = activityByKey(str(params.activityKey));
          return act ? { title: `Tapusin ang "${act.title}"?`, body: "Sinimulan mo ito kahapon. Naka-save ang progress mo.", cta: "Ituloy", link: `/plan/${act.key}` } : null;
        },
      },
    },
  },
  {
    key: "weekly_plan", version: 1, name: "Weekly family safety plan",
    copy: {
      en: {
        approval: "APPROVED",
        render: ({ params }) => {
          const acts = (Array.isArray(params.activityKeys) ? params.activityKeys : []).map((k) => activityByKey(str(k))).filter((a) => !!a);
          if (!acts.length) return null;
          return {
            title: "Your family safety plan for this week",
            body: acts.length === 1
              ? `One thing to try this week: ${acts[0].title.toLowerCase()} (${minutes(acts[0].minutes)}).`
              : `Two things to try this week: ${acts[0].title.toLowerCase()}, and ${acts[1].title.toLowerCase()}. Together they take ${minutes(acts[0].minutes + acts[1].minutes)}.`,
            cta: "See this week's plan", link: "/plan",
          };
        },
      },
      fil: {
        approval: "PENDING_REVIEW",
        render: ({ params }) => {
          const acts = (Array.isArray(params.activityKeys) ? params.activityKeys : []).map((k) => activityByKey(str(k))).filter((a) => !!a);
          return acts.length ? { title: "Ang safety plan ng pamilya ngayong linggo", body: acts.map((a) => a.title).join(" · "), cta: "Tingnan ang plan", link: "/plan" } : null;
        },
      },
    },
  },
  {
    key: "check_in", version: 1, name: "Inactive parent check-in",
    copy: {
      en: {
        approval: "APPROVED",
        // Step 0: a resource; 1: a small idea; 2: a last check-in that says the check-ins stop
        render: ({ params }) => {
          const step = Number(params.step ?? 0);
          const act = activityByKey(str(params.activityKey));
          if (step === 2) {
            return {
              title: "A quick check-in from eGuard",
              body: "We'll stop these check-ins now. Your family's settings keep working, and tips and activities are on your Safety plan whenever you want them.",
              cta: "Open your Safety plan", link: "/plan",
            };
          }
          if (!act) return null;
          return step === 0
            ? { title: "Something you might find useful", body: `${act.why} ${act.title} takes ${minutes(act.minutes)}.`, cta: "See the steps", link: `/plan/${act.key}` }
            : { title: "One small idea for this week", body: `${act.title}: ${minutes(act.minutes)}, whenever it suits you.`, cta: "See the steps", link: `/plan/${act.key}` };
        },
      },
      fil: {
        approval: "PENDING_REVIEW",
        render: ({ params }) => {
          const act = activityByKey(str(params.activityKey));
          if (Number(params.step ?? 0) === 2) return { title: "Kumusta mula sa eGuard", body: "Ititigil na namin ang mga check-in na ito. Patuloy na gumagana ang settings ng pamilya mo.", cta: "Buksan ang Safety plan", link: "/plan" };
          return act ? { title: "Baka makatulong ito", body: act.title, cta: "Tingnan ang mga hakbang", link: `/plan/${act.key}` } : null;
        },
      },
    },
  },
  {
    key: "monthly_report", version: 1, name: "Monthly family progress report",
    copy: {
      en: {
        approval: "APPROVED",
        render: ({ params, report }) => {
          const month = str(params.month);
          const name = monthName(month);
          // Without the numbers (an in-app message shown later), point to the report page, which counts them then
          const body = !report ? `See what your family did with eGuard in ${name}.`
            : report.completed
              ? `In ${name} you completed ${report.completed} safety ${report.completed === 1 ? "activity" : "activities"}${report.protectionChanges ? ` and your family made ${report.protectionChanges} protection ${report.protectionChanges === 1 ? "change" : "changes"}` : ""}. See the details and a next step.`
              : `Your ${name} summary is ready, with one practical next step.`;
          return { title: `Your family's ${name} with eGuard`, body, cta: "See the report", link: `/plan/report?month=${month}` };
        },
      },
      fil: {
        approval: "PENDING_REVIEW",
        render: ({ params }) => ({ title: `Buod ng ${monthName(str(params.month))}`, body: "Handa na ang buod ng nakaraang buwan.", cta: "Tingnan", link: `/plan/report?month=${str(params.month)}` }),
      },
    },
  },
];

const BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));
export const templateByKey = (key: string) => BY_KEY.get(key) ?? null;

/**
 * Renders a template in `language` if that text is approved, otherwise in English. Null when the content it names
 * no longer exists (an activity removed from the catalog): the job is skipped rather than sent half-empty.
 */
export function render(templateKey: string, language: string, input: RenderInput): (Rendered & { language: Language; version: number }) | null {
  const t = BY_KEY.get(templateKey);
  if (!t) return null;
  const lang: Language = isLanguage(language) && t.copy[language]?.approval === "APPROVED" ? language : "en";
  const copy = t.copy[lang];
  const r = copy?.approval === "APPROVED" ? copy.render(input) : null;
  return r ? { ...r, language: lang, version: t.version } : null;
}

/** Only app paths: a link in a message can never send a parent off-site. */
export const safeLink = (link: string) => (/^\/(?!\/)[\w\-/?=&.%]*$/.test(link) ? link : "/plan");
