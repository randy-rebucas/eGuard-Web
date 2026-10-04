import type { Topic, TopicId } from "./types";

/** In the order they appear on /learn. Each topic page targets one search parents make. */
export const TOPICS: Topic[] = [
  {
    id: "online-safety",
    label: "Online safety basics",
    title: "How to protect kids online",
    description: "The foundations of child online safety in the Philippines: first phones, privacy, scams, passwords, location sharing and spending.",
    intro: "Most online safety comes down to a handful of habits set up early and revisited as your child grows. Start here if you're not sure where to begin, or if your child is about to get their first phone.",
    pillar: "how-to-protect-kids-online",
  },
  {
    id: "parental-controls",
    label: "Parental controls",
    title: "Parental controls in the Philippines",
    description: "Practical guides to parental controls on Android, iPhone, Samsung, YouTube, home Wi-Fi and browsers, and how to choose an app.",
    intro: "Parental controls are tools, not a substitute for talking with your child. Used well, they take the nightly arguments off your plate and keep young children away from content they're not ready for. These guides cover the controls built into the phones and services Filipino families use most.",
    pillar: "parental-controls-philippines-guide",
  },
  {
    id: "screen-time",
    label: "Screen time",
    title: "Screen time for children",
    description: "How much screen time is right at each age, how to set school-night routines, protect sleep and end screen time without a fight.",
    intro: "There's no perfect number of minutes. What matters more is what your child is doing on screens, what it's replacing, and whether it's cutting into sleep, school and time with family. These guides help you set limits that fit your home.",
    pillar: "how-much-screen-time-by-age",
  },
  {
    id: "exploitation",
    label: "Grooming and exploitation",
    title: "Online grooming, sextortion and exploitation",
    description: "How online grooming and sextortion work, the warning signs, and how to report online child abuse in the Philippines.",
    intro: "This is the hardest topic for any parent, and the one where knowing what to look for matters most. The Philippines is one of the countries most affected by online sexual abuse and exploitation of children. These guides explain how it happens, what to say to your child, and exactly what to do if something goes wrong.",
    pillar: "online-grooming-warning-signs",
  },
  {
    id: "cyberbullying",
    label: "Cyberbullying",
    title: "Cyberbullying in the Philippines",
    description: "Spot the signs of cyberbullying, respond step by step, work with your child's school under the Anti-Bullying Act, and get help.",
    intro: "Cyberbullying follows children home. It happens in group chats, comment sections and games, often where adults can't see it. These guides cover how to notice it, what to do in the first hour, how to involve the school, and what to do if your child is the one doing it.",
    pillar: "cyberbullying-philippines-guide",
  },
  {
    id: "social-media",
    label: "Social media",
    title: "Social media safety for kids",
    description: "When kids are ready for social media, and the settings that matter on Facebook, Instagram, Snapchat and YouTube.",
    intro: "Social media is where many Filipino teens spend most of their online time. The minimum age on most apps is 13, but readiness isn't just about age. These guides cover the settings that matter most and the conversations that go with them.",
    pillar: "social-media-safety-kids",
  },
  {
    id: "tiktok",
    label: "TikTok",
    title: "TikTok safety for kids",
    description: "TikTok's age rules, Family Pairing, privacy settings, screen time limits, LIVE and gifts, and how the For You feed works.",
    intro: "TikTok is one of the most-used apps among Filipino teens and preteens. It has more built-in safety settings than many parents realize. These guides walk through each one and explain what TikTok can and can't do to keep your child safe.",
    pillar: "tiktok-safety-for-kids",
  },
  {
    id: "gaming",
    label: "Roblox and gaming",
    title: "Roblox and online gaming safety for parents",
    description: "Roblox parental controls, chat and Robux, Mobile Legends, Minecraft, consoles, loot boxes, online gambling and gaming habits.",
    intro: "Games are social spaces now: kids chat, trade and make friends while they play. That's a lot of the fun, and also where most of the risk sits. These guides cover the games Filipino kids play most and the controls each one offers.",
    pillar: "roblox-safety-parents",
  },
  {
    id: "chat-apps",
    label: "Discord and chat apps",
    title: "Discord and chat app safety for parents",
    description: "Discord safety settings and Family Center, servers, Messenger and Telegram, disappearing messages and random chat apps.",
    intro: "Private messages are where most serious online harm starts, because they're where nobody else is watching. These guides explain how Discord and the chat apps kids use work, and the settings that make them safer.",
    pillar: "discord-safety-parents",
  },
  {
    id: "ai",
    label: "AI safety",
    title: "AI safety for children",
    description: "AI chatbots and companion apps, homework and honesty, deepfakes and nudify apps, voice-clone scams and spotting AI images.",
    intro: "AI tools arrived in children's lives faster than any rules about them. Some uses are genuinely helpful; others carry new risks that didn't exist a few years ago. These guides help you sort one from the other.",
    pillar: "ai-safety-children",
  },
  {
    id: "digital-parenting",
    label: "Digital parenting",
    title: "Digital parenting in the Philippines",
    description: "Raising kids online in Filipino homes: talking about online life, OFW families, lolo, lola and yaya, school devices and Philippine laws.",
    intro: "Filipino families raise children together: parents, grandparents, titas, older siblings and yayas, sometimes across countries. These guides cover the parts of digital parenting that are specific to how we live.",
    pillar: "digital-parenting-philippines",
  },
];

export const topicById = (id: string) => TOPICS.find((t) => t.id === id) ?? null;
export const TOPIC_IDS = TOPICS.map((t) => t.id) as TopicId[];
