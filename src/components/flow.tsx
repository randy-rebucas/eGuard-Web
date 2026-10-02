"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import type { ProtectionKey } from "@prisma/client";
import { Icon } from "./icon";
import { Loading } from "./skeleton";

/* ================= Lazy dialogs ================= */

// The dialogs only render after a click, so their code stays out of every app page's initial bundle.
const loadDialogs = () => import("./flow-dialogs");
/** Starts downloading the dialogs early (hover/focus on a button that opens one); safe to call repeatedly. */
const preloadDialogs = () => { void loadDialogs().catch(() => {}); };
const DialogLoading = () => (
  <div className="scrim"><div className="dialog"><div className="dialog-body"><Loading height={140} label="Loading" /></div></div></div>
);
const ConfigFlow = dynamic(() => loadDialogs().then((m) => m.ConfigFlow), { ssr: false, loading: DialogLoading });
const CheckDialog = dynamic(() => loadDialogs().then((m) => m.CheckDialog), { ssr: false, loading: DialogLoading });

/* ================= Context ================= */

export type ToastTone = "info" | "ok" | "error";
type Ctx = {
  openFlow: (o?: { key?: ProtectionKey; childId?: string }) => void;
  runCheck: (deviceId?: string) => void;
  toast: (msg: string, tone?: ToastTone) => void;
};
const FlowCtx = createContext<Ctx | null>(null);
export const useFlow = () => {
  const c = useContext(FlowCtx);
  if (!c) throw new Error("useFlow outside provider");
  return c;
};

/** Shown when an action fails for a reason the server didn't explain (offline, server error). */
export const FAILED = "Something went wrong. Check your connection and try again.";

const TOAST_ICON: Record<ToastTone, string> = { info: "info", ok: "circle-check", error: "triangle-alert" };

/**
 * Runs a server action in a transition with the app's feedback rules:
 * `{ error }` or a thrown failure shows an error toast (and calls `onError` to roll back),
 * success shows `ok` if given. A throw never reaches the page's error boundary.
 */
export function useAction() {
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  const run = useCallback(<T,>(fn: () => Promise<T>, o: { ok?: string | ((r: T) => string); onOk?: (r: T) => void; onError?: () => void } = {}) =>
    start(async () => {
      let r: T;
      try {
        r = await fn();
      } catch {
        o.onError?.();
        toast(FAILED, "error");
        return;
      }
      const error = (r as { error?: string } | undefined)?.error;
      if (error) { o.onError?.(); toast(error, "error"); return; }
      o.onOk?.(r);
      const msg = typeof o.ok === "function" ? o.ok(r) : o.ok;
      if (msg) toast(msg, "ok");
    }), [toast]);
  return [pending, run] as const;
}

export function FlowProvider({ children }: { children: React.ReactNode }) {
  const [flow, setFlow] = useState<{ key?: ProtectionKey; childId?: string; n: number } | null>(null);
  const [check, setCheck] = useState<{ deviceId?: string; n: number } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; tone: ToastTone }[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((msg: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    // The same message twice in a row (a double click) replaces the first rather than stacking
    setToasts((t) => [...t.filter((x) => x.msg !== msg), { id, msg, tone }].slice(-3));
    setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4500);
  }, [dismiss]);
  const value = useMemo<Ctx>(() => ({
    openFlow: (o) => setFlow({ ...o, n: Date.now() }),
    runCheck: (deviceId) => setCheck({ deviceId, n: Date.now() }),
    toast,
  }), [toast]);
  return (
    <FlowCtx.Provider value={value}>
      {children}
      {flow ? <ConfigFlow key={flow.n} initialKey={flow.key} initialChild={flow.childId} onClose={() => setFlow(null)} /> : null}
      {check ? <CheckDialog key={check.n} deviceId={check.deviceId} onClose={() => setCheck(null)} /> : null}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className={`toast ${t.tone}`} key={t.id} role={t.tone === "error" ? "alert" : "status"}>
            <Icon name={TOAST_ICON[t.tone]} /><span className="grow">{t.msg}</span>
            <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
    </FlowCtx.Provider>
  );
}

/* ================= Buttons usable from server components ================= */

export function FlowButton({ protection, childId, className = "btn btn-secondary btn-sm", children }: { protection?: ProtectionKey; childId?: string; className?: string; children: React.ReactNode }) {
  const { openFlow } = useFlow();
  return <button type="button" className={className} onPointerEnter={preloadDialogs} onFocus={preloadDialogs} onClick={() => openFlow({ key: protection, childId })}>{children}</button>;
}

export function CheckButton({ deviceId, className = "btn btn-primary", disabled, children }: { deviceId?: string; className?: string; disabled?: boolean; children: React.ReactNode }) {
  const { runCheck } = useFlow();
  return <button type="button" className={className} disabled={disabled} onPointerEnter={preloadDialogs} onFocus={preloadDialogs} onClick={() => runCheck(deviceId)}>{children}</button>;
}

export function ToastButton({ message, className = "btn btn-secondary btn-sm", children }: { message: string; className?: string; children: React.ReactNode }) {
  const { toast } = useFlow();
  return <button type="button" className={className} onClick={() => toast(message)}>{children}</button>;
}
