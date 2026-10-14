"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";
import { LogoMark } from "./logo";

/** Keeps Tab inside a dialog: from the last control back to the first, and the other way with Shift. */
function trapTab(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab") return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ================= Intro ================= */

const HOW = [
  { icon: "user-plus", title: "Add your child", text: "Pick an age-based protection profile. You can fine-tune every setting later." },
  { icon: "tablet-smartphone", title: "Pair their device", text: "Install eGuard on their Android phone or tablet and enter a pairing code. iPhone and iPad are coming soon." },
  { icon: "shield-check", title: "Stay in the loop", text: "eGuard checks every day that each protection is still on, and tells you when one stops working." },
];

export function Intro({ firstName, onTour, onSkip }: { firstName: string; onTour: () => void; onSkip: () => void }) {
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    primary.current?.focus();
    return () => back?.focus?.();
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onSkip();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onSkip]);
  return (
    <div className="scrim">
      <div className="dialog intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-text" onKeyDown={trapTab}>
        <div className="intro-band" aria-hidden="true"><LogoMark size={52} /></div>
        <div className="dialog-body">
          <span className="eyebrow">Welcome to eGuard</span>
          <h2 id="intro-title">Hi {firstName}, let&apos;s get your family set up</h2>
          <p id="intro-text" className="t-meta intro-lede">eGuard sets up protections on your children&apos;s phones, tablets and browsers, then makes sure they stay on.</p>
          <ol className="intro-steps">
            {HOW.map((s, n) => (
              <li key={s.title}>
                <span className="ico-tile"><Icon name={s.icon} /></span>
                <span><b><span className="sr-only">Step {n + 1}: </span>{s.title}</b><span className="t-meta">{s.text}</span></span>
              </li>
            ))}
          </ol>
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn btn-ghost" onClick={onSkip}>Skip for now</button>
          <button type="button" className="btn btn-primary" ref={primary} onClick={onTour}><Icon name="compass" />Take the quick tour</button>
        </div>
      </div>
    </div>
  );
}

/* ================= Quick tour ================= */

/** One place a step can point at (`data-tour` on the element); the first one visible on this screen size wins. */
type Spot = { target: string; title: string; text: string };
type Step = Spot[];

const steps = (hasChildren: boolean): Step[] => [
  hasChildren
    ? [{ target: "summary", title: "Your family at a glance", text: "How many children are protected, which devices are connected, and what needs you. Each card opens the details." }]
    : [{ target: "get-started", title: "Start here", text: "Add your first child, then pair their phone or tablet. Protections switch on as soon as the device syncs." }],
  [{ target: "nav-children", title: "Children", text: "One profile per child: their age-based protections, devices, places and activity." }],
  [{ target: "nav-devices", title: "Devices", text: "Pair a phone or tablet with a code, connect the browser extension, and see which devices need attention." }],
  [{ target: "nav-protection", title: "Protection", text: "Screen time, app limits, bedtime, web filtering and more, with a health check on every setting." }],
  [
    { target: "nav-reports", title: "Reports and location", text: "Weekly screen time and app use, and, on plans with location sharing, where your children are." },
    { target: "nav-more", title: "More", text: "Reports, location and settings are in here." },
  ],
  [{ target: "alerts", title: "Alerts", text: "Approval requests, protections that stop working and devices that go quiet. Choose push or email in Settings." }],
  [
    { target: "search", title: "Search", text: "Find a child, device or setting. Press / from any page." },
    { target: "search-toggle", title: "Search", text: "Find a child, device or setting." },
  ],
  ...(hasChildren ? [[{ target: "quick-actions", title: "Quick actions", text: "Run a configuration check, set limits and bedtime, or manage apps, right from the dashboard." }]] : []),
  [{ target: "account", title: "Your account", text: "Account, family members, security and the theme. Replay this tour from here at any time." }],
];

