"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  AppWindow, ArrowRight, BadgeCheck, BellOff, Check, CircleSlash, Clock, Download, Film, Gamepad2, Globe, Hourglass,
  Info, ListChecks, LoaderCircle, Lock, MapPin, Monitor, Moon, Puzzle, RefreshCw, RotateCcw, ShieldCheck, Smartphone,
  UserPlus, Users, X, type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { AndroidMark, AppleMark, ChromeMark, EdgeMark, FirefoxMark } from "@/components/brand-marks";
import {
  ANDROID_PERMISSIONS, CODE_LENGTH, CODE_MINUTES, DEVICE_ORDER, browserChecks, checkCode, computerChecks, countdown,
  formatCode, health, makeCode, normalizeCode, phoneChecks, slotsUsed,
  type Check as DeviceCheck, type CheckState, type CodeKind, type DemoDevice, type DemoProtection, type PermissionId,
} from "@/lib/setup-demo";

/*
 * The /demo walkthrough. The visitor is the parent: the left pane is their eGuard, the right pane is whichever of the
 * child's devices is being set up. Everything is local state; nothing is sent anywhere. Screens follow the real apps'
 * flows (docs/child-app-spec.md section 4, docs/desktop-agent-spec.md section 4, docs/browser-extension-api.md) and
 * their wording, but are illustrations, not copies.
 */

type Plans = { free: { name: string; devices: number; location: boolean }; plus: { name: string; devices: number } };
type Browser = "chrome" | "edge" | "firefox";
type Code = { value: string; issuedAt: number };
type Step = "account" | "child" | "devices" | DemoDevice | "done";

const BROWSERS: Record<Browser, { name: string; Mark: () => React.ReactElement }> = {
  chrome: { name: "Chrome", Mark: ChromeMark },
  edge: { name: "Edge", Mark: EdgeMark },
  firefox: { name: "Firefox", Mark: FirefoxMark },
};

const PROTECTION_ICON: Record<string, LucideIcon> = {
  SCREEN_TIME: Hourglass, BEDTIME: Moon, APP_RESTRICTIONS: AppWindow, APP_APPROVAL: BadgeCheck, CONTENT: Film, WEB: Globe,
  DOWNLOADS: Download, LOCATION: MapPin, NOTIFICATIONS: BellOff, UNINSTALL_PROTECTION: Lock,
};

const STATE: Record<CheckState | "pending", { label: string; tone: string; Icon: LucideIcon }> = {
  pending: { label: "Pending", tone: "muted", Icon: Clock },
  verified: { label: "Verified", tone: "ok", Icon: Check },
  guided: { label: "Guided", tone: "warn", Icon: ListChecks },
  parent: { label: "Set by you", tone: "accent", Icon: ListChecks },
  off: { label: "Off on device", tone: "warn", Icon: CircleSlash },
  na: { label: "Not on this device", tone: "muted", Icon: CircleSlash },
  plan: { label: "Not on plan", tone: "muted", Icon: CircleSlash },
};

/** What the parent picks for a child of this age: the same idea as the app's protection profiles, simplified. */
function preset(age: number) {
  if (age <= 8) return { band: "ages 5 to 8", screen: "1 hour a day", bedtime: "8:00 PM", web: "Strict" };
  if (age <= 12) return { band: "ages 9 to 12", screen: "2 hours a day", bedtime: "9:00 PM", web: "Moderate" };
  return { band: "ages 13 to 17", screen: "3 hours a day", bedtime: "10:00 PM", web: "Light" };
}

const STEP_LABEL: Record<Step, string> = {
  account: "Your account", child: "Your child", devices: "Their devices", phone: "Phone", computer: "Computer", browser: "Browser", done: "All set",
};

// ---------- Hooks ----------

/** The clock, once a second, while `active`. null until the first tick (never read during render on the server). */
function useNow(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Runs `fn` once, `ms` after `active` turns true. Shorter when the visitor prefers reduced motion. */
function useAfter(active: boolean, ms: number, fn: () => void) {
  const f = useRef(fn);
  useEffect(() => { f.current = fn; });
  useEffect(() => {
    if (!active) return;
    const fast = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => f.current(), fast ? Math.min(ms, 150) : ms);
    return () => clearTimeout(t);
  }, [active, ms]);
}

/** How many of `count` items have appeared, one every `ms`, once `active`. */
function useReveal(active: boolean, count: number, ms = 280) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const fast = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0;
    const t = setInterval(() => { i += 1; setN(i); if (i >= count) clearInterval(t); }, fast ? 20 : ms);
    return () => clearInterval(t);
  }, [active, count, ms]);
  return active ? Math.min(n, count) : 0;
}

/** A heading that takes focus whenever `key` changes after the first render, so keyboard and screen reader users follow along. */
function useFocusOn(key: unknown) {
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}

// ---------- Small parts ----------

function Pill({ state }: { state: CheckState | "pending" }) {
  const { label, tone, Icon } = STATE[state];
  return <span className={`dm-pill ${tone}`}><Icon aria-hidden="true" />{label}</span>;
}

function CheckList({ checks, revealed = checks.length, compact }: { checks: DeviceCheck[]; revealed?: number; compact?: boolean }) {
  return (
    <ul className={`dm-checks${compact ? " compact" : ""}`}>
      {checks.map((c, i) => {
        const Ico = PROTECTION_ICON[c.key] ?? ShieldCheck;
        const shown = i < revealed;
        return (
          <li key={c.key}>
            <i className="dm-ico" aria-hidden="true"><Ico /></i>
            <span className="grow"><b>{c.name}</b>{shown && c.note && !compact ? <small>{c.note}</small> : null}</span>
            <Pill state={shown ? c.state : "pending"} />
          </li>
        );
      })}
    </ul>
  );
}

function Spinner({ label }: { label: string }) {
  return <span className="dm-spin" role="status"><LoaderCircle aria-hidden="true" />{label}</span>;
}

