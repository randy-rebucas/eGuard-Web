"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { AndroidMark, AppleMark, ChromeMark, EdgeMark, FirefoxMark, STORE_LINKS } from "./brand-marks";

/*
 * How a parent connects a child's device. The button names match the child apps (Android: "Get Started",
 * "This is my child's device", "Connect"; the extension: "Get started"), so keep them in step when those change.
 * Shown three ways: a banner on every page until something is paired, a dialog from the banner or the profile menu,
 * and a card on the Devices page above the pairing forms.
 */

const OPEN = "eg:connect-guide";
/** Opens the guide dialog from anywhere in the app (the banner, the profile menu). */
export const openConnectGuide = () => window.dispatchEvent(new Event(OPEN));

const TABS = [
  ["android", "Android phone or tablet"],
  ["browser", "Computer"],
  ["ios", "iPhone or iPad"],
] as const;
type Tab = (typeof TABS)[number][0];

/** A store link that opens in a new tab, so the parent keeps their place (and any code on screen) here. */
function Store({ href, Mark, label }: { href: string; Mark: () => React.ReactElement; label: string }) {
  return (
    <a className="btn btn-secondary btn-sm guide-store" href={href} target="_blank" rel="noopener noreferrer">
      <Mark />{label}<span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** The tabs and steps. `onNavigate`: the dialog closes when a step links to the pairing forms. */
function GuideBody({ hasChildren, onNavigate, idp }: { hasChildren: boolean; onNavigate?: () => void; idp: string }) {
  const [tab, setTab] = useState<Tab>("android");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = TABS.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next][0]);
    tabs.current[next]?.focus();
  };
  const go = (href: string, label: string) => <Link className="inline-link" href={href} onClick={onNavigate}>{label}</Link>;

  return (
    <div className="dash-col" style={{ gap: 16 }}>
      {hasChildren ? null : (
        <div className="upgrade-note">
          <Icon name="user-plus" />
          <span className="grow"><b>First, add your child.</b> Each device is paired to a child, so eGuard knows whose protections to apply.</span>
          <Link className="link-btn" href="/children/new" onClick={onNavigate}>Add child <Icon name="arrow-right" /></Link>
        </div>
      )}
      <div className="tabs fit" role="tablist" aria-label="Device type">
        {TABS.map(([k, l], i) => (
          <button
            key={k} ref={(el) => { tabs.current[i] = el; }} type="button" className="tab" role="tab" id={`${idp}-tab-${k}`} aria-controls={`${idp}-panel`}
            aria-selected={tab === k} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)} onKeyDown={(e) => onKey(e, i)}
          >{l}</button>
        ))}
      </div>

      <div role="tabpanel" id={`${idp}-panel`} aria-labelledby={`${idp}-tab-${tab}`} className="dash-col" style={{ gap: 14 }}>
        {tab === "android" ? (
          <>
            <ol className="guide-steps">
              <li><span><b>Get a pairing code.</b> In {go("/devices#pair", "Pair a device")}, choose your child and select <b>Get pairing code</b>. The code works for 15 minutes.</span></li>
              <li><span><b>Install eGuard on your child&apos;s phone or tablet</b> from Google Play.</span></li>
              <li><span><b>Open eGuard</b>, tap <b>Get Started</b>, then <b>This is my child&apos;s device</b>.</span></li>
              <li><span><b>Enter the code</b> and a device name you&apos;ll recognise, like &ldquo;Mia&apos;s Galaxy A15&rdquo;, then tap <b>Connect</b>.</span></li>
              <li><span><b>Allow what eGuard asks for.</b> It explains each permission before Android asks: usage access for screen time and app limits, location if you turn it on, and device admin so it can&apos;t be uninstalled. Web filtering is one guided step on the phone.</span></li>
            </ol>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <Store href={STORE_LINKS.googlePlay} Mark={AndroidMark} label="Get it on Google Play" />
            </div>
          </>
        ) : tab === "browser" ? (
          <>
            <ol className="guide-steps">
              <li><span><b>Get a browser code.</b> In {go("/devices#add-browser", "Add a browser")}, choose your child, name the computer, and select <b>Get pairing code</b>.</span></li>
              <li><span><b>On your child&apos;s computer, add the eGuard extension</b> to the browser they use: Chrome, Edge or Firefox.</span></li>
              <li><span><b>The extension opens a setup page.</b> Choose <b>Get started</b> and enter the code.</span></li>
              <li><span><b>Repeat for each browser</b> your child uses on that computer, so none of them is left unprotected.</span></li>
            </ol>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <Store href={STORE_LINKS.chrome} Mark={ChromeMark} label="Chrome" />
              <Store href={STORE_LINKS.edge} Mark={EdgeMark} label="Edge" />
              <Store href={STORE_LINKS.firefox} Mark={FirefoxMark} label="Firefox" />
            </div>
            <p className="t-meta">eGuard for Windows, which also limits games and apps, is coming soon.</p>
          </>
        ) : (
          <div className="row" style={{ alignItems: "flex-start" }}>
            <span className="ico-tile muted guide-mark"><AppleMark /></span>
            <div className="grow">
              <div className="t-title">The iPhone and iPad app is coming soon</div>
              <div className="t-meta">Until then, you can protect your child&apos;s browsing on a computer with the eGuard extension, and pair any Android phone or tablet they use.</div>
            </div>
          </div>
        )}
      </div>

      {tab !== "ios" ? (
        <div className="upgrade-note">
          <Icon name="info" />
          <span className="grow">The Devices page updates on its own once the device connects. eGuard isn&apos;t hidden on your child&apos;s device, so tell them what it does before you set it up.</span>
        </div>
      ) : null}

      {/* The public walkthrough, with pictures of each screen. A new tab, so a pairing code on screen here isn't lost */}
      <a className="link-btn guide-more" href={tab === "ios" ? "/how-it-works#iphone-android" : "/how-it-works#setup"} target="_blank" rel="noopener">
        <Icon name="book-open" />See the full setup guide, with pictures of each step<span className="sr-only"> (opens in a new tab)</span><Icon name="arrow-right" />
      </a>
    </div>
  );
}

