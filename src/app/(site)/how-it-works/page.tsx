import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown, ArrowRight, BellRing, Check, Cloud, EyeOff, KeyRound, Monitor, Puzzle, Send, ShieldCheck, Smartphone,
  TabletSmartphone, ToggleLeft, Trash2, WifiOff, X, type LucideIcon,
} from "lucide-react";
import { pageMetadata } from "@/lib/site";
import { AndroidMark, AppleMark, ChromeMark, EdgeMark, FirefoxMark, STORE_LINKS } from "@/components/brand-marks";
import {
  Laptop, Phone, ScreenBrowserAllowed, ScreenBrowserBlocked, ScreenBrowserConnected, ScreenChildHome, ScreenChildPair,
  ScreenChildSetup, ScreenPairingCode, ScreenParentAlerts, ScreenParentChild, ScreenWebBedtime, ScreenWebDashboard,
  ServerCloud,
} from "@/components/flow-devices";
import { StartLink } from "@/components/signed-in";
import { PageHead } from "../page-head";
import "./how-it-works.css";

export const metadata: Metadata = pageMetadata({
  title: "How eGuard works",
  path: "/how-it-works",
  description: "See how the eGuard parent app, web dashboard, your child's phone and the Chrome, Edge and Firefox extension work together, and how every rule gets verified on the device.",
});

const JUMP: [string, string][] = [
  ["#big-picture", "The big picture"], ["#setup", "Setting up"], ["#verified", "How a rule is verified"],
  ["#iphone-android", "iPhone & Android"], ["#requests", "When your child asks"], ["#privacy", "Privacy"], ["#get-eguard", "Get eGuard"],
];

type Avail = { mark: () => React.ReactElement; label: string; live: boolean };
const PIECES: { icon: LucideIcon; tone: string; who: string; name: string; body: string; avail: Avail[] }[] = [
  { icon: Smartphone, tone: "blue", who: "For you", name: "Parent app",
    body: "Add your children, choose their protections, get pairing codes, answer requests and read alerts from your phone.",
    avail: [{ mark: AndroidMark, label: "Android", live: true }, { mark: AppleMark, label: "iPhone: soon", live: false }] },
  { icon: Monitor, tone: "blue", who: "For you", name: "Web dashboard",
    body: "Everything the app does on a bigger screen, plus reports, CSV export and your plan. Open it in any browser.",
    avail: [{ mark: () => <Monitor />, label: "eguard.family", live: true }] },
  { icon: Cloud, tone: "ink", who: "Runs for you", name: "eGuard Cloud",
    body: "The go-between. It keeps your family's settings, sends them to each device, checks what comes back, and alerts you.",
    avail: [{ mark: () => <Check />, label: "Nothing to install", live: true }] },
  { icon: TabletSmartphone, tone: "green", who: "On your child's device", name: "eGuard on their phone",
    body: "The same eGuard app in child mode. It applies your rules, then reports what's really on. Always visible, never hidden.",
    avail: [{ mark: AndroidMark, label: "Android", live: true }, { mark: AppleMark, label: "iPhone & iPad: soon", live: false }] },
  { icon: Puzzle, tone: "green", who: "On your child's computer", name: "Browser extension",
    body: "Blocks harmful sites and categories, turns on SafeSearch, and lets your child ask before opening a blocked site.",
    avail: [{ mark: ChromeMark, label: "Chrome", live: true }, { mark: EdgeMark, label: "Edge", live: true }, { mark: FirefoxMark, label: "Firefox", live: true }] },
];