/** The pairing code card on the parent's screen, counting down from 15 minutes. */
function CodeCard({ code, kind, onNew }: { code: Code; kind: CodeKind; onNew: () => void }) {
  const now = useNow(true);
  const left = now === null ? CODE_MINUTES * 60_000 : code.issuedAt + CODE_MINUTES * 60_000 - now;
  return (
    <div className="dm-codecard">
      <small>{kind === "DEVICE" ? "Pairing code" : "Browser code"}</small>
      <b className="dm-code num"><span aria-hidden="true">{formatCode(code.value)}</span><span className="sr-only">{code.value.split("").join(" ")}</span></b>
      <span className="dm-meta"><Clock aria-hidden="true" />{left > 0 ? <>Works for <span className="num">{countdown(left)}</span></> : "Expired"}</span>
      <button type="button" className="dm-link" onClick={onNew}><RefreshCw aria-hidden="true" />Get a new code</button>
    </div>
  );
}

/** Where the child's device takes the code: one forgiving field, plus a shortcut so nobody has to copy by hand. */
function CodeEntry({ code, other, kind, submit, onOk }: {
  code: Code; other?: Code | null; kind: CodeKind; submit: string; onOk: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const typing = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (typing.current) clearInterval(typing.current); }, []);

  const check = (v: string) => {
    const expired = Date.now() > code.issuedAt + CODE_MINUTES * 60_000;
    const r = checkCode(v, { want: expired ? "" : code.value, kind, other: other?.value });
    if (r.ok) { setError(null); onOk(); } else setError(r.message);
  };
  const typeForMe = () => {
    if (typing.current) clearInterval(typing.current);
    setError(null);
    const target = formatCode(code.value);
    let i = 0;
    typing.current = setInterval(() => {
      i += 1;
      setValue(target.slice(0, i));
      if (i >= target.length && typing.current) clearInterval(typing.current);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 70);
  };

  return (
    <form className="dm-entry" onSubmit={(e) => { e.preventDefault(); check(value); }} noValidate>
      <label htmlFor={id}>{kind === "DEVICE" ? "Pairing code" : "Browser code"}</label>
      <input
        id={id} className="dm-codeinput num" value={value} inputMode="text" autoComplete="one-time-code" autoCapitalize="characters"
        spellCheck={false} maxLength={CODE_LENGTH + 4} placeholder="XXXX XXXX" aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : `${id}-hint`}
        onChange={(e) => { setValue(e.target.value.toUpperCase()); setError(null); }}
      />
      {error
        ? <p className="dm-error" id={`${id}-err`} role="alert">{error}</p>
        : <p className="dm-hint" id={`${id}-hint`}>It&apos;s on your screen, on the left. Spaces and dashes are fine.</p>}
      <button type="button" className="dm-link" onClick={typeForMe}>Type the code for me</button>
      <button type="submit" className="dm-btn wide" disabled={normalizeCode(value).length === 0}>{submit}</button>
    </form>
  );
}

// ---------- Device frames ----------

function PhoneFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dm-phone">
      <div className="dm-phone-screen" role="group" aria-label={label}>
        <div className="dm-phone-status" aria-hidden="true"><span className="num">9:41</span><i /><span>5G ▮▮▮</span></div>
        <div className="dm-phone-body">{children}</div>
      </div>
    </div>
  );
}

function PcFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dm-pc">
      <div className="dm-pc-screen" role="group" aria-label={label}>
        <div className="dm-pc-desk">{children}</div>
        <div className="dm-pc-taskbar" aria-hidden="true"><span className="dm-pc-start" /><span /><span /><span className="num">4:12 PM</span></div>
      </div>
      <div className="dm-pc-stand" aria-hidden="true" />
    </div>
  );
}

function PcWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dm-win">
      <div className="dm-win-bar"><LogoMark size={14} /><span>{title}</span><i aria-hidden="true">—</i><i aria-hidden="true">✕</i></div>
      <div className="dm-win-body">{children}</div>
    </div>
  );
}

function BrowserFrame({ browser, url, tab, extension, label, children }: {
  browser: Browser; url: string; tab: string; extension: boolean; label: string; children: React.ReactNode;
}) {
  const { Mark } = BROWSERS[browser];
  return (
    <div className={`dm-browser dm-browser-${browser}`}>
      <div className="dm-br-tabs" aria-hidden="true">
        <span className="dm-br-dots"><i /><i /><i /></span>
        <span className="dm-br-tab"><Mark /><span>{tab}</span><X /></span>
      </div>
      <div className="dm-br-bar" aria-hidden="true">
        <span className="dm-br-url"><Lock />{url}</span>
        {extension ? <span className="dm-br-ext" title="eGuard extension"><LogoMark size={14} /></span> : <Puzzle />}
      </div>
      <div className="dm-br-page" role="group" aria-label={label}>{children}</div>
    </div>
  );
}

// ---------- Child's phone ----------

type PhoneScreen = "welcome" | "who" | "about" | "code" | "name" | "connecting" | "perm" | "finishing" | "home";