/** On the Devices page, above the pairing forms. `open`: shown expanded, for a family with nothing paired yet. */
export function ConnectGuide({ open }: { open: boolean }) {
  return (
    <details className="card card-pad connect-guide" id="guide" open={open}>
      <summary>
        <span className="ico-tile"><Icon name="book-open" /></span>
        <span className="grow">
          <span className="t-title">How to connect your child&apos;s device</span>
          <span className="t-meta">A few steps, about 5 minutes. Keep their device nearby and on Wi‑Fi.</span>
        </span>
        <Icon name="chevron-down" className="guide-chevron" />
      </summary>
      <div style={{ marginTop: 16 }}><GuideBody hasChildren idp="guide" /></div>
    </details>
  );
}

/**
 * On every page until the family has a device or browser paired: the one thing that makes eGuard do anything.
 * Not on the Devices page, where the guide itself is already open above the pairing forms.
 */
export function ConnectBanner({ hasChildren }: { hasChildren: boolean }) {
  const path = usePathname();
  if (path === "/devices") return null;
  return (
    <div className="verify-banner info-banner connect-banner" role="status">
      <Icon name="tablet-smartphone" />
      <p>
        <strong>Connect your child&apos;s device to start protecting them.</strong>{" "}
        {hasChildren
          ? "Nothing is paired yet, so eGuard can't apply or check any protections. It takes about 5 minutes."
          : "Add your child, then pair their phone, tablet or browser. It takes about 5 minutes."}
      </p>
      <button type="button" className="btn btn-secondary" onClick={openConnectGuide}><Icon name="book-open" />Show me how</button>
      {hasChildren
        ? <Link className="btn btn-primary" href="/devices#pair"><Icon name="plus" />Pair a device</Link>
        : <Link className="btn btn-primary" href="/children/new"><Icon name="user-plus" />Add child</Link>}
    </div>
  );
}

function trapTab(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab") return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/** The guide as a dialog, mounted once in the app layout and opened with `openConnectGuide()`. */
export function ConnectGuideDialog({ hasChildren }: { hasChildren: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN, show);
    return () => window.removeEventListener(OPEN, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); back?.focus?.(); };
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dialog connect-dialog" role="dialog" aria-modal="true" aria-labelledby="cg-title" onKeyDown={trapTab}>
        <div className="dialog-head">
          <span className="ico-tile"><Icon name="book-open" /></span>
          <div className="grow">
            <h2 id="cg-title">How to connect your child&apos;s device</h2>
            <div className="t-meta">A few steps, about 5 minutes. Keep their device nearby and on Wi‑Fi.</div>
          </div>
          <button type="button" ref={closeBtn} className="btn btn-ghost btn-sm" aria-label="Close" onClick={close}><Icon name="x" /></button>
        </div>
        <div className="dialog-body"><GuideBody hasChildren={hasChildren} onNavigate={close} idp="cg" /></div>
        <div className="dialog-foot">
          <button type="button" className="btn btn-ghost" onClick={close}>Close</button>
          {hasChildren
            ? <Link className="btn btn-primary" href="/devices#pair" onClick={close}><Icon name="plus" />Get a pairing code</Link>
            : <Link className="btn btn-primary" href="/children/new" onClick={close}><Icon name="user-plus" />Add child</Link>}
        </div>
      </div>
    </div>
  );
}
