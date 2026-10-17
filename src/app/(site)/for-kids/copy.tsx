import { AppWindow, Globe, Hand, Hourglass, MapPin, MessageCircleHeart, Moon, Sparkles, type LucideIcon } from "lucide-react";

/**
 * The page for children (/for-kids) and its family agreement, in English and Filipino (/fil/for-kids). Both
 * languages render through the same KidsPage, so they always have the same sections. Button names in the eGuard app
 * ("Ask a parent", "Ask for an app") stay in English in both, since that's what the child sees on screen.
 */
export type Lang = "en" | "fil";

export type KidsCopy = {
  meta: { title: string; description: string };
  switchTo: { label: string; href: string; lang: string };
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  what: { title: string; body: React.ReactNode[]; caption: string; phoneLabel: string };
  does: { title: string; items: [LucideIcon, string, string, string][] };
  see: { title: string; can: string; canList: string[]; cant: string; cantList: string[] };
  ask: { title: string; body: string; steps: [string, React.ReactNode][] };
  tips: [LucideIcon, string, string][];
  team: { title: string; body: string };
  agreement: {
    eyebrow: string; title: string; body: string; print: string; fields: string[]; wideField: string;
    kidTitle: string; kid: string[]; parentTitle: string; parent: string[]; sign: [string, string, string]; foot: string;
  };
  cta: { title: string; body: string; button: string };
};