function PhoneFlow({ child, code, other, checksFor, onPaired, onReported }: {
  child: string; code: Code; other: Code | null; checksFor: (skipped: PermissionId[]) => DeviceCheck[];
  onPaired: (name: string) => void; onReported: (skipped: PermissionId[]) => void;
}) {
  const [screen, setScreen] = useState<PhoneScreen>("welcome");
  const [perm, setPerm] = useState(0);
  const [skipped, setSkipped] = useState<PermissionId[]>([]);
  const [name, setName] = useState(`${child}'s Galaxy A15`);
  const nameId = useId();
  const head = useFocusOn(`${screen}${perm}`);
  const checks = checksFor(skipped).filter((c) => c.state !== "na");
  const applied = useReveal(screen === "finishing", checks.length);

  useAfter(screen === "connecting", 1100, () => { onPaired(name.trim()); setScreen("perm"); });
  useAfter(screen === "finishing" && applied >= checks.length, 700, () => { onReported(skipped); setScreen("home"); });

  const answer = (allow: boolean) => {
    const next = allow ? skipped : [...skipped, ANDROID_PERMISSIONS[perm].id];
    setSkipped(next);
    if (perm + 1 < ANDROID_PERMISSIONS.length) setPerm(perm + 1);
    else setScreen("finishing");
  };

  let body: React.ReactNode;
  switch (screen) {
    case "welcome":
      body = (
        <div className="dm-scr center">
          <LogoMark size={56} />
          <h3 ref={head} tabIndex={-1}>Welcome to eGuard</h3>
          <p>Digital safety for brighter tomorrows.</p>
          <button type="button" className="dm-btn wide push" onClick={() => setScreen("who")}>Get Started</button>
        </div>
      );
      break;
    case "who":
      body = (
        <div className="dm-scr">
          <h3 ref={head} tabIndex={-1}>Who&apos;s using this device?</h3>
          <button type="button" className="dm-choice" disabled><Users aria-hidden="true" /><span><b>I&apos;m a parent</b><small>Not part of this demo</small></span></button>
          <button type="button" className="dm-choice on" onClick={() => setScreen("about")}><Smartphone aria-hidden="true" /><span><b>This is my child&apos;s device</b><small>You&apos;ll need a code from the parent app or the web</small></span></button>
        </div>
      );
      break;
    case "about":
      body = (
        <div className="dm-scr">
          <h3 ref={head} tabIndex={-1}>What eGuard does here</h3>
          <p className="dm-small"><b>It controls</b> screen time, bedtime, which apps can open and which sites load.</p>
          <p className="dm-small"><b>Your parent sees</b> whether each setting is on, screen time totals and app names.</p>
          <p className="dm-small"><b>It never sees</b> messages, photos, or what you browse.</p>
          <button type="button" className="dm-btn wide push" onClick={() => setScreen("code")}>Continue</button>
        </div>
      );
      break;
    case "code":
      body = (
        <div className="dm-scr">
          <h3 ref={head} tabIndex={-1}>Enter the pairing code</h3>
          <p className="dm-small">In the eGuard app or on the web, open your child and choose Pair a device. Codes last {CODE_MINUTES} minutes.</p>
          <CodeEntry code={code} other={other} kind="DEVICE" submit="Next" onOk={() => setScreen("name")} />
        </div>
      );
      break;
    case "name":
      body = (
        <form className="dm-scr" onSubmit={(e) => { e.preventDefault(); if (name.trim()) setScreen("connecting"); }}>
          <h3 ref={head} tabIndex={-1}>Name this device</h3>
          <p className="dm-small">Your parent sees this name everywhere in eGuard.</p>
          <label className="dm-label" htmlFor={nameId}>Device name</label>
          <input id={nameId} className="dm-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="dm-btn wide push" disabled={!name.trim()}>Connect</button>
        </form>
      );
      break;
    case "connecting":
      body = <div className="dm-scr center"><LogoMark size={48} /><h3 ref={head} tabIndex={-1}>Connecting…</h3><Spinner label="Pairing with your family" /></div>;
      break;
    case "perm": {
      const p = ANDROID_PERMISSIONS[perm];
      body = (
        <div className="dm-scr">
          <span className="dm-step-count num">Permission {perm + 1} of {ANDROID_PERMISSIONS.length}</span>
          <h3 ref={head} tabIndex={-1}>{p.name}</h3>
          <p>{p.why}</p>
          <p className="dm-small dm-muted">Next, Android asks you to confirm. If you skip, your parent sees that this protection is off.</p>
          <div className="push dm-col">
            <button type="button" className="dm-btn wide" onClick={() => answer(true)}>Allow</button>
            <button type="button" className="dm-btn ghost wide" onClick={() => answer(false)}>Skip for now</button>
          </div>
        </div>
      );
      break;
    }
    case "finishing":
      body = (
        <div className="dm-scr">
          <h3 ref={head} tabIndex={-1}>Finishing setup</h3>
          <p className="dm-small">Applying {child}&apos;s settings, then telling your parent what&apos;s really on.</p>
          <CheckList checks={checks} revealed={applied} compact />
        </div>
      );
      break;
    case "home":
      body = (
        <div className="dm-scr">
          <div className="dm-kidhead"><span className="dm-shield"><ShieldCheck aria-hidden="true" /></span><h3 ref={head} tabIndex={-1}>eGuard is on</h3><p>Protecting this phone for {child}</p></div>
          <div className="dm-inset"><small>Screen time left today</small><b className="num">2h 0m</b><span className="dm-meter"><span style={{ width: "100%" }} /></span></div>
          <p className="dm-small dm-muted">eGuard stays visible on this phone. There&apos;s nothing hidden from {child}.</p>
          <button type="button" className="dm-btn ghost wide push" disabled>Ask for more time</button>
        </div>
      );
      break;
  }
  return <PhoneFrame label={`${child}'s Android phone`}>{body}</PhoneFrame>;
}

// ---------- Child's computer ----------

type PcScreen = "desktop" | "admin" | "installing" | "code" | "name" | "connecting" | "accounts" | "scanning" | "home";
const FOUND_APPS: [string, string][] = [["Roblox", "Game"], ["Minecraft", "Game"], ["Steam", "Game store"], ["Counter-Strike 2", "Game"], ["Discord", "Chat"]];

