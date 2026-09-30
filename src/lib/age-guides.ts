/**
 * Age guides for the public /guides pages. The advice is written here; the suggested settings are not:
 * each guide names a sample age, and the page asks profiles.ts what eGuard would suggest for it.
 */
export type AgeGuide = {
  slug: string;
  /** "Ages 5 to 8" */
  label: string;
  /** Representative age used for the suggested settings */
  sampleAge: number;
  title: string;
  summary: string;
  /** What this stage tends to look like online */
  stage: string[];
  /** Where to focus first, as [heading, body] */
  focus: [string, string][];
  /** Conversation starters, in the parent's words */
  talk: string[];
  /** Signs it may be time to loosen a rule */
  loosen: string[];
  /** Protection slugs worth reading at this age */
  protections: string[];
};

export const AGE_GUIDES: AgeGuide[] = [
  {
    slug: "ages-5-8", label: "Ages 5 to 8", sampleAge: 7,
    title: "A first phone or tablet: ages 5 to 8",
    summary: "Young children are just starting out. Keep the device simple, choose the apps together, and make screen time a predictable part of the day.",
    stage: [
      "Most children this age use a shared tablet or a parent's old phone, mostly for videos, games and calls with family.",
      "They can't yet judge what's safe to tap, download or believe, so the device should do most of the filtering for them.",
    ],
    focus: [
      ["Only sites you've chosen", "Web filtering starts on Filter. For this age, consider switching it to Allowed sites only, so the browser opens just the handful of sites you've picked together."],
      ["Every new app goes through you", "Turn on App approval and Downloads, so nothing new appears without a quick look from you."],
      ["A short, steady daily limit", "A clear limit and a fixed bedtime are easier to accept than rules that change day to day."],
    ],
    talk: [
      "Which game or show is your favorite right now? Can you show me how it works?",
      "If something pops up that looks scary or strange, what should you do? (Come and get me.)",
      "Why do you think the tablet goes to sleep at bedtime?",
    ],
    loosen: [
      "They come to you when something unexpected shows up.",
      "They stop at the time limit without a battle most days.",
    ],
    protections: ["web", "app-approval", "screen-time", "bedtime"],
  },
  {
    slug: "ages-9-12", label: "Ages 9 to 12", sampleAge: 11,
    title: "Growing independence: ages 9 to 12",
    summary: "Many children get their own phone at this age. Keep strong defaults, and start handing over small decisions so they learn to make them.",
    stage: [
      "Their own phone often arrives with school, and so do group chats, games with other players and video apps.",
      "They want more say, and they're ready for some of it. They still need the device to catch what they can't yet.",
    ],
    focus: [
      ["Age ratings do the everyday work", "App and content age ratings block what's clearly too old, so you only need to weigh in on the edge cases."],
      ["Requests, not arguments", "Show them Ask for an app and Ask a parent. A request with a reason turns a fight into a quick decision."],
      ["Protect sleep", "Bedtime, plus quiet notifications on Android, keeps late-night group chats from cutting into sleep."],
    ],
    talk: [
      "Who's in your group chats? Is there anyone you don't know in real life?",
      "What would you do if someone online asked for a photo, or asked you to keep a secret?",
      "Which rule feels unfair to you? Let's talk about why it's there.",
    ],
    loosen: [
      "Their requests come with good reasons, and they accept a no.",
      "They tell you about problems online instead of hiding them.",
      "They manage their daily limit without running out early every day.",
    ],
    protections: ["apps", "content", "app-approval", "bedtime", "notifications"],
  },
  {
    slug: "ages-13-15", label: "Ages 13 to 15", sampleAge: 14,
    title: "Teen years: ages 13 to 15",
    summary: "Teenagers need privacy and room to grow. eGuard suggests the Balanced profile here: firm on sleep and safety, looser on everything else.",
    stage: [
      "Friends, social apps and school work all live on the phone now. Taking it away affects their whole social life.",
      "Rules work best when they're agreed, not imposed. eGuard is visible on their phone, and on Android teens are asked to agree to supervision.",
    ],
    focus: [
      ["Agree the rules together", "Sit down with the family agreement. Teens keep rules they helped write far better than rules handed to them."],
      ["Sleep first", "A later bedtime than before, but still a bedtime. It's the rule with the clearest payoff."],
      ["Keep an eye on changes, not on them", "Configuration Health tells you when a setting is switched off. It never reads messages or tracks sites they visit."],
    ],
    talk: [
      "How do you want to handle screen time during exams?",
      "Has anything online made you feel bad about yourself lately?",
      "If a friend were in trouble online, would you know how to help?",
    ],
    loosen: [
      "They stick to the agreement without reminders.",
      "They bring you problems early.",
      "Try a longer weekend limit or a later bedtime for a month, then review together.",
    ],
    protections: ["screen-time", "bedtime", "location", "uninstall-protection"],
  },
  {
    slug: "ages-16-17", label: "Ages 16 to 17", sampleAge: 16,
    title: "Almost adults: ages 16 to 17",
    summary: "Older teens are getting ready to manage on their own. Use eGuard as a safety net, not a leash, and plan together how it winds down.",
    stage: [
      "Within a couple of years they'll manage their own phone completely. The goal now is practice, with a safety net.",
      "Heavy restrictions tend to push teens to work around them. Light, agreed rules keep the conversation open.",
    ],
    focus: [
      ["Only the essentials", "Keep what protects sleep and safety, like bedtime on school nights and location sharing if the family wants it. Relax the rest."],
      ["Let them see everything", "Walk through what eGuard shows you. Nothing on their side is hidden, and they should know that."],
      ["Plan the handover", "Agree a date or milestone when protections switch off, and when they'll manage their own phone."],
    ],
    talk: [
      "What would you like to manage yourself from now on?",
      "When should we switch eGuard off completely?",
      "What have you learned about managing your own screen time?",
    ],
    loosen: [
      "Switch bedtime to school nights only.",
      "Turn off App approval and rely on age ratings.",
      "Agree a date to remove the device from eGuard together.",
    ],
    protections: ["bedtime", "location", "screen-time"],
  },
];

export const ageGuide = (slug: string) => AGE_GUIDES.find((g) => g.slug === slug) ?? null;