const TRACK: { time: string; title: string; body: string; chip: [string, string] }[] = [
  { time: "9:00:00 PM", title: "You tap Save", body: "Bedtime at 9:30 PM for Mia, from your phone or the web. Both save to the same place.", chip: ["Saved", "info"] },
  { time: "9:00:01 PM", title: "eGuard lines it up", body: "A change is queued for each of Mia's devices: her phone and her browser.", chip: ["Pending", "wait"] },
  { time: "Within 5 min", title: "Each device picks it up", body: "Phones and browsers check in about every 5 minutes. A device that's offline gets it as soon as it's back.", chip: ["Delivered", "info"] },
  { time: "Seconds later", title: "The device applies it and looks again", body: "It reads the setting back from the phone or browser, and reports what it actually has, not what it was asked for.", chip: ["Reported", "info"] },
  { time: "9:02 PM", title: "You see Verified", body: "The report matches, so Bedtime turns green on your dashboard and your Configuration Health updates.", chip: ["Verified", "ok"] },
];

const WHAT_IF: [LucideIcon, string, string][] = [
  [WifiOff, "The phone or laptop goes offline",
    "Protection stays on. Devices keep following the last rules they received and pick up changes when they reconnect. If a browser hasn't checked in for a day, you'll see “eGuard can't verify this browser”."],
  [ToggleLeft, "Someone switches a setting off",
    "The device reports what it really has, so eGuard notices the difference and alerts you: “Protection setting changed”, with the device and the setting."],
  [KeyRound, "Someone tries to copy the connection",
    "Each device gets its own key, never your password. If a browser's key turns up in two places, eGuard disconnects it and tells you, and it has to be added again with a new code."],
  [Trash2, "You want to stop protecting a device",
    "Remove it from Devices in the app or on the web. It stops following your rules and frees a device slot on your plan. Phones and browsers count the same."],
];

const SEES = [
  "Whether each protection is on, and when it was checked",
  "Screen time totals and the names of apps used",
  "Current location, only if you turn location on",
  "How many pages the browser blocked each day, by category",
];
const NEVER = [
  "Messages, photos or files",
  "Which websites your child visits",
  "Keystrokes, calls, contacts, camera or microphone",
  "Anything to sell or show ads with. eGuard has no ads",
];