function ComputerFlow({ child, parent, code, onPaired, onReported }: {
  child: string; parent: string; code: Code; onPaired: (name: string) => void; onReported: (adminIncluded: boolean) => void;
}) {
  const [screen, setScreen] = useState<PcScreen>("desktop");
  const [name, setName] = useState(`${child}'s PC`);
  const [accounts, setAccounts] = useState({ child: true, parent: false });
  const nameId = useId();
  const head = useFocusOn(screen);
  const installed = useReveal(screen === "installing", 10, 140);
  const found = useReveal(screen === "scanning", FOUND_APPS.length, 380);

  useAfter(screen === "installing" && installed >= 10, 300, () => setScreen("code"));
  useAfter(screen === "connecting", 1100, () => { onPaired(name.trim()); setScreen("accounts"); });
  useAfter(screen === "scanning" && found >= FOUND_APPS.length, 800, () => { onReported(accounts.parent); setScreen("home"); });

  let body: React.ReactNode;
  switch (screen) {
    case "desktop":
      body = (
        <div className="dm-desk-start">
          <button type="button" className="dm-desk-file" onClick={() => setScreen("admin")}>
            <span className="dm-desk-icon"><LogoMark size={34} /></span>
            <span>eGuardSetup.exe</span>
          </button>
          <div className="dm-desk-tip"><h3 ref={head} tabIndex={-1}>Downloaded from eguard.family</h3><p>Open the installer to begin.</p></div>
        </div>
      );
      break;
    case "admin":
      body = (
        <PcWindow title="Administrator permission">
          <h3 ref={head} tabIndex={-1}>Let eGuard for Windows make changes to this PC?</h3>
          <p className="dm-small">eGuard installs for every account on this PC, so an administrator needs to allow it. That&apos;s you, not {child}.</p>
          <p className="dm-small dm-muted">Verified publisher: eGuard</p>
          <div className="dm-row-end"><button type="button" className="dm-btn ghost" onClick={() => setScreen("desktop")}>No</button><button type="button" className="dm-btn" onClick={() => setScreen("installing")}>Yes</button></div>
        </PcWindow>
      );
      break;
    case "installing":
      body = (
        <PcWindow title="eGuard for Windows setup">
          <h3 ref={head} tabIndex={-1}>Installing eGuard</h3>
          <span className="dm-meter big" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={installed * 10} aria-label="Installing"><span style={{ width: `${installed * 10}%` }} /></span>
          <p className="dm-small dm-muted">Setting up the eGuard service and its protections…</p>
        </PcWindow>
      );
      break;
    case "code":
      body = (
        <PcWindow title="eGuard for Windows setup">
          <h3 ref={head} tabIndex={-1}>Connect this PC to your family</h3>
          <p className="dm-small">In eGuard, open {child} and choose Pair a device. Phones and computers use the same kind of code.</p>
          <CodeEntry code={code} kind="DEVICE" submit="Next" onOk={() => setScreen("name")} />
        </PcWindow>
      );
      break;
    case "name":
      body = (
        <PcWindow title="eGuard for Windows setup">
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) setScreen("connecting"); }} className="dm-col">
            <h3 ref={head} tabIndex={-1}>Name this PC</h3>
            <label className="dm-label" htmlFor={nameId}>Computer name</label>
            <input id={nameId} className="dm-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <div className="dm-row-end"><button type="submit" className="dm-btn" disabled={!name.trim()}>Connect</button></div>
          </form>
        </PcWindow>
      );
      break;
    case "connecting":
      body = <PcWindow title="eGuard for Windows setup"><h3 ref={head} tabIndex={-1}>Connecting…</h3><Spinner label="Pairing with your family" /></PcWindow>;
      break;
    case "accounts": {
      const none = !accounts.child && !accounts.parent;
      body = (
        <PcWindow title="eGuard for Windows setup">
          <fieldset className="dm-fieldset">
            <legend><h3 ref={head} tabIndex={-1}>Which accounts are {child}&apos;s?</h3></legend>
            <p className="dm-small">eGuard applies {child}&apos;s rules only when these accounts are signed in. Other accounts aren&apos;t limited or counted.</p>
            <label className="dm-acct">
              <input type="checkbox" checked={accounts.child} onChange={(e) => setAccounts({ ...accounts, child: e.target.checked })} />
              <span className="dm-avatar">{child.slice(0, 1).toUpperCase()}</span><span className="grow"><b>{child}</b><small>Standard user</small></span>
            </label>
            <label className="dm-acct">
              <input type="checkbox" checked={accounts.parent} onChange={(e) => setAccounts({ ...accounts, parent: e.target.checked })} />
              <span className="dm-avatar alt">{parent.slice(0, 1).toUpperCase()}</span><span className="grow"><b>{parent}</b><small>Administrator · you</small></span>
            </label>
            {accounts.parent
              ? <p className="dm-note warn" role="status"><Info aria-hidden="true" />An administrator can switch eGuard off. Uninstall Protection will ask you to make this a standard account.</p>
              : null}
          </fieldset>
          <div className="dm-row-end"><button type="button" className="dm-btn" disabled={none} onClick={() => setScreen("scanning")}>Continue</button></div>
        </PcWindow>
      );
      break;
    }
    case "scanning":
      body = (
        <PcWindow title="eGuard for Windows setup">
          <h3 ref={head} tabIndex={-1}>Looking for games and apps</h3>
          <p className="dm-small">eGuard lists games and apps for you to review. It skips drivers, Office and system tools.</p>
          <ul className="dm-found" aria-live="polite">
            {FOUND_APPS.slice(0, found).map(([n, k]) => <li key={n}><Gamepad2 aria-hidden="true" /><b>{n}</b><small>{k}</small></li>)}
          </ul>
        </PcWindow>
      );
      break;
    case "home":
      body = (
        <PcWindow title="eGuard for Windows">
          <div className="dm-kidhead"><span className="dm-shield"><ShieldCheck aria-hidden="true" /></span><h3 ref={head} tabIndex={-1}>eGuard is on</h3><p>Protecting {accounts.child ? `${child}'s account` : "the chosen accounts"} on this PC</p></div>
          <p className="dm-small dm-muted">eGuard added its extension to the browsers on this PC. Open one to connect it next.</p>
        </PcWindow>
      );
      break;
  }
  return <PcFrame label={`${child}'s Windows PC`}>{body}</PcFrame>;
}

// ---------- Child's browser ----------

type BrScreen = "store" | "confirm" | "setup" | "code" | "connecting" | "connected";