export const KIDS_COPY: Record<Lang, KidsCopy> = {
  en: {
    meta: {
      title: "eGuard, explained for kids",
      description: "A page for children: what eGuard does on your phone, what your parents can and can't see, how to ask for an app or a website, and a family agreement to fill in together.",
    },
    switchTo: { label: "Basahin sa Filipino", href: "/fil/for-kids", lang: "fil" },
    eyebrow: "For kids",
    title: <>Hi! Your family uses <span className="lp-accent">eGuard</span>.</>,
    lede: "Here's what eGuard does on your phone, what your parents can and can't see, and how to ask for something. It's short, promise.",
    what: {
      title: "What is eGuard?",
      body: [
        <>eGuard is an app that helps your family agree on how phones and tablets are used, like how much time, and when it&apos;s bedtime.</>,
        <>It&apos;s <b>never secret</b>. You can always open eGuard and see exactly what&apos;s on. If your parents change something, it shows up there too.</>,
      ],
      caption: "What you see in eGuard",
      phoneLabel: "The eGuard app on a child's phone, showing screen time left, bedtime, and an Ask for an app button",
    },
    does: {
      title: "What eGuard does",
      items: [
        [Hourglass, "blue", "Screen time", "You get a set amount of phone time each day. eGuard shows how much is left, so it's never a surprise."],
        [Moon, "purple", "Bedtime", "At night, apps rest too. They come back in the morning at the time your family picked."],
        [AppWindow, "green", "New apps", "Some new apps need a parent's OK first. You can ask right from eGuard."],
        [Globe, "blue", "Websites", "Some websites are blocked. If you need one for school, tap Ask a parent."],
        [MapPin, "orange", "Location", "If your family turns it on, your parents can see where your phone is, to know you're safe."],
      ],
    },
    see: {
      title: "What your parents can see, and what they can't",
      can: "They can see",
      canList: [
        "Which eGuard settings are on",
        "How long you used your phone today, and which apps",
        "Where your phone is, if location sharing is on, and places it's been, if your family keeps location history",
        "How many websites were blocked each day",
        "An app or website you ask for, and the reason you give",
      ],
      cant: "eGuard never shows them",
      cantList: ["Your messages and chats", "Your photos and videos", "Which websites you visit (only one you ask for)", "What you type", "Your calls"],
    },
    ask: {
      title: "Need something? Just ask",
      body: "A block isn't the end. If you need an app or a website, ask. Your parent gets your request on their phone or computer and can say yes in a moment.",
      steps: [
        ["Tap Ask", <>Use <em>Ask for an app</em> in eGuard, or <em>Ask a parent</em> on a blocked website.</>],
        ["Say why", <>On a website, add a reason, like &ldquo;for my science homework&rdquo;. For an app, tell your parent why. It really helps.</>],
        ["Wait a little", <>When your parent says yes, the app or site opens. Sometimes it&apos;s just for a while.</>],
      ],
    },
    tips: [
      [MessageCircleHeart, "Talk about it", "If a rule feels unfair, tell your parents why. Rules can change."],
      [Hand, "Speak up", "If something online scares or upsets you, tell a grown-up you trust. You won't be in trouble."],
      [Sparkles, "Grow into it", "As you get older, your family can give you more time and freedom."],
    ],
    team: {
      title: "eGuard is a team thing",
      body: "eGuard works best when your family decides the rules together. The agreement below is a good way to start: fill it in with your parents, sign it, and put it somewhere you'll see it.",
    },
    agreement: {
      eyebrow: "Family agreement",
      title: "Our family's phone agreement",
      body: "Fill it in together. Change it whenever you all agree.",
      print: "Print the agreement",
      fields: ["Screen time on school days", "Screen time on weekends", "Phones go to sleep at", "Phones charge overnight in"],
      wideField: "Phone-free times (like meals)",
      kidTitle: "I promise…",
      kid: [
        "I'll ask before downloading a new app",
        "I'll put my phone away at bedtime",
        "I'll tell a grown-up if something online makes me feel uncomfortable",
        "I won't try to switch eGuard off",
      ],
      parentTitle: "As your parent, I promise…",
      parent: [
        "I'll explain the rules, not just set them",
        "I'll answer your requests as soon as I can",
        "I'll give you more freedom as you grow",
        "I'll listen if a rule doesn't feel fair",
      ],
      sign: ["Child's name and signature", "Parent's name and signature", "Date"],
      foot: "Made with eGuard · eguard.family",
    },
    cta: {
      title: "Are you a parent?",
      body: "Share this page with your child when you set up their phone. See how it works on your side.",
      button: "How eGuard works",
    },
  },

  fil: {
    meta: {
      title: "Ang eGuard, ipinaliwanag para sa mga bata",
      description: "Isang pahina para sa mga bata: ano ang ginagawa ng eGuard sa phone mo, ano ang nakikita at hindi nakikita ng mga magulang mo, paano humingi ng app o website, at isang kasunduan ng pamilya na sabay ninyong sasagutan.",
    },
    switchTo: { label: "Read in English", href: "/for-kids", lang: "en" },
    eyebrow: "Para sa mga bata",
    title: <>Hi! Gumagamit ang pamilya mo ng <span className="lp-accent">eGuard</span>.</>,
    lede: "Narito kung ano ang ginagawa ng eGuard sa phone mo, ano ang nakikita at hindi nakikita ng mga magulang mo, at paano humingi ng isang bagay. Maikli lang ito, pangako.",
    what: {
      title: "Ano ang eGuard?",
      body: [
        <>Ang eGuard ay isang app na tumutulong sa pamilya mo na magkasundo kung paano gagamitin ang mga phone at tablet, gaya ng kung gaano katagal, at kung kailan oras na ng tulog.</>,
        <><b>Hindi ito lihim.</b> Puwede mong buksan ang eGuard anumang oras at makita kung ano mismo ang naka-on. Kapag may binago ang mga magulang mo, makikita mo rin iyon doon.</>,
      ],
      caption: "Ang nakikita mo sa eGuard",
      phoneLabel: "Ang eGuard app sa phone ng isang bata, na nagpapakita ng natitirang oras sa phone, oras ng tulog, at ng button na Ask for an app",
    },
    does: {
      title: "Ano ang ginagawa ng eGuard",
      items: [
        [Hourglass, "blue", "Oras sa phone", "May nakatakdang oras ka sa phone bawat araw. Ipinapakita ng eGuard kung gaano pa katagal ang natitira, kaya hindi ka magugulat."],
        [Moon, "purple", "Oras ng tulog", "Sa gabi, nagpapahinga rin ang mga app. Babalik sila sa umaga, sa oras na pinili ng pamilya mo."],
        [AppWindow, "green", "Mga bagong app", "May mga bagong app na kailangan munang payagan ng magulang. Puwede kang humingi mismo sa eGuard."],
        [Globe, "blue", "Mga website", "May mga website na naka-block. Kung kailangan mo ang isa para sa school, i-tap ang Ask a parent."],
        [MapPin, "orange", "Lokasyon", "Kung bubuksan ito ng pamilya mo, makikita ng mga magulang mo kung nasaan ang phone mo, para malaman nilang ligtas ka."],
      ],
    },
    see: {
      title: "Ano ang nakikita ng mga magulang mo, at ano ang hindi",
      can: "Nakikita nila",
      canList: [
        "Kung aling mga setting ng eGuard ang naka-on",
        "Gaano katagal mong ginamit ang phone mo ngayong araw, at aling mga app",
        "Kung nasaan ang phone mo, kapag naka-on ang location sharing, at ang mga lugar na napuntahan nito, kapag naka-on ang location history ng pamilya mo",
        "Ilang website ang na-block bawat araw",
        "Ang app o website na hiningi mo, at ang dahilang ibinigay mo",
      ],
      cant: "Hindi kailanman ipinapakita ng eGuard sa kanila",
      cantList: ["Ang mga message at chat mo", "Ang mga litrato at video mo", "Kung aling mga website ang binibisita mo (maliban sa hiningi mo)", "Ang mga tina-type mo", "Ang mga tawag mo"],
    },
    ask: {
      title: "May kailangan ka? Humingi ka lang",
      body: "Hindi katapusan ang pag-block. Kung kailangan mo ang isang app o website, humingi ka. Matatanggap ng magulang mo ang hiling mo sa phone o computer nila, at puwede silang pumayag agad.",
      steps: [
        ["I-tap ang Ask", <>Gamitin ang <em>Ask for an app</em> sa eGuard, o ang <em>Ask a parent</em> sa website na naka-block.</>],
        ["Sabihin kung bakit", <>Sa website, magdagdag ng dahilan, gaya ng &ldquo;para sa science homework ko&rdquo;. Sa app, sabihin sa magulang mo kung bakit. Malaking tulong iyon.</>],
        ["Maghintay sandali", <>Kapag pumayag ang magulang mo, bubukas ang app o website. Minsan, pansamantala lang.</>],
      ],
    },
    tips: [
      [MessageCircleHeart, "Pag-usapan ninyo", "Kung parang hindi patas ang isang patakaran, sabihin mo sa mga magulang mo kung bakit. Puwedeng magbago ang mga patakaran."],
      [Hand, "Magsalita ka", "Kung may nakita ka online na nakakatakot o nakakalungkot, sabihin mo sa isang nakatatandang pinagkakatiwalaan mo. Hindi ka mapapagalitan."],
      [Sparkles, "Habang lumalaki ka", "Habang tumatanda ka, puwedeng bigyan ka ng pamilya mo ng mas maraming oras at kalayaan."],
    ],
    team: {
      title: "Pang-team ang eGuard",
      body: "Pinakamahusay gumagana ang eGuard kapag sabay na nagpapasya ang pamilya sa mga patakaran. Magandang simula ang kasunduan sa ibaba: sagutan ninyo ito kasama ang mga magulang mo, pirmahan, at ilagay sa lugar na lagi mong makikita.",
    },
    agreement: {
      eyebrow: "Kasunduan ng pamilya",
      title: "Ang kasunduan ng aming pamilya sa paggamit ng phone",
      body: "Sabay ninyong sagutan. Puwede itong baguhin kapag pumayag ang lahat.",
      print: "I-print ang kasunduan",
      fields: ["Oras sa phone kapag may pasok", "Oras sa phone tuwing weekend", "Oras ng tulog ng mga phone", "Saan nagcha-charge ang mga phone sa gabi"],
      wideField: "Mga oras na walang phone (gaya ng kainan)",
      kidTitle: "Nangangako ako…",
      kid: [
        "Magpapaalam muna ako bago mag-download ng bagong app",
        "Itatabi ko ang phone ko pagdating ng oras ng tulog",
        "Sasabihin ko sa isang nakatatanda kapag may nakita ako online na nagpabahala sa akin",
        "Hindi ko susubukang i-off ang eGuard",
      ],
      parentTitle: "Bilang magulang mo, nangangako ako…",
      parent: [
        "Ipapaliwanag ko ang mga patakaran, hindi lang basta itatakda",
        "Sasagutin ko agad ang mga hiling mo hangga't kaya ko",
        "Bibigyan kita ng mas maraming kalayaan habang lumalaki ka",
        "Makikinig ako kapag sa tingin mo ay hindi patas ang isang patakaran",
      ],
      sign: ["Pangalan at pirma ng bata", "Pangalan at pirma ng magulang", "Petsa"],
      foot: "Ginawa gamit ang eGuard · eguard.family",
    },
    cta: {
      title: "Magulang ka ba?",
      body: "Ibahagi ang pahinang ito sa anak mo kapag inaayos ninyo ang phone niya. Tingnan kung paano gumagana ang eGuard sa panig mo (sa Ingles).",
      button: "Paano gumagana ang eGuard",
    },
  },
};

/** Both versions, for hreflang (lib/site pageMetadata `languages`) */
export const KIDS_LANGUAGES = { "en-PH": "/for-kids", "fil-PH": "/fil/for-kids" };
