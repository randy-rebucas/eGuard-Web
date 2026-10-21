import { ARTICLES, articleBySlug, type Article, type TopicId } from "../learn";

/**
 * Approved content for parent-care messages. Nothing here is generated: briefing tips are the takeaways of the
 * knowledge center's articles (lib/learn, each with a `reviewed` date), and activities are the curated list below,
 * each pointing to an article for the detail. Changing this file is the approval step (code review).
 *
 * Content rules: practical, calm, no claims about current threats, no promise that anything makes a child "safe".
 */

/** A takeaway is only sent while its article's facts were checked within this long */
export const TIP_FRESH_DAYS = 548;

/**
 * Topics not used for proactive tips: grooming and exploitation are too heavy to arrive unasked in a notification.
 * Parents still find them in /learn, and activities link there where it fits.
 */
const NO_PROACTIVE_TIPS: TopicId[] = ["exploitation"];

/** Ages a topic is relevant to; a family's children decide which tips fit. */
const TOPIC_AGES: Partial<Record<TopicId, [number, number]>> = {
  "social-media": [10, 17], tiktok: [10, 17], "chat-apps": [10, 17], gaming: [6, 17], ai: [8, 17], cyberbullying: [7, 17],
};
/** Articles narrower than their topic */
const ARTICLE_AGES: Record<string, [number, number]> = {
  "screens-and-toddlers": [0, 5], "online-gambling-teens-philippines": [12, 17], "ai-companion-apps-teens": [12, 17],
  "right-age-for-a-phone": [5, 13], "first-phone-checklist": [6, 14], "parental-controls-for-teens": [12, 17],
};

export const articleAges = (a: Pick<Article, "slug" | "topic">): [number, number] => ARTICLE_AGES[a.slug] ?? TOPIC_AGES[a.topic] ?? [0, 17];

/** True when the age range fits at least one child, or the family has no children yet (general advice only then). */
export function fitsAges(range: [number, number], ages: number[], general = true) {
  if (!ages.length) return general && range[0] <= 6 && range[1] >= 12;
  return ages.some((a) => a >= range[0] && a <= range[1]);
}

export type Tip = { key: string; text: string; article: Pick<Article, "slug" | "title" | "topic"> };

/** `tip:<slug>:<n>`: stable across edits to other articles */
export const tipKey = (slug: string, n: number) => `tip:${slug}:${n}`;

export function tipByKey(key: string): Tip | null {
  const m = /^tip:([a-z0-9-]+):(\d+)$/.exec(key);
  const a = m ? articleBySlug(m[1]) : null;
  const text = a?.takeaways[Number(m![2])];
  return a && text ? { key, text, article: { slug: a.slug, title: a.title, topic: a.topic } } : null;
}

/**
 * The next tip for a family: fresh, fitting the children's ages, not sent to this parent before. Articles are taken
 * in a fixed order offset by `seed`, so parents in one family don't all get the same one, and each article's
 * takeaways in order. Null when every fitting tip was sent: better nothing than a repeat.
 */
export function pickTip(o: { ages: number[]; sent: Set<string>; now: Date; seed: number }): Tip | null {
  const fresh = ARTICLES.filter((a) =>
    !NO_PROACTIVE_TIPS.includes(a.topic)
    && o.now.getTime() - new Date(`${a.reviewed}T00:00:00Z`).getTime() <= TIP_FRESH_DAYS * 864e5
    && fitsAges(articleAges(a), o.ages));
  if (!fresh.length) return null;
  const start = Math.abs(o.seed) % fresh.length;
  const ordered = [...fresh.slice(start), ...fresh.slice(0, start)];
  // First takeaways of every article before second ones, so consecutive briefings cover different topics
  const depth = Math.max(...ordered.map((a) => a.takeaways.length));
  for (let n = 0; n < depth; n++) {
    for (const a of ordered) {
      const key = tipKey(a.slug, n);
      if (a.takeaways[n] && !o.sent.has(key)) return { key, text: a.takeaways[n], article: { slug: a.slug, title: a.title, topic: a.topic } };
    }
  }
  return null;
}

export type Activity = {
  key: string;
  title: string;
  /** One sentence: why it's worth the time */
  why: string;
  minutes: number;
  steps: string[];
  /** Ages it suits; omitted: any */
  ages?: [number, number];
  /** The knowledge center article with the detail */
  article: string;
  /** Where in eGuard it's done, when it is */
  appLink?: { href: string; label: string };
  /** Worth doing again after this many days (a monthly talk); omitted: once */
  repeatDays?: number;
  /** Lower comes first in plans */
  priority: number;
};