function BrowserFlow({ child, browser, onPc, code, other, onPaired }: {
  child: string; browser: Browser; onPc: boolean; code: Code; other: Code | null; onPaired: () => void;
}) {
  const [screen, setScreen] = useState<BrScreen>(onPc ? "setup" : "store");
  const head = useFocusOn(screen);
  const { name: bName } = BROWSERS[browser];
  useAfter(screen === "connecting", 1000, () => { onPaired(); setScreen("connected"); });

  const extension = screen !== "store" && screen !== "confirm";
  const url = extension ? "eGuard extension · setup" : "extensions store · eGuard";
  let body: React.ReactNode;
  switch (screen) {
    case "store":
    case "confirm":
      body = (
        <div className="dm-store">
          <span className="dm-store-logo"><LogoMark size={44} /></span>
          <div className="grow">
            <h3 ref={screen === "store" ? head : undefined} tabIndex={-1}>eGuard</h3>
            <p className="dm-small dm-muted">Safe browsing for families. Blocks harmful sites and lets your child ask before opening one.</p>
          </div>
          <button type="button" className="dm-btn" onClick={() => setScreen("confirm")}>Add to {bName}</button>
          {screen === "confirm" ? (
            <div className="dm-popover" role="dialog" aria-modal="false" aria-labelledby="dm-add-h">
              <h3 id="dm-add-h" ref={head} tabIndex={-1}>Add &ldquo;eGuard&rdquo;?</h3>
              <p className="dm-small">It can read and change site data, to block sites your family&apos;s rules don&apos;t allow.</p>
              <div className="dm-row-end"><button type="button" className="dm-btn ghost" onClick={() => setScreen("store")}>Cancel</button><button type="button" className="dm-btn" onClick={() => setScreen("setup")}>Add extension</button></div>
            </div>
          ) : null}
        </div>
      );
      break;
    case "setup":
      body = (
        <div className="dm-setup">
          <LogoMark size={44} />
          <h3 ref={head} tabIndex={-1}>Set up eGuard in {bName}</h3>
          {onPc
            ? <p className="dm-note"><Info aria-hidden="true" />eGuard for Windows already added this extension, and keeps it there. You only need to connect it.</p>
            : <p className="dm-small">You&apos;ll need a browser code from the parent dashboard.</p>}
          <button type="button" className="dm-btn" onClick={() => setScreen("code")}>Get started</button>
        </div>
      );
      break;
    case "code":
      body = (
        <div className="dm-setup left">
          <h3 ref={head} tabIndex={-1}>Enter your browser code</h3>
          <p className="dm-small">In the parent dashboard, choose Add a browser. It&apos;s a different code from the one for phones and computers.</p>
          <CodeEntry code={code} other={other} kind="BROWSER" submit="Connect" onOk={() => setScreen("connecting")} />
        </div>
      );
      break;
    case "connecting":
      body = <div className="dm-setup"><LogoMark size={44} /><h3 ref={head} tabIndex={-1}>Connecting…</h3><Spinner label="Pairing with your family" /></div>;
      break;
    case "connected":
      body = (
        <div className="dm-setup">
          <span className="dm-shield"><ShieldCheck aria-hidden="true" /></span>
          <h3 ref={head} tabIndex={-1}>Connected to {child}</h3>
          <p className="dm-small">This browser now follows the rules {child}&apos;s parents set in eGuard.</p>
          {onPc ? <span className="dm-pill accent"><Monitor aria-hidden="true" />Part of {child}&apos;s PC · no extra device slot</span> : null}
          <span className="dm-pill ok"><Check aria-hidden="true" />Browser protection is on</span>
        </div>
      );
      break;
  }
  return <BrowserFrame browser={browser} url={url} tab={extension ? "eGuard setup" : "eGuard extension"} extension={extension} label={`${child}'s ${bName} browser`}>{body}</BrowserFrame>;
}

// ---------- Parent side ----------

const DEVICE_META: Record<DemoDevice, { Icon: LucideIcon; noun: string; action: string; kind: CodeKind }> = {
  phone: { Icon: Smartphone, noun: "phone", action: "Pair a device", kind: "DEVICE" },
  computer: { Icon: Monitor, noun: "PC", action: "Pair a device", kind: "DEVICE" },
  browser: { Icon: Globe, noun: "browser", action: "Add a browser", kind: "BROWSER" },
};

function PairPanel({ device, child, code, onNewCode, pairedName, checks, steps }: {
  device: DemoDevice; child: string; code: Code; onNewCode: () => void; pairedName: string | null; checks: DeviceCheck[] | null; steps: React.ReactNode[];
}) {
  const { Icon, noun, kind } = DEVICE_META[device];
  const shown = checks?.filter((c) => c.state !== "na") ?? [];
  const revealed = useReveal(!!checks, shown.length);
  const h = checks ? health(shown) : null;
  return (
    <>
      {pairedName ? (
        <div className="dm-device">
          <div className="dm-device-head">
            <i className="dm-ico ok" aria-hidden="true"><Icon /></i>
            <span className="grow"><b>{pairedName}</b><small>{checks ? "First report received" : "Connected · waiting for its first report"}</small></span>
            {h && revealed >= shown.length
              ? <span className="dm-score num"><span aria-hidden="true">{h.verified}<small>/{h.total}</small></span><span className="sr-only">{h.verified} of {h.total} checks verified</span></span>
              : <LoaderCircle className="dm-spin-ico" aria-hidden="true" />}
          </div>
          {checks ? <CheckList checks={shown} revealed={revealed} /> : <p className="dm-small dm-muted">Finish setting up on {child}&apos;s {noun}. Each protection shows as verified only once the {noun} confirms it.</p>}
        </div>
      ) : (
        <>
          <CodeCard code={code} kind={kind} onNew={onNewCode} />
          <ol className="dm-steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <p className="dm-waiting"><span className="dm-dot" aria-hidden="true" />Waiting for {child}&apos;s {noun}… This page updates on its own.</p>
          <a className="dm-jump" href="#dm-child">Go to {child}&apos;s {noun}<ArrowRight aria-hidden="true" /></a>
        </>
      )}
    </>
  );
}

// ---------- The demo ----------

type Props = { protections: DemoProtection[]; plans: Plans };

export function SetupDemo(props: Props) {
  const [run, setRun] = useState(0);
  return <Demo key={run} {...props} onRestart={() => setRun((r) => r + 1)} />;
}