function Section({ id, eyebrow, title, lede, center, children }: {
  id: string; eyebrow: string; title: React.ReactNode; lede?: React.ReactNode; center?: boolean; children: React.ReactNode;
}) {
  return (
    <section id={id} className="hw-sec" aria-labelledby={`${id}-h`}>
      <div className={`hw-sec-head${center ? " center" : ""}`}>
        <span className="lp-eyebrow">{eyebrow}</span>
        <h2 id={`${id}-h`}>{title}</h2>
        {lede ? <p>{lede}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Two flows between columns of the big-picture map: settings going out, confirmations coming back. */
function Lane({ out, back }: { out: string; back: string }) {
  return (
    <div className="hw-lane" aria-hidden="true">
      <span className="hw-pipe out"><em>{out}</em></span>
      <span className="hw-pipe back"><em>{back}</em></span>
    </div>
  );
}

function Platforms({ items }: { items: [() => React.ReactElement, string][] }) {
  return <ul className="hw-platforms">{items.map(([Mark, label]) => <li key={label}><Mark />{label}</li>)}</ul>;
}

export default function HowItWorksPage() {
  return (
    <>
      <PageHead
        eyebrow="How it works"
        title={<>One family account. <span className="lp-accent">Every screen</span> in step.</>}
        lede="eGuard is a few pieces that work as one: an app and a website for you, an app on your child's phone, and an extension in their browser. Here's how they fit together, and how eGuard makes sure every rule is really on."
      >
        <nav className="hw-jump" aria-label="On this page">
          {JUMP.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
      </PageHead>

      <div className="hw">
        {/* ---------- Big picture ---------- */}
        <Section id="big-picture" eyebrow="The big picture" center
          title="You set the rules. eGuard delivers them. Every device proves it."
          lede="Settings travel from you to your child's devices through eGuard. Each device then reports back what it actually has, so what you see is what's really on.">
          <div className="hw-map">
            <div className="hw-map-grid">
              <div className="hw-col">
                <span className="hw-tag">1 · You, the parent</span>
                <div className="hw-stage">
                  <Laptop browser="chrome" url="eguard.family/dashboard" tab="Dashboard · eGuard" site label="The eGuard web dashboard on a laptop">
                    <ScreenWebDashboard />
                  </Laptop>
                  <Phone os="ios" className="hw-at-left" label="The eGuard parent app on an iPhone, showing Mia's protections"><ScreenParentChild /></Phone>
                  <Phone os="android" className="hw-at-right" label="The eGuard parent app on an Android phone, showing a website request"><ScreenParentAlerts /></Phone>
                </div>
                <h3>Parent app and web dashboard</h3>
                <p>Choose protections, add devices, and see what&apos;s verified, from whichever screen is handy.</p>
                <Platforms items={[[AndroidMark, "Android"], [() => <Monitor />, "Web"], [AppleMark, "iPhone: soon"]]} />
              </div>

              <Lane out="Your settings" back="Verified" />

              <div className="hw-col hw-col-cloud">
                <span className="hw-tag cloud">2 · eGuard Cloud</span>
                <div className="hw-cloud-art"><ServerCloud /></div>
                <h3>The go-between</h3>
                <ul className="hw-jobs">
                  <li><Send />Delivers your settings</li>
                  <li><ShieldCheck />Checks every report</li>
                  <li><BellRing />Alerts you to changes</li>
                </ul>
              </div>

              <Lane out="Settings" back="What's on" />

              <div className="hw-col">
                <span className="hw-tag child">3 · Your child</span>
                <div className="hw-stage">
                  <Laptop browser="chrome" url="coolgames.example" tab="Blocked · eGuard" extension label="A blocked site in Chrome with the eGuard extension open">
                    <ScreenBrowserBlocked />
                  </Laptop>
                  <Phone os="android" className="hw-at-right" label="eGuard on a child's Android phone, showing what's on"><ScreenChildHome /></Phone>
                </div>
                <h3>Their phone and browser</h3>
                <p>eGuard applies your rules on their phone or tablet, and the extension does it in their browser.</p>
                <Platforms items={[[AndroidMark, "Android"], [ChromeMark, "Chrome"], [EdgeMark, "Edge"], [FirefoxMark, "Firefox"], [AppleMark, "iPhone & iPad: soon"]]} />
              </div>
            </div>
          </div>

          <ul className="hw-pieces">
            {PIECES.map(({ icon: Ico, tone, who, name, body, avail }) => (
              <li key={name} className="hw-piece">
                <i className={`hw-piece-ico ${tone}`}><Ico /></i>
                <span className="hw-piece-who">{who}</span>
                <h3>{name}</h3>
                <p>{body}</p>
                <ul className="hw-avail">
                  {avail.map(({ mark: Mark, label, live }) => <li key={label} className={live ? "live" : "soon"}><Mark />{label}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------- Setup ---------- */}
        <Section id="setup" eyebrow="Setting up" title="From sign-up to protected, in five steps"
          lede="Have your child's phone and computer nearby. Connecting each device takes a few minutes.">
          <ol className="hw-steps">
            <li className="hw-step">
              <div className="hw-art">
                <Laptop browser="chrome" url="eguard.family/dashboard" tab="Dashboard · eGuard" site caption="Web dashboard, in any browser" label="The eGuard web dashboard with three children">
                  <ScreenWebDashboard />
                </Laptop>
              </div>
              <div className="hw-step-copy">
                <span className="hw-num">1</span>
                <h3>Create your family account</h3>
                <p>Sign up at eguard.family or in the Android app. Add each child with their age, and eGuard suggests a starting profile, <b>Balanced</b> or <b>Protected</b>, that you can adjust.</p>
                <p className="hw-tip"><Check />Free for one child. No card needed.</p>
              </div>
            </li>

            <li className="hw-step">
              <div className="hw-art">
                <Phone os="ios" caption="Parent app on iPhone" className="hw-solo" label="The parent app showing a pairing code, K7PQ 2M9X, for Mia's phone">
                  <ScreenPairingCode />
                </Phone>
              </div>
              <div className="hw-step-copy">
                <span className="hw-num">2</span>
                <h3>Get a pairing code</h3>
                <p>Open your child and choose <b>Add device</b>. You get an 8-character code that works once and lasts 15 minutes. Choose <b>Browser</b> instead to get a code for a computer.</p>
                <p className="hw-tip"><KeyRound />The code is how a device joins your family. Your password never goes near it.</p>
              </div>
            </li>

            <li className="hw-step">
              <div className="hw-art hw-art-duo">
                <Phone os="android" caption="Child's Android phone" className="hw-solo" label="eGuard on a child's phone, entering the pairing code">
                  <ScreenChildPair />
                </Phone>
                <Laptop browser="edge" url="eGuard extension setup" tab="eGuard setup" extension caption="Extension in Edge" label="The eGuard extension in Microsoft Edge, connected to Mia">
                  <ScreenBrowserConnected />
                </Laptop>
              </div>
              <div className="hw-step-copy">
                <span className="hw-num">3</span>
                <h3>Connect your child&apos;s phone and browser</h3>
                <p><b>Phone or tablet:</b> install eGuard, choose <b>I&apos;m setting up my child&apos;s device</b>, and enter the code. eGuard explains each permission before your phone asks for it.</p>
                <p><b>Computer:</b> add the eGuard extension to Chrome, Edge or Firefox, and type the browser code on its setup page.</p>
              </div>
            </li>

            <li className="hw-step">
              <div className="hw-art">
                <Laptop browser="chrome" url="eguard.family/children/mia" tab="Mia · eGuard" site caption="Web dashboard" label="Changing Mia's bedtime to 9:30 PM and sending it to her devices">
                  <ScreenWebBedtime />
                </Laptop>
              </div>
              <div className="hw-step-copy">
                <span className="hw-num">4</span>
                <h3>Choose the protections you want</h3>
                <p>Screen time, bedtime, apps, content ratings, web filtering, downloads, location and more: <Link href="/protections">ten protections in all</Link>. Change any of them from the app or the web, whenever you like.</p>
                <p className="hw-tip"><Send />eGuard sends each change to every one of that child&apos;s devices at once.</p>
              </div>
            </li>

            <li className="hw-step">
              <div className="hw-art">
                <Phone os="android" caption="Parent app on Android" className="hw-solo" label="The parent app showing 9 of 10 protections verified for Mia">
                  <ScreenParentChild />
                </Phone>
              </div>
              <div className="hw-step-copy">
                <span className="hw-num">5</span>
                <h3>Watch each one turn Verified</h3>
                <p>Every protection shows its real status on each device: <span className="hw-pill ok">Verified</span> <span className="hw-pill wait">Pending</span> or <span className="hw-pill fail">Failed</span>. Configuration Health adds them up into one score per child.</p>
                <p className="hw-tip"><ShieldCheck />The score measures how devices are set up. It never scores your child&apos;s behavior.</p>
              </div>
            </li>
          </ol>
        </Section>

        {/* ---------- Verification ---------- */}
        <Section id="verified" eyebrow="Verified, not just saved" center
          title="Follow one setting from your screen to theirs"
          lede={<>Most parental controls stop at &ldquo;Saved&rdquo;. eGuard waits until the device confirms it. Here&apos;s what happens when you set Mia&apos;s bedtime to 9:30 PM.</>}>
          <ol className="hw-track">
            {TRACK.map(({ time, title, body, chip: [label, tone] }, i) => (
              <li key={title} className={i === TRACK.length - 1 ? "done" : undefined}>
                <span className="hw-dot">{i === TRACK.length - 1 ? <Check /> : i + 1}</span>
                <small className="num">{time}</small>
                <h3>{title}</h3>
                <p>{body}</p>
                <span className={`hw-pill ${tone}`}>{label}</span>
              </li>
            ))}
          </ol>
          <div className="hw-track-notes">
            <p><span className="hw-pill fail">Failed</span>If the device reports something different, you see Failed, along with what the device actually has, so you know what to fix.</p>
            <p><span className="hw-pill ok">Still verified</span>eGuard keeps checking every time the device checks in. If the setting changes later, you get an alert.</p>
          </div>
        </Section>

        {/* ---------- iPhone and Android ---------- */}
        <Section id="iphone-android" eyebrow="iPhone & Android" title="Same protections, a slightly different path"
          lede="Apple and Google give apps different powers. eGuard does as much as each platform allows, tells you plainly where it can't, and verifies the result either way.">
          <div className="hw-compare">
            <div className="hw-compare-col">
              <Phone os="android" caption="Child's Android phone" className="hw-solo" label="eGuard applying all protections on an Android phone">
                <ScreenChildSetup os="android" />
              </Phone>
              <div>
                <h3>On Android</h3>
                <ul className="hw-list">
                  <li><Check />eGuard applies all ten protections directly.</li>
                  <li><Check />Nothing extra for you to do after pairing.</li>
                  <li><Check />Uninstall protection keeps eGuard from being removed without you.</li>
                </ul>
              </div>
            </div>
            <div className="hw-compare-col">
              <Phone os="ios" caption="Child's iPhone or iPad" className="hw-solo" label="eGuard on an iPhone: most protections applied, two with guided steps">
                <ScreenChildSetup os="ios" />
              </Phone>
              <div>
                <h3>On iPhone and iPad</h3>
                <ul className="hw-list">
                  <li><Check />eGuard applies screen time, bedtime, app rules and content ratings directly.</li>
                  <li><Check /><span><b>Guided:</b> for web filtering, location and downloads, eGuard shows you each step in Settings, then checks it&apos;s on.</span></li>
                  <li><Check /><span><b>Not available:</b> notification controls. Apple doesn&apos;t allow it, so it never counts against your score.</span></li>
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* ---------- Requests ---------- */}
        <Section id="requests" eyebrow="When your child asks" center
          title="A blocked site doesn't have to be a dead end"
          lede="When the extension blocks something your child needs, they can ask you, and you decide from wherever you are.">
          <ol className="hw-story">
            <li>
              <div className="hw-story-art">
                <Laptop browser="chrome" url="khanacademy.org" tab="Blocked · eGuard" extension caption="Child's browser" label="A blocked page with an Ask a parent button">
                  <ScreenBrowserBlocked popup={false} reason="Only sites on your allowed list can open." />
                </Laptop>
              </div>
              <span className="hw-num">1</span>
              <h3>Mia taps &ldquo;Ask a parent&rdquo;</h3>
              <p>She can add a reason, like &ldquo;For my science homework&rdquo;.</p>
            </li>
            <li>
              <div className="hw-story-art hw-story-phone">
                <Phone os="android" caption="Your phone" className="hw-solo" label="The parent app showing Mia's request with Allow and Decline buttons">
                  <ScreenParentAlerts />
                </Phone>
              </div>
              <span className="hw-num">2</span>
              <h3>You get the request</h3>
              <p>In the app or on the web. Allow it for 15 minutes, an hour, the rest of today or always, or decline.</p>
            </li>
            <li>
              <div className="hw-story-art">
                <Laptop browser="chrome" url="khanacademy.org" tab="Photosynthesis" extension caption="Child's browser" label="The approved site open, with a banner saying it's allowed until 4:30 PM">
                  <ScreenBrowserAllowed />
                </Laptop>
              </div>
              <span className="hw-num">3</span>
              <h3>The site opens</h3>
              <p>Right away, with a note saying until when. When time&apos;s up, the rule is back on its own.</p>
            </li>
          </ol>
          <p className="hw-aside"><ArrowDown />Phones work the same way for apps: your child taps <b>Ask for an app</b>, and you approve or decline it.</p>
        </Section>

        {/* ---------- What if ---------- */}
        <Section id="what-if" eyebrow="What if…" title="The questions parents ask us most">
          <ul className="hw-whatif">
            {WHAT_IF.map(([Ico, q, a]) => (
              <li key={q}><i><Ico /></i><h3>{q}</h3><p>{a}</p></li>
            ))}
          </ul>
        </Section>

        {/* ---------- Privacy ---------- */}
        <Section id="privacy" eyebrow="Privacy" title="What travels to eGuard, and what never does"
          lede="eGuard needs very little to check that protections are working. It's also never hidden: your child can always see that eGuard is on and what it does.">
          <div className="hw-privacy">
            <div className="hw-priv sees">
              <h3><i><Check /></i>What eGuard sees</h3>
              <ul>{SEES.map((s) => <li key={s}><Check />{s}</li>)}</ul>
            </div>
            <div className="hw-priv never">
              <h3><i><EyeOff /></i>What eGuard never sees</h3>
              <ul>{NEVER.map((s) => <li key={s}><X />{s}</li>)}</ul>
            </div>
          </div>
          <p className="hw-aside"><ShieldCheck />Browser rules are digitally signed by eGuard, so the extension only follows rules that really came from you. See <Link href="/security">Security &amp; privacy</Link> for the details, and <Link href="/for-kids">the page for kids</Link> to share with your child.</p>
        </Section>

        {/* ---------- Get eGuard ---------- */}
        <Section id="get-eguard" eyebrow="Get eGuard" title="Put eGuard on every screen">
          <ul className="hw-get">
            <li>
              <span className="hw-get-mark"><Monitor /></span>
              <div><b>Web dashboard</b><span>Any browser, at eguard.family</span></div>
              <StartLink className="lp-btn lp-btn-primary" open="Open" start="Start free" />
            </li>
            <li>
              <span className="hw-get-mark"><AndroidMark /></span>
              <div><b>Android</b><span>Parent and child app, Google Play</span></div>
              <a href={STORE_LINKS.googlePlay} className="lp-btn lp-btn-outline" target="_blank" rel="noopener noreferrer">Get it<ArrowRight /></a>
            </li>
            <li className="soon">
              <span className="hw-get-mark"><AppleMark /></span>
              <div><b>iPhone &amp; iPad</b><span>App Store</span></div>
              <span className="hw-soon">Coming soon</span>
            </li>
            <li>
              <span className="hw-get-mark"><ChromeMark /></span>
              <div><b>Chrome</b><span>Chrome Web Store</span></div>
              <a href={STORE_LINKS.chrome} className="lp-btn lp-btn-outline" target="_blank" rel="noopener noreferrer">Add<ArrowRight /></a>
            </li>
            <li>
              <span className="hw-get-mark"><EdgeMark /></span>
              <div><b>Microsoft Edge</b><span>Edge Add-ons</span></div>
              <a href={STORE_LINKS.edge} className="lp-btn lp-btn-outline" target="_blank" rel="noopener noreferrer">Add<ArrowRight /></a>
            </li>
            <li>
              <span className="hw-get-mark"><FirefoxMark /></span>
              <div><b>Firefox</b><span>Firefox Add-ons</span></div>
              <a href={STORE_LINKS.firefox} className="lp-btn lp-btn-outline" target="_blank" rel="noopener noreferrer">Add<ArrowRight /></a>
            </li>
          </ul>
        </Section>

        <div className="st-cta">
          <div>
            <h2>Ready to see it on your own family&apos;s devices?</h2>
            <p>Free for one child. No card needed.</p>
          </div>
          <StartLink className="lp-btn lp-btn-white" />
        </div>
      </div>
    </>
  );
}
