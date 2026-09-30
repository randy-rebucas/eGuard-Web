import Image from "next/image";
import {
  AppWindow, BadgeCheck, BatteryFull, Bell, BookOpen, Check, ChevronLeft, CircleSlash, Clock, Ellipsis, Gamepad2, Globe,
  Hourglass, House, Laptop as LaptopIcon, ListChecks, Lock, MapPin, MapPinOff, Moon, Settings, ShieldCheck, Signal,
  Smartphone, Users, Wifi, X, type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { AndroidMark, AppleMark, ChromeMark, EdgeMark, FirefoxMark } from "@/components/brand-marks";
import avatar1 from "../../public/landing/avatar-1.png";
import avatar2 from "../../public/landing/avatar-2.png";
import avatar3 from "../../public/landing/avatar-3.png";
import "./flow-devices.css";

/*
 * Illustrations for the How it works page: device frames and the eGuard screens inside them.
 * Like the landing-page phones, everything is sized in em off a container-query font size
 * (see flow-devices.css), so each device scales as one unit and stays sharp at any size.
 * The screens are illustrative: realistic, but not pixel copies of the apps.
 */

// ---------- Frames ----------

type OS = "ios" | "android";

/** An iPhone (Dynamic Island, home indicator) or an Android phone (punch-hole camera, gesture bar). */
export function Phone({ os, label, caption, className, children }: {
  os: OS; label: string; caption?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <figure className={`hw-phone hw-phone-${os}${className ? ` ${className}` : ""}`}>
      <div className="hwp" role="img" aria-label={label}>
        <div className="hwp-screen">
          <div className="hwp-status">
            <span className="num">9:41</span>
            <i className={os === "ios" ? "hwp-island" : "hwp-punch"} />
            <span className="hwp-icons"><Signal /><Wifi /><BatteryFull /></span>
          </div>
          <div className="hwp-body">{children}</div>
        </div>
      </div>
      {caption ? <figcaption className="hw-os">{os === "ios" ? <AppleMark /> : <AndroidMark />}{caption}</figcaption> : null}
    </figure>
  );
}

type Browser = "chrome" | "edge" | "firefox";
const BROWSER_MARK: Record<Browser, () => React.ReactElement> = { chrome: ChromeMark, edge: EdgeMark, firefox: FirefoxMark };

/** A laptop with a browser window. `extension` lights up the eGuard button in the toolbar. */
export function Laptop({ browser, url, tab, site = false, extension = false, label, caption, className, children }: {
  browser: Browser; url: string; tab: string; site?: boolean; extension?: boolean;
  label: string; caption?: string; className?: string; children: React.ReactNode;
}) {
  const Mark = BROWSER_MARK[browser];
  return (
    <figure className={`hw-laptop${className ? ` ${className}` : ""}`}>
      <div className="hwl" role="img" aria-label={label}>
        <div className="hwl-lid">
          <div className={`hwl-screen hwb-${browser}`}>
            <div className="hwb-tabs">
              <span className="hwb-dots"><i /><i /><i /></span>
              <span className="hwb-tab">{site ? <LogoMark size={12} /> : <Globe />}<span>{tab}</span><X /></span>
            </div>
            <div className="hwb-bar">
              <ChevronLeft />
              <span className="hwb-url"><Lock />{url}</span>
              {extension ? <span className="hwb-ext"><LogoMark size={12} /></span> : null}
            </div>
            <div className="hwl-content">{children}</div>
          </div>
        </div>
        <div className="hwl-base"><i /></div>
      </div>
      {/* Extension illustrations name the browser; the web dashboard works in any of them. */}
      {caption ? <figcaption className="hw-os">{extension ? <Mark /> : <Globe />}{caption}</figcaption> : null}
    </figure>
  );
}

/** The eGuard servers: a rack in front of a cloud, with blinking status lights. */
export function ServerCloud({ label = "eGuard's secure servers" }: { label?: string }) {
  const shield = "M32 4C24.4 8 16.4 10.2 8.5 11.2V30c0 14.6 9.8 25.4 23.5 30 13.7-4.6 23.5-15.4 23.5-30V11.2C47.6 10.2 39.6 8 32 4Z";
  return (
    <svg className="hw-server" viewBox="0 0 260 214" role="img" aria-label={label}>
      <defs>
        <linearGradient id="hw-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3F1FF" /><stop offset="1" stopColor="#C9E3FF" />
        </linearGradient>
        <linearGradient id="hw-rack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1D3A66" /><stop offset="1" stopColor="#0B2348" />
        </linearGradient>
        <linearGradient id="hw-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4FD2FF" /><stop offset=".55" stopColor="#2394F5" /><stop offset="1" stopColor="#1560DB" />
        </linearGradient>
      </defs>
      <path d="M40 132A34 34 0 0 1 44 64A52 52 0 0 1 136 30A46 46 0 0 1 212 70A31 31 0 0 1 222 132Z" fill="url(#hw-cloud)" />
      <ellipse cx="130" cy="202" rx="70" ry="7" fill="#0B2348" opacity=".12" />
      <rect x="78" y="80" width="104" height="118" rx="14" fill="url(#hw-rack)" />
      {[94, 126, 158].map((y, i) => (
        <g key={y}>
          <rect x="90" y={y} width="80" height="26" rx="6" fill="#26467A" />
          <circle className={`hw-led hw-led-${i}`} cx="102" cy={y + 13} r="3.2" fill="#3BE39A" />
          <circle cx="112" cy={y + 13} r="3.2" fill="#5BC2FF" opacity=".75" />
          <path d={`M126 ${y + 9}H160M126 ${y + 17}H152`} stroke="#4B6FA3" strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}
      <circle cx="130" cy="78" r="22" fill="#fff" />
      <path d={shield} fill="url(#hw-shield)" transform="translate(114.4 62.4) scale(.49)" />
      <path d="m123.5 78.5 4.5 4.5 8.5-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- Screen parts ----------

type Status = "ok" | "wait" | "guide" | "off";
const STATUS: Record<Status, [LucideIcon, string]> = {
  ok: [Check, "Verified"], wait: [Clock, "Pending"], guide: [ListChecks, "Guided"], off: [CircleSlash, "Not on iPhone"],
};

function Chip({ status, text }: { status: Status; text?: string }) {
  const [Ico, label] = STATUS[status];
  return <span className={`sc-chip ${status}`}><Ico />{text ?? label}</span>;
}

function Row({ icon: Ico, name, value, status }: { icon: LucideIcon; name: string; value?: string; status?: Status }) {
  return (
    <li className="sc-row">
      <i className="sc-ico"><Ico /></i>
      <div><b>{name}</b>{value ? <span>{value}</span> : null}</div>
      {status ? <Chip status={status} /> : null}
    </li>
  );
}

function Ring({ value, of, size = "3.4em" }: { value: number; of: number; size?: string }) {
  const c = 2 * Math.PI * 16;
  return (
    <span className="sc-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#E3EDF8" strokeWidth="4.5" />
        <circle cx="20" cy="20" r="16" fill="none" stroke="#18B26B" strokeWidth="4.5" strokeLinecap="round"
          strokeDasharray={`${c * value / of} ${c}`} transform="rotate(-90 20 20)" />
      </svg>
      <b className="num">{value}</b>
    </span>
  );
}

const TABS: [LucideIcon, string][] = [[House, "Home"], [Users, "Children"], [LaptopIcon, "Devices"], [Bell, "Alerts"], [Settings, "Settings"]];

function Tabs({ on }: { on: number }) {
  return <nav className="sc-tabs" aria-hidden="true">{TABS.map(([Ico, label], i) => <span key={label} className={i === on ? "on" : undefined}><Ico />{label}</span>)}</nav>;
}

function Avatar({ src, size = "2.6em" }: { src: typeof avatar1; size?: string }) {
  return <Image className="sc-avatar" src={src} alt="" width={96} height={96} sizes="48px" style={{ width: size, height: size }} />;
}

// ---------- Parent app ----------

/** Parent app: one child's protections, each with its verification status. */
export function ScreenParentChild() {
  return (
    <>
      <div className="sc-top"><ChevronLeft /><b>Mia</b><Ellipsis /></div>
      <div className="sc-kid"><Avatar src={avatar1} size="3em" /><div><b>Mia, 11</b><span>Phone · Browser</span></div></div>
      <div className="sc-card sc-health">
        <Ring value={9} of={10} />
        <div><small>Configuration Health</small><b>9 of 10 verified</b><em>1 waiting for a device</em></div>
      </div>
      <p className="sc-h">Protections</p>
      <ul className="sc-list">
        <Row icon={Hourglass} name="Screen Time" value="2h a day" status="ok" />
        <Row icon={Moon} name="Bedtime" value="9:30 PM" status="ok" />
        <Row icon={Globe} name="Web Filtering" value="Filter" status="ok" />
        <Row icon={BadgeCheck} name="App Approval" value="On" status="wait" />
      </ul>
      <Tabs on={1} />
    </>
  );
}

/** Parent app: a website access request from the child's browser, above recent alerts. */
export function ScreenParentAlerts() {
  return (
    <>
      <div className="sc-appbar"><b>Alerts</b><span className="sc-count">2 new</span></div>
      <div className="sc-card sc-request">
        <div className="sc-req-top">
          <Avatar src={avatar1} size="2.4em" />
          <div><small>Website access request</small><b>Mia wants to open khanacademy.org</b></div>
        </div>
        <p className="sc-quote">&ldquo;For my science homework&rdquo;</p>
        <div className="sc-actions"><span className="sc-btn">Allow 1 hour</span><span className="sc-btn ghost">Decline</span></div>
      </div>
      <ul className="sc-feed">
        <li><i className="ok"><Check /></i><div><b>Bedtime verified</b><span>Mia&apos;s Galaxy A15 · 9:32 PM</span></div></li>
        <li><i className="info"><Globe /></i><div><b>Browser connected</b><span>Mia&apos;s Chrome · Yesterday</span></div></li>
        <li><i className="warn"><MapPinOff /></i><div><b>Location sharing off</b><span>Lucas&apos;s iPad · Mon</span></div></li>
      </ul>
      <Tabs on={3} />
    </>
  );
}

/** Parent app: a one-time pairing code for the child's phone. */
export function ScreenPairingCode() {
  return (
    <>
      <div className="sc-top"><X /><b>Add a device</b><i /></div>
      <p className="sc-lead">For <b>Mia</b></p>
      <div className="sc-seg"><span className="on"><Smartphone />Phone</span><span><Globe />Browser</span></div>
      <div className="sc-card sc-codecard">
        <small>Pairing code</small>
        <b className="sc-code num">K7PQ 2M9X</b>
        <span><Clock />Expires in 14:52</span>
      </div>
      <ol className="sc-steps">
        <li>Install eGuard on Mia&apos;s phone</li>
        <li>Choose <b>I&apos;m setting up my child&apos;s device</b></li>
        <li>Enter this code</li>
      </ol>
      <span className="sc-btn ghost wide">Done</span>
    </>
  );
}

/** Parent app: one protection for one child, with its status on an Android phone and an iPad. */
export function ScreenProtection({ icon, name, value, ios }: {
  icon: React.ReactNode; name: string; value: string; ios: "AVAILABLE" | "GUIDED" | "VERIFY_ONLY" | "UNSUPPORTED";
}) {
  const iosStatus: Status = ios === "AVAILABLE" ? "ok" : ios === "UNSUPPORTED" ? "off" : "guide";
  return (
    <>
      <div className="sc-top"><ChevronLeft /><b>Protection</b><i /></div>
      <div className="sc-prot">
        <span className="sc-shield">{icon}</span>
        <b>{name}</b>
        <span>For Mia</span>
      </div>
      <div className="sc-card sc-left"><small>Current setting</small><b className="sc-value">{value}</b></div>
      <p className="sc-h">On Mia&apos;s devices</p>
      <ul className="sc-list">
        <li className="sc-row"><i className="sc-ico"><Smartphone /></i><div><b>Galaxy A15</b><span>Android</span></div><Chip status="ok" /></li>
        <li className="sc-row"><i className="sc-ico"><Smartphone /></i><div><b>iPad</b><span>iPadOS</span></div><Chip status={iosStatus} text={ios === "UNSUPPORTED" ? "Not on iPad" : undefined} /></li>
      </ul>
      <span className="sc-btn wide">Change setting</span>
    </>
  );
}

// ---------- Child's phone ----------

/** Child mode: entering the pairing code. */
export function ScreenChildPair() {
  return (
    <div className="sc-pair">
      <LogoMark size={40} />
      <b className="sc-title">Connect to your family</b>
      <p className="sc-sub">Enter the code from your parent&apos;s eGuard app</p>
      <div className="sc-boxes num">
        {["K7PQ", "2M9X"].map((g) => <span key={g}>{g.split("").map((c, i) => <i key={i}>{c}</i>)}</span>)}
      </div>
      <div className="sc-field"><small>Name this device</small><span>Mia&apos;s Galaxy A15</span></div>
      <span className="sc-btn wide">Connect</span>
    </div>
  );
}

/** Child mode home: eGuard is visible and says plainly what's on. */
export function ScreenChildHome() {
  return (
    <>
      <div className="sc-kidhead">
        <span className="sc-shield"><ShieldCheck /></span>
        <b>eGuard is on</b>
        <span>Protecting this phone for Mia</span>
      </div>
      <div className="sc-card sc-left">
        <small>Screen time left today</small>
        <b className="num">1h 20m</b>
        <span className="sc-meter"><span style={{ width: "40%" }} /></span>
      </div>
      <ul className="sc-list">
        <Row icon={Moon} name="Bedtime" value="9:30 PM – 6:00 AM" />
        <Row icon={AppWindow} name="New apps" value="Ask a parent first" />
        <Row icon={MapPin} name="Location" value="Shared with family" />
      </ul>
      <span className="sc-btn wide">Ask for an app</span>
    </>
  );
}

const SETUP: [LucideIcon, string, Status, Status][] = [
  [Hourglass, "Screen Time", "ok", "ok"],
  [Moon, "Bedtime", "ok", "ok"],
  [AppWindow, "App Restrictions", "ok", "ok"],
  [Globe, "Web Filtering", "ok", "guide"],
  [MapPin, "Location", "ok", "guide"],
  [Bell, "Notification Controls", "ok", "off"],
];

/** Child mode, first sync: every protection's progress, per platform. */
export function ScreenChildSetup({ os }: { os: OS }) {
  return (
    <>
      <div className="sc-top"><i /><b>Finishing setup</b><i /></div>
      <p className="sc-lead">{os === "android" ? "eGuard is applying Mia's settings." : "Most settings are applied for you. A few need a parent's hand."}</p>
      <ul className="sc-list sc-tight">
        {SETUP.map(([Ico, name, android, ios]) => {
          const s = os === "android" ? android : ios;
          return <li key={name} className="sc-row"><i className="sc-ico"><Ico /></i><div><b>{name}</b></div><Chip status={s} text={s === "ok" ? "Applied" : undefined} /></li>;
        })}
      </ul>
      {os === "android"
        ? <span className="sc-btn wide">All set</span>
        : <span className="sc-btn wide">Show me how</span>}
    </>
  );
}

// ---------- Web dashboard ----------

const KIDS = [
  { src: avatar1, name: "Mia", score: 9 },
  { src: avatar2, name: "Lucas", score: 10 },
  { src: avatar3, name: "Sophie", score: 7 },
];

/** Web dashboard: sidebar, family score and each child. */
export function ScreenWebDashboard() {
  return (
    <div className="sw">
      <aside className="sw-side">
        <span className="sw-logo"><LogoMark size={14} /><b>eGuard</b></span>
        {TABS.map(([Ico, label], i) => <span key={label} className={i === 0 ? "on" : undefined}><Ico />{label}</span>)}
      </aside>
      <div className="sw-main">
        <p className="sw-hello">Good evening, Randy</p>
        <div className="sw-grid">
          <div className="sc-card sw-score">
            <Ring value={26} of={30} size="4.2em" />
            <div><small>Family Protection</small><b>Good</b><span>26 of 30 checks verified</span></div>
          </div>
          <div className="sc-card sw-alert"><i className="warn"><MapPinOff /></i><div><b>Location sharing off</b><span>Lucas&apos;s iPad</span></div></div>
        </div>
        <div className="sw-kids">
          {KIDS.map((k) => (
            <div key={k.name} className="sc-card sw-kid">
              <Avatar src={k.src} size="2.4em" />
              <div><b>{k.name}</b><Chip status={k.score >= 9 ? "ok" : "wait"} text={`${k.score}/10`} /></div>
            </div>
          ))}
        </div>
        <div className="sc-card sw-chart">
          <small>Screen time this week</small>
          <div className="sw-bars">{[62, 80, 54, 90, 70, 100, 76].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div>
        </div>
      </div>
    </div>
  );
}

/** Web dashboard: editing Bedtime, then sending it to each of the child's devices. */
export function ScreenWebBedtime() {
  return (
    <div className="sw sw-edit">
      <div className="sw-main">
        <div className="sw-crumb"><ChevronLeft />Mia · Protection</div>
        <div className="sc-card sw-form">
          <div className="sw-form-head"><i className="sc-ico"><Moon /></i><div><b>Bedtime</b><span>Lock apps overnight, except calls</span></div><span className="sw-toggle" /></div>
          <div className="sw-times">
            <div><small>Starts</small><b className="num">9:30 PM</b></div>
            <div><small>Ends</small><b className="num">6:00 AM</b></div>
            <div><small>Days</small><b>Every day</b></div>
          </div>
          <span className="sc-btn">Save changes</span>
        </div>
        <div className="sc-card sw-send">
          <small>Sending to Mia&apos;s devices</small>
          <ul>
            <li><Smartphone /><b>Mia&apos;s Galaxy A15</b><Chip status="ok" /></li>
            <li><Globe /><b>Mia&apos;s Chrome</b><Chip status="wait" /></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------- Browser extension ----------

/** A blocked site in the child's browser, with the eGuard popup open. */
export function ScreenBrowserBlocked({ popup = true, reason = "Games are off during focus hours." }: { popup?: boolean; reason?: string }) {
  return (
    <div className="sb">
      <div className="sb-block">
        <span className="sc-shield"><ShieldCheck /></span>
        <b>This site is blocked</b>
        <p>{reason} You can ask a parent to open it.</p>
        <div className="sc-actions"><span className="sc-btn">Ask a parent</span><span className="sc-btn ghost">Go back</span></div>
      </div>
      {popup ? (
        <div className="sb-pop">
          <div className="sb-pop-head"><LogoMark size={14} /><b>eGuard</b><span className="sc-chip ok"><Check />On</span></div>
          <p>Connected to <b>Mia</b></p>
          <ul>
            <li><ShieldCheck />Safe Browsing on</li>
            <li><Gamepad2 />Focus hours until 5:00 PM</li>
            <li><Clock />Rules updated 2 min ago</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The extension's setup page after a code is entered. */
export function ScreenBrowserConnected() {
  return (
    <div className="sb sb-center">
      <div className="sb-block">
        <LogoMark size={30} />
        <b>Connected to Mia</b>
        <p>This browser now follows the rules Mia&apos;s parents set in eGuard.</p>
        <div className="sb-code num">{"PQ7K-M92X".split("").map((c, i) => <i key={i} className={c === "-" ? "dash" : undefined}>{c}</i>)}</div>
        <span className="sc-chip ok big"><Check />Browser protection is on</span>
      </div>
    </div>
  );
}

/** A site a parent approved, with the extension's banner saying until when. */
export function ScreenBrowserAllowed() {
  return (
    <div className="sb sb-page">
      <div className="sb-banner"><Check />A parent allowed this site until 4:30 PM</div>
      <div className="sb-site">
        <span className="sb-site-logo"><BookOpen /></span>
        <b>Photosynthesis, explained</b>
        <i style={{ width: "92%" }} /><i style={{ width: "86%" }} /><i style={{ width: "64%" }} />
        <div className="sb-thumbs"><span /><span /><span /></div>
      </div>
    </div>
  );
}