function Demo({ protections, plans, onRestart }: Props & { onRestart: () => void }) {
  const [step, setStep] = useState<Step>("account");
  const [parent, setParent] = useState("Alex");
  const [email, setEmail] = useState("alex@example.com");
  const [child, setChild] = useState("Mia");
  const [age, setAge] = useState(11);
  const [devices, setDevices] = useState<DemoDevice[]>(["phone", "computer", "browser"]);
  const [browser, setBrowser] = useState<Browser>("chrome");
  const [deviceCode, setDeviceCode] = useState<Code | null>(null);
  const [browserCode, setBrowserCode] = useState<Code | null>(null);
  const [paired, setPaired] = useState<Partial<Record<DemoDevice, string>>>({});
  const [skipped, setSkipped] = useState<PermissionId[] | null>(null);
  const [adminIncluded, setAdminIncluded] = useState<boolean | null>(null);
  const [browserDone, setBrowserDone] = useState(false);
  const [said, setSaid] = useState("");
  const ids = { parent: useId(), email: useId(), child: useId(), age: useId() };
  const head = useFocusOn(step);

  const order: Step[] = ["account", "child", "devices", ...DEVICE_ORDER.filter((d) => devices.includes(d)), "done"];
  const at = order.indexOf(step);
  const go = (s: Step) => {
    // A fresh code for each pairing step, made here (an event), never during render
    if (s === "phone" || s === "computer") setDeviceCode({ value: makeCode(), issuedAt: Date.now() });
    if (s === "browser") setBrowserCode({ value: makeCode(), issuedAt: Date.now() });
    setStep(s);
    window.document.getElementById("dm-top")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  const next = () => go(order[at + 1]);
  const p = preset(age);
  const firstName = (s: string) => s.trim() || "your child";
  const kid = firstName(child);

  const phoneResult = skipped ? phoneChecks(protections, { skipped, locationOnPlan: plans.free.location }) : null;
  const pcBrowser = devices.includes("browser") && browserDone;
  const pcResult = adminIncluded === null ? null : computerChecks(protections, { browserConnected: pcBrowser, adminAccountIncluded: adminIncluded });
  const brResult = browserDone ? browserChecks(protections) : null;
  const slots = slotsUsed(devices);
  const onPc = devices.includes("computer");

  const stepDone: Record<Step, boolean> = {
    account: true, child: true, devices: true, phone: !!phoneResult, computer: !!pcResult, browser: !!brResult, done: true,
  };

  const setDevice = (d: DemoDevice, on: boolean) => setDevices((cur) => DEVICE_ORDER.filter((x) => (x === d ? on : cur.includes(x))));
  const announce = (s: string) => setSaid(s);

  // ----- Parent pane -----
  let parentPane: React.ReactNode;
  let childPane: React.ReactNode;

  const waitingRoom = (
    <div className="dm-room">
      <div className="dm-room-devices">
        {DEVICE_ORDER.map((d) => {
          const { Icon } = DEVICE_META[d];
          const on = devices.includes(d);
          return <span key={d} className={`dm-room-dev ${d}${on ? " on" : ""}`}><Icon aria-hidden="true" /><small>{d === "phone" ? "Android phone" : d === "computer" ? "Windows PC" : `${BROWSERS[browser].name} browser`}</small></span>;
        })}
      </div>
      <p>{kid}&apos;s devices show up here as you set each one up.</p>
    </div>
  );

  switch (step) {
    case "account":
      parentPane = (
        <form className="dm-col" onSubmit={(e) => { e.preventDefault(); if (parent.trim() && email.trim()) { announce("Account created."); next(); } }}>
          <h2 ref={head} tabIndex={-1}>Create your eGuard account</h2>
          <p className="dm-lead">You&apos;re the parent. One account covers your whole family, and other parents can join it later.</p>
          <label className="dm-label" htmlFor={ids.parent}>Your first name</label>
          <input id={ids.parent} className="dm-input" value={parent} maxLength={40} onChange={(e) => setParent(e.target.value)} />
          <label className="dm-label" htmlFor={ids.email}>Email</label>
          <input id={ids.email} className="dm-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="dm-note"><Info aria-hidden="true" />Demo only. Nothing you type here is saved or sent.</p>
          <button type="submit" className="dm-btn" disabled={!parent.trim() || !email.trim()}>Create account<ArrowRight aria-hidden="true" /></button>
        </form>
      );
      childPane = waitingRoom;
      break;

    case "child":
      parentPane = (
        <form className="dm-col" onSubmit={(e) => { e.preventDefault(); if (child.trim()) { announce(`${kid} added.`); next(); } }}>
          <h2 ref={head} tabIndex={-1}>Add your child</h2>
          <p className="dm-lead">Each device is paired to a child, so eGuard knows whose protections to apply.</p>
          <div className="dm-grid2">
            <div className="dm-col tight"><label className="dm-label" htmlFor={ids.child}>First name</label><input id={ids.child} className="dm-input" value={child} maxLength={30} onChange={(e) => setChild(e.target.value)} /></div>
            <div className="dm-col tight">
              <label className="dm-label" htmlFor={ids.age}>Age</label>
              <select id={ids.age} className="dm-input" value={age} onChange={(e) => setAge(Number(e.target.value))}>
                {Array.from({ length: 13 }, (_, i) => i + 5).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="dm-inset">
            <small>Starting protections, recommended for {p.band}</small>
            <ul className="dm-preset">
              <li><Hourglass aria-hidden="true" />Screen Time<b>{p.screen}</b></li>
              <li><Moon aria-hidden="true" />Bedtime<b className="num">{p.bedtime}</b></li>
              <li><Globe aria-hidden="true" />Web Filtering<b>{p.web}</b></li>
              <li><BadgeCheck aria-hidden="true" />App Approval<b>On</b></li>
            </ul>
            <p className="dm-small dm-muted">You can change any of these later. Pairing is next.</p>
          </div>
          <button type="submit" className="dm-btn" disabled={!child.trim()}><UserPlus aria-hidden="true" />Add {kid}</button>
        </form>
      );
      childPane = waitingRoom;
      break;

    case "devices": {
      const fits = slots <= plans.free.devices;
      parentPane = (
        <div className="dm-col">
          <h2 ref={head} tabIndex={-1}>Which devices does {kid} use?</h2>
          <p className="dm-lead">Pick the ones to set up now. You can add more any time.</p>
          <fieldset className="dm-fieldset">
            <legend className="sr-only">Devices to set up</legend>
            <label className={`dm-pick${devices.includes("phone") ? " on" : ""}`}>
              <input type="checkbox" checked={devices.includes("phone")} onChange={(e) => setDevice("phone", e.target.checked)} />
              <i className="dm-ico" aria-hidden="true"><AndroidMark /></i><span className="grow"><b>Android phone or tablet</b><small>The eGuard app, in child mode</small></span>
            </label>
            <label className={`dm-pick${devices.includes("computer") ? " on" : ""}`}>
              <input type="checkbox" checked={devices.includes("computer")} onChange={(e) => setDevice("computer", e.target.checked)} />
              <i className="dm-ico" aria-hidden="true"><Monitor /></i><span className="grow"><b>Windows PC</b><small>eGuard for Windows: games, apps and time</small></span>
              <span className="dm-pill muted">Preview</span>
            </label>
            <label className={`dm-pick${devices.includes("browser") ? " on" : ""}`}>
              <input type="checkbox" checked={devices.includes("browser")} onChange={(e) => setDevice("browser", e.target.checked)} />
              <i className="dm-ico" aria-hidden="true"><Globe /></i><span className="grow"><b>Web browser</b><small>The eGuard extension: safe browsing</small></span>
            </label>
            {devices.includes("browser") ? (
              <div className="dm-seg" role="radiogroup" aria-label="Which browser">
                {(Object.keys(BROWSERS) as Browser[]).map((b) => {
                  const { name, Mark } = BROWSERS[b];
                  return <button key={b} type="button" role="radio" aria-checked={browser === b} className={browser === b ? "on" : undefined} onClick={() => setBrowser(b)}><Mark />{name}</button>;
                })}
              </div>
            ) : null}
            <div className="dm-pick off" aria-disabled="true">
              <i className="dm-ico" aria-hidden="true"><AppleMark /></i><span className="grow"><b>iPhone or iPad</b><small>The iPhone and iPad app is coming soon</small></span>
            </div>
          </fieldset>
          <div className={`dm-note${fits ? "" : " accent"}`}>
            <Info aria-hidden="true" />
            <span>
              <b className="num">{slots} device {slots === 1 ? "slot" : "slots"}.</b>{" "}
              {onPc && devices.includes("browser") ? "A browser on a PC running eGuard for Windows is part of that PC, so it takes no slot. " : null}
              {fits ? `The ${plans.free.name} plan covers ${plans.free.devices}.` : `The ${plans.free.name} plan covers ${plans.free.devices}; ${plans.plus.name} covers ${plans.plus.devices}.`}
            </span>
          </div>
          <button type="button" className="dm-btn" disabled={devices.length === 0} onClick={() => { announce("Pairing started."); next(); }}>Start pairing<ArrowRight aria-hidden="true" /></button>
        </div>
      );
      childPane = waitingRoom;
      break;
    }

    case "phone":
      parentPane = (
        <div className="dm-col">
          <h2 ref={head} tabIndex={-1}>Pair {kid}&apos;s phone</h2>
          <PairPanel
            device="phone" child={kid} code={deviceCode!} pairedName={paired.phone ?? null} checks={phoneResult}
            onNewCode={() => setDeviceCode({ value: makeCode(), issuedAt: Date.now() })}
            steps={[
              <>Install eGuard from Google Play on {kid}&apos;s phone.</>,
              <>Open it, tap <b>Get Started</b>, then <b>This is my child&apos;s device</b>.</>,
              <>Enter this code and a name you&apos;ll recognise.</>,
            ]}
          />
        </div>
      );
      childPane = (
        <PhoneFlow
          child={kid} code={deviceCode!} other={browserCode}
          checksFor={(s) => phoneChecks(protections, { skipped: s, locationOnPlan: plans.free.location })}
          onPaired={(n) => { setPaired((x) => ({ ...x, phone: n })); announce(`${n} connected.`); }}
          onReported={(s) => { setSkipped(s); announce("The phone sent its first report."); }}
        />
      );
      break;

    case "computer":
      parentPane = (
        <div className="dm-col">
          <h2 ref={head} tabIndex={-1}>Pair {kid}&apos;s PC <span className="dm-pill muted">Preview</span></h2>
          <p className="dm-note"><Info aria-hidden="true" />eGuard for Windows is coming soon. This is how setup will work.</p>
          <PairPanel
            device="computer" child={kid} code={deviceCode!} pairedName={paired.computer ?? null} checks={pcResult}
            onNewCode={() => setDeviceCode({ value: makeCode(), issuedAt: Date.now() })}
            steps={[
              <>Download eGuard for Windows on {kid}&apos;s PC and run it from your administrator account.</>,
              <>Enter this code and name the PC.</>,
              <>Choose which Windows accounts are {kid}&apos;s.</>,
            ]}
          />
          {pcResult ? <p className="dm-note"><Gamepad2 aria-hidden="true" /><span><b className="num">{FOUND_APPS.length} games and apps</b> found on {paired.computer}. Review them in {kid}&apos;s Apps tab.</span></p> : null}
        </div>
      );
      childPane = (
        <ComputerFlow
          child={kid} parent={parent.trim() || "You"} code={deviceCode!}
          onPaired={(n) => { setPaired((x) => ({ ...x, computer: n })); announce(`${n} connected.`); }}
          onReported={(a) => { setAdminIncluded(a); announce("The PC sent its first report."); }}
        />
      );
      break;

    case "browser":
      parentPane = (
        <div className="dm-col">
          <h2 ref={head} tabIndex={-1}>Add {kid}&apos;s {BROWSERS[browser].name}</h2>
          <PairPanel
            device="browser" child={kid} code={browserCode!} pairedName={paired.browser ?? null} checks={brResult}
            onNewCode={() => setBrowserCode({ value: makeCode(), issuedAt: Date.now() })}
            steps={onPc ? [
              <>On {paired.computer ?? `${kid}'s PC`}, open {BROWSERS[browser].name}. eGuard has already added its extension.</>,
              <>Choose <b>Get started</b> and enter this browser code.</>,
              <>Repeat for each browser {kid} uses, so none is left unprotected.</>,
            ] : [
              <>On {kid}&apos;s computer, add the eGuard extension to {BROWSERS[browser].name}.</>,
              <>The extension opens a setup page. Choose <b>Get started</b>.</>,
              <>Enter this browser code.</>,
            ]}
          />
          {brResult && onPc ? <p className="dm-note"><Monitor aria-hidden="true" />Web Filtering on {paired.computer} is now verified too, because this browser is part of it.</p> : null}
        </div>
      );
      childPane = (
        <BrowserFlow
          child={kid} browser={browser} onPc={onPc} code={browserCode!} other={deviceCode}
          onPaired={() => { const n = `${kid}'s ${BROWSERS[browser].name}`; setPaired((x) => ({ ...x, browser: n })); setBrowserDone(true); announce(`${n} connected.`); }}
        />
      );
      break;

    case "done": {
      const rows = ([
        ["phone", phoneResult], ["computer", pcResult], ["browser", brResult],
      ] as const).filter(([d, r]) => devices.includes(d) && r);
      const todo = rows.flatMap(([d, r]) => r!.filter((c) => c.state === "guided" || c.state === "parent" || c.state === "off").map((c) => ({ ...c, device: paired[d] ?? d })));
      parentPane = (
        <div className="dm-col">
          <h2 ref={head} tabIndex={-1}>{kid} is set up</h2>
          <p className="dm-lead">This is what you&apos;d see on your dashboard. Every protection says whether the device has confirmed it.</p>
          <ul className="dm-summary">
            {rows.map(([d, r]) => {
              const h = health(r!);
              const { Icon } = DEVICE_META[d];
              const free = d === "browser" && onPc;
              return (
                <li key={d}>
                  <i className="dm-ico ok" aria-hidden="true"><Icon /></i>
                  <span className="grow"><b>{paired[d]}</b><small>{free ? `Part of ${paired.computer} · no slot` : "1 device slot"}</small></span>
                  <span className="dm-score num"><span aria-hidden="true">{h.verified}<small>/{h.total}</small></span><span className="sr-only">{h.verified} of {h.total} checks verified</span></span>
                </li>
              );
            })}
          </ul>
          {todo.length ? (
            <div className="dm-inset">
              <small>Still to do: each one comes with its steps</small>
              <ul className="dm-todo">
                {todo.map((t) => <li key={`${t.device}-${t.key}`}><Pill state={t.state} /><span><b>{t.name}</b> on {t.device}{t.note ? <small>{t.note}</small> : null}</span></li>)}
              </ul>
            </div>
          ) : null}
          <p className="dm-note">
            <Info aria-hidden="true" />
            <span>
              {kid}&apos;s devices use <b className="num">{slots} device {slots === 1 ? "slot" : "slots"}</b>.{" "}
              {slots <= plans.free.devices ? `That fits the ${plans.free.name} plan.` : `The ${plans.free.name} plan covers ${plans.free.devices}; ${plans.plus.name} covers ${plans.plus.devices}.`}
            </span>
          </p>
          <div className="dm-row">
            <Link className="dm-btn" href="/register">Create your free account<ArrowRight aria-hidden="true" /></Link>
            <button type="button" className="dm-btn ghost" onClick={onRestart}><RotateCcw aria-hidden="true" />Start over</button>
          </div>
        </div>
      );
      childPane = (
        <div className="dm-room done">
          <div className="dm-room-devices">
            {rows.map(([d]) => {
              const { Icon } = DEVICE_META[d];
              return <span key={d} className={`dm-room-dev ${d} on ok`}><Icon aria-hidden="true" /><small>{paired[d]}</small><span className="dm-pill ok"><ShieldCheck aria-hidden="true" />eGuard is on</span></span>;
            })}
          </div>
          <p>Each device keeps following {kid}&apos;s rules offline, and checks in about every 5 minutes for changes.</p>
        </div>
      );
      break;
    }
  }

  const deviceStep = step === "phone" || step === "computer" || step === "browser";
  const childLabel = step === "phone" ? `${kid}'s phone` : step === "computer" ? `${kid}'s PC` : step === "browser" ? `${kid}'s browser` : `${kid}'s devices`;

  return (
    <div className="dm" id="dm-top">
      <p className="sr-only" aria-live="polite">{said}</p>
      <ol className="dm-stepper" aria-label="Demo progress">
        {order.map((s, i) => (
          <li key={s} className={i < at ? "done" : i === at ? "now" : undefined} aria-current={i === at ? "step" : undefined}>
            <span className="dm-stepdot num" aria-hidden="true">{i < at ? <Check /> : i + 1}</span>
            <span>{STEP_LABEL[s]}</span>
            {i < at ? <span className="sr-only"> (done)</span> : null}
          </li>
        ))}
      </ol>

      <div className="dm-stage">
        <section className="dm-pane dm-parent" aria-label="Your screen, as the parent">
          <div className="dm-pane-tag"><Users aria-hidden="true" />You · eGuard</div>
          {parentPane}
        </section>
        <section className="dm-pane dm-child" id="dm-child" aria-label={childLabel}>
          <div className="dm-pane-tag child">{step === "phone" ? <Smartphone aria-hidden="true" /> : step === "computer" ? <Monitor aria-hidden="true" /> : <Globe aria-hidden="true" />}{childLabel}</div>
          {childPane}
        </section>
      </div>

      {step === "done" ? null : <div className="dm-foot">
        <button type="button" className="dm-btn ghost" onClick={onRestart}><RotateCcw aria-hidden="true" />Start over</button>
        {deviceStep ? (
          <button type="button" className="dm-btn" disabled={!stepDone[step]} onClick={next}>
            {order[at + 1] === "done" ? "Finish" : `Next: ${STEP_LABEL[order[at + 1]].toLowerCase()}`}<ArrowRight aria-hidden="true" />
          </button>
        ) : null}
      </div>}
    </div>
  );
}