function visible(target: string) {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function resolve(step: Step) {
  for (const spot of step) {
    const el = visible(spot.target);
    if (el) return { el, spot };
  }
  return null;
}

type Box = { top: number; left: number; width: number; height: number };
const PAD = 6, GAP = 14, M = 16;

/** Where the card goes: beside the sidebar, above the phone tab bar, otherwise below or above the highlight. */
function place(b: Box | null, w: number, h: number, vw: number, vh: number) {
  if (!b) return { left: (vw - w) / 2, top: (vh - h) / 2 };
  const right = b.left + b.width, bottom = b.top + b.height;
  const fits = { bottom: bottom + GAP + h <= vh - M, top: b.top - GAP - h >= M, right: right + GAP + w <= vw - M, left: b.left - GAP - w >= M };
  const order = (b.left < 120 && right < 320 ? ["right", "bottom", "top"] : b.top > vh * 0.6 ? ["top", "bottom", "right", "left"] : ["bottom", "top", "right", "left"]) as (keyof typeof fits)[];
  const side = order.find((s) => fits[s]);
  let left: number, top: number;
  if (side === "bottom" || side === "top") { left = b.left + b.width / 2 - w / 2; top = side === "bottom" ? bottom + GAP : b.top - GAP - h; }
  else if (side) { top = b.top + b.height / 2 - h / 2; left = side === "right" ? right + GAP : b.left - GAP - w; }
  // Taller than the screen allows (a stacked section on a phone): the card sits at the bottom, over the highlight's end
  else { left = (vw - w) / 2; top = vh - h - M; }
  return { left: Math.min(Math.max(left, M), vw - w - M), top: Math.min(Math.max(top, M), vh - h - M) };
}

const same = (a: Box | null, b: Box | null) => a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

export function QuickTour({ hasChildren, onClose }: { hasChildren: boolean; onClose: () => void }) {
  const path = usePathname();
  const [list, setList] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);
  const [view, setView] = useState<{ box: Box | null; spot: Spot | null; w: number; h: number; vw: number; vh: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);

  // The steps this screen can show, once the dashboard is there (starting elsewhere navigates to it first)
  useEffect(() => {
    if (list || path !== "/dashboard") return;
    const all = steps(hasChildren);
    const started = Date.now();
    const t = setInterval(() => {
      if (!resolve(all[0]) && Date.now() - started < 4000) return;
      clearInterval(t);
      const shown = all.filter((s) => resolve(s));
      if (shown.length) setList(shown); else onClose();
    }, 100);
    return () => clearInterval(t);
  }, [list, path, hasChildren, onClose]);

  const step = list?.[i];

  // Follows the highlighted element every frame: smooth scrolling, streamed sections and resizes all move it
  useEffect(() => {
    if (!step) return;
    let raf = 0, scrolled = false;
    const tick = () => {
      const hit = resolve(step);
      let box: Box | null = null;
      if (hit) {
        let r = hit.el.getBoundingClientRect();
        if (!scrolled) {
          scrolled = true;
          if (r.top < 72 || r.bottom > innerHeight - 88) {
            const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
            hit.el.scrollIntoView({ block: r.height > innerHeight / 2 ? "start" : "center", behavior: smooth ? "smooth" : "auto" });
            r = hit.el.getBoundingClientRect();
          }
        }
        box = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
      }
      const w = card.current?.offsetWidth ?? 340, h = card.current?.offsetHeight ?? 200;
      setView((v) => (v && same(v.box, box) && v.spot === (hit?.spot ?? null) && v.w === w && v.h === h && v.vw === innerWidth && v.vh === innerHeight
        ? v : { box, spot: hit?.spot ?? null, w, h, vw: innerWidth, vh: innerHeight }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const last = !!list && i === list.length - 1;
  const next = () => (last ? onClose() : setI((n) => n + 1));
  const back = () => setI((n) => Math.max(0, n - 1));

  useEffect(() => {
    if (!list) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((n) => (n < list.length - 1 ? n + 1 : n));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [list, onClose]);

  // Each step is announced and takes focus; closing the tour gives focus back to where it was
  useEffect(() => { if (list) card.current?.focus(); }, [list, i]);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    return () => back?.focus?.();
  }, []);

  if (!list || !step) return null;
  const spot = view?.spot ?? step[0];
  const pos = view ? place(view.box, view.w, view.h, view.vw, view.vh) : { left: -9999, top: 0 };
  return (
    <div className="tour" data-ready={view ? "" : undefined}>
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      {view?.box ? <div className="tour-hole" style={view.box} /> : <div className="tour-dim" />}
      <div className="tour-card" ref={card} style={pos} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text" tabIndex={-1} onKeyDown={trapTab}>
        <div className="row tour-top">
          <span className="eyebrow num">Step {i + 1} of {list.length}</span>
          <button type="button" className="tour-x" aria-label="Close the tour" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <h2 id="tour-title">{spot.title}</h2>
        <p id="tour-text">{spot.text}</p>
        <div className="tour-dots" aria-hidden="true">{list.map((_, n) => <span key={n} className={n === i ? "on" : undefined} />)}</div>
        <div className="tour-foot">
          {i > 0 ? <button type="button" className="btn btn-ghost btn-sm" onClick={back}><Icon name="arrow-left" />Back</button> : <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Skip tour</button>}
          {last && !hasChildren
            ? <Link className="btn btn-primary btn-sm" href="/children/new" onClick={onClose}><Icon name="plus" />Add your first child</Link>
            : <button type="button" className="btn btn-primary btn-sm" onClick={next}>{last ? "Done" : <>Next<Icon name="arrow-right" /></>}</button>}
        </div>
      </div>
    </div>
  );
}