export const ACTIVITIES: Activity[] = [
  {
    key: "school-night-bedtime", priority: 1, minutes: 10, article: "phones-and-sleep",
    title: "Set a school-night bedtime",
    why: "Sleep is the rule with the clearest payoff, and a device bedtime ends the nightly negotiation.",
    steps: [
      "Agree a screens-off time with your child, at least an hour before they sleep.",
      "In eGuard, open Protection, choose your child and turn on Bedtime with that time.",
      "Tell your child when it starts tonight, so it isn't a surprise.",
    ],
    appLink: { href: "/protection", label: "Open Protection" },
  },
  {
    key: "online-life-talk", priority: 2, minutes: 15, article: "talking-to-kids-about-online-life", repeatDays: 30,
    title: "Have a 15-minute talk about their online life",
    why: "Children who talk about their online life with a parent are more likely to come to them when something goes wrong.",
    steps: [
      "Pick a relaxed moment: a car ride, a meal, a walk.",
      "Ask them to show you a game, app or video they like, and let them be the expert.",
      "Ask one open question, like \"What would you do if something online made you feel bad?\"",
      "End by reminding them they can always come to you, and they won't be in trouble for telling you.",
    ],
  },
  {
    key: "run-health-check", priority: 3, minutes: 5, article: "how-kids-get-around-parental-controls", repeatDays: 30,
    title: "Run a Configuration Check",
    why: "A check confirms each protection is still applied on your child's devices, so you're not relying on settings that quietly changed.",
    steps: [
      "Open the Dashboard and press Run Configuration Check.",
      "Look at anything marked Needs attention and follow its steps.",
      "If a device is offline, check it's switched on and connected.",
    ],
    appLink: { href: "/dashboard", label: "Open the Dashboard" },
  },
  {
    key: "family-media-plan", priority: 4, minutes: 20, article: "family-media-plan",
    title: "Write a family media plan together",
    why: "Rules children help write are rules they keep. A written plan settles arguments before they start.",
    steps: [
      "Sit down together and list where and when screens are fine, and where they aren't (meals, bedrooms at night).",
      "Agree what happens when a rule is broken, and how rules change as they grow.",
      "Write it down, sign it together and put it somewhere everyone can see.",
    ],
  },
  {
    key: "strangers-plan", priority: 5, minutes: 10, ages: [6, 17], article: "talking-about-strangers-online",
    title: "Agree what to do if a stranger messages them",
    why: "A plan agreed in a calm moment is what children remember when something unexpected happens.",
    steps: [
      "Explain that people online aren't always who they say they are, without making it scary.",
      "Agree the steps together: don't reply, don't share photos or where they live, tell you.",
      "Show them how to block and report someone in the app they use most.",
    ],
  },
  {
    key: "review-apps-together", priority: 6, minutes: 15, article: "parental-controls-philippines-guide",
    title: "Review your child's apps together",
    why: "Looking at the apps with your child shows you what they actually use, and opens a conversation about it.",
    steps: [
      "In eGuard, open Children, choose your child and look at their apps and screen time.",
      "Ask your child which apps they use most and what they like about them.",
      "Decide together on any app that needs a limit or a different setting.",
    ],
    appLink: { href: "/children", label: "Open Children" },
  },
  {
    key: "privacy-checkup", priority: 7, minutes: 15, ages: [8, 17], article: "teach-kids-online-privacy",
    title: "Do a privacy check-up on one app",
    why: "Default settings on many apps share more than children realise. One check-up teaches them where to look.",
    steps: [
      "Pick the app your child uses most and open its privacy settings together.",
      "Check who can see their profile, message them and see their location.",
      "Change anything that's more open than you're both comfortable with.",
    ],
  },
  {
    key: "scams-talk", priority: 8, minutes: 10, ages: [8, 17], article: "online-scams-targeting-kids",
    title: "Talk about online scams",
    why: "Scams aimed at children (free game currency, prizes, fake friends) work because children haven't seen them before.",
    steps: [
      "Ask if they've ever seen an offer that sounded too good to be true.",
      "Agree that they never share codes, passwords or payment details, and ask you first.",
      "Read a few examples from the article together.",
    ],
  },
  {
    key: "stop-surprise-purchases", priority: 9, minutes: 10, article: "stop-surprise-in-app-purchases",
    title: "Stop surprise in-app purchases",
    why: "A purchase password or approval step takes minutes to set up and prevents an unexpected bill.",
    steps: [
      "On your child's device, open the app store's settings.",
      "Require a password or your approval for every purchase.",
      "Remove saved payment cards or e-wallets your child doesn't need.",
    ],
  },
  {
    key: "passwords-2fa", priority: 10, minutes: 15, ages: [9, 17], article: "passwords-and-2fa-for-kids",
    title: "Set up strong passwords and two-step verification",
    why: "Most account takeovers start with a reused or guessed password.",
    steps: [
      "Help your child pick a long passphrase for their main email or account.",
      "Turn on two-step verification where the app offers it.",
      "Agree that passwords are shared with parents, and never with friends.",
    ],
  },
  {
    key: "caregiver-rules", priority: 11, minutes: 10, article: "grandparents-yaya-screen-rules",
    title: "Share the screen rules with lolo, lola or yaya",
    why: "Rules work best when every adult who looks after your child knows them.",
    steps: [
      "Write down the two or three rules that matter most (bedtime, apps, meals).",
      "Share them with grandparents, titas or your yaya, and explain why they're there.",
      "Ask them to message you if your child asks for an exception.",
    ],
  },
  {
    key: "youtube-settings", priority: 12, minutes: 10, ages: [3, 15], article: "youtube-parental-controls",
    title: "Check YouTube's settings",
    why: "YouTube is where most children spend their screen time, and its settings change what the feed shows.",
    steps: [
      "Open the YouTube account your child uses and check its age setting or supervised experience.",
      "Turn off autoplay if videos keep running late.",
      "Watch a few minutes together and ask what they like.",
    ],
  },
  {
    key: "game-chat-settings", priority: 13, minutes: 15, ages: [6, 15], article: "roblox-chat-and-strangers",
    title: "Review chat settings in their favourite game",
    why: "In-game chat is where children most often meet people they don't know.",
    steps: [
      "Ask which game they play most and who they play with.",
      "Open that game's privacy or chat settings together and limit chat to friends.",
      "Agree they tell you if anyone asks for photos, gifts or to move to another app.",
    ],
  },
  {
    key: "location-agreement", priority: 14, minutes: 10, ages: [9, 17], article: "location-sharing-safety",
    title: "Agree how location sharing works in your family",
    why: "Location sharing builds trust when children know when and why it's used.",
    steps: [
      "Explain what you can see and when you check it.",
      "Agree which apps may know their location, and turn it off in the others.",
      "If you use eGuard's Location, show your child what it shows you.",
    ],
    appLink: { href: "/location", label: "Open Location" },
  },
  {
    key: "upstander-talk", priority: 15, minutes: 10, ages: [8, 17], article: "teaching-kids-to-be-upstanders",
    title: "Talk about standing up for others online",
    why: "Children who know how to help a friend being targeted make group chats kinder for everyone.",
    steps: [
      "Ask if they've seen someone treated badly in a group chat or game.",
      "Talk through safe ways to help: not joining in, a private message of support, telling an adult.",
      "Agree that telling you is never \"snitching\" when someone is being hurt.",
    ],
  },
  {
    key: "charge-outside-bedroom", priority: 16, minutes: 5, article: "phones-and-sleep",
    title: "Charge phones outside the bedroom overnight",
    why: "A phone that sleeps in another room protects sleep better than any setting.",
    steps: [
      "Pick one charging spot for the family, outside bedrooms.",
      "Agree the time phones go there each night, parents included.",
      "Try it for a week, then talk about how everyone slept.",
    ],
  },
];

const BY_KEY = new Map(ACTIVITIES.map((a) => [a.key, a]));
export const activityByKey = (key: string) => BY_KEY.get(key) ?? null;

export type ActivityState = { activityKey: string; status: string; completedAt: Date | null };

/** Whether an activity is worth suggesting now: not dismissed, not done (or done long enough ago to repeat). */
export function suggestible(a: Activity, state: ActivityState | undefined, now: Date) {
  if (!state) return true;
  if (state.status === "DISMISSED" || state.status === "STARTED") return false;
  if (state.status === "COMPLETED") return !!a.repeatDays && !!state.completedAt && now.getTime() - state.completedAt.getTime() >= a.repeatDays * 864e5;
  return true;
}

/**
 * This week's plan: one or two activities fitting the children's ages, not done or dismissed, in priority order.
 * One already in progress comes first (finishing beats starting). Two when both are short.
 */
export function pickPlan(o: { ages: number[]; states: ActivityState[]; now: Date }): string[] {
  const states = new Map(o.states.map((s) => [s.activityKey, s]));
  const fits = (a: Activity) => !a.ages || fitsAges(a.ages, o.ages);
  const started = ACTIVITIES.filter((a) => states.get(a.key)?.status === "STARTED" && fits(a));
  const fresh = ACTIVITIES.filter((a) => fits(a) && suggestible(a, states.get(a.key), o.now)).sort((x, y) => x.priority - y.priority);
  const picked = [...started, ...fresh].slice(0, 2);
  if (picked.length === 2 && picked[0].minutes + picked[1].minutes > 30) picked.pop();
  return picked.map((a) => a.key);
}

/** Ages from birth years, as the rest of the app counts them (this year minus birth year). Only ages leave here. */
export const agesFrom = (birthYears: number[], now = new Date()) => birthYears.map((y) => now.getUTCFullYear() - y);
