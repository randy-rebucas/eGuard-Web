"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { AlertSeverity } from "@prisma/client";
import { Icon } from "./icon";
import { SEVERITY, SeverityLabel } from "./ui";
import { useFlow } from "./flow";
import type { AlertAction } from "./cards";
import { dismissAlert, markAlertRead, markAllRead } from "@/app/actions/family";

export type AlertItem = {
  id: string; icon: string; title: string; body: string; subject: string; time: string; severity: AlertSeverity;
  read: boolean; resolved: boolean; fromValue: string | null; toValue: string | null; action: AlertAction | null;
};

/** Matches `unreadCount`: INFO alerts and resolved ones never count as unread. */
const isUnread = (a: AlertItem) => !a.read && !a.resolved && a.severity !== "INFO";

function useAct(a: AlertItem) {
  const { openFlow } = useFlow();
  const router = useRouter();
  return () => {
    if (!a.read) markAlertRead(a.id).catch((e) => console.error("markAlertRead failed", e));
    if (a.action?.flow) openFlow(a.action.flow);
    else if (a.action?.href) router.push(a.action.href);
    else router.push("/notifications");
  };
}

/** Compact row for the dashboard and child overview. */
export function AlertRow({ a }: { a: AlertItem }) {
  const act = useAct(a);
  return (
    <button className="alert-row" onClick={act}>
      <span className={`ico-tile ${SEVERITY[a.severity].tile}`}><Icon name={a.icon} /></span>
      <span className="grow">
        <span className="t-title" style={{ display: "block" }}>{a.title}</span>
        <span className="t-meta" style={{ display: "block" }}>{a.subject}</span>
        <time>{a.time}</time>
      </span>
      {isUnread(a) ? <span className="dot" style={{ background: "var(--accent)", marginTop: 6 }} aria-label="Unread" /> : null}
    </button>
  );
}

/** Full notification entry for the notification center. */
export function NotificationItem({ a }: { a: AlertItem }) {
  const act = useAct(a);
  const [pending, start] = useTransition();
  return (
    <article className="alert-row" style={{ padding: 16, borderBottom: "1px solid var(--line)", borderRadius: 0, opacity: a.resolved ? 0.62 : 1 }}>
      <span className={`ico-tile ${SEVERITY[a.severity].tile}`}><Icon name={a.icon} /></span>
      <div className="grow">
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <SeverityLabel severity={a.severity} />
          {a.resolved ? <span className="pill tone-ok"><Icon name="circle-check" />Resolved</span> : null}
          {isUnread(a) ? <span className="pill tone-accent">New</span> : null}
        </div>
        <div className="t-title" style={{ marginTop: 4, fontSize: 15.5 }}>{a.title}</div>
        <div className="t-meta" style={{ color: "var(--ink-2)", marginTop: 2 }}>{a.body}</div>
        {a.fromValue || a.toValue ? (
          <div className="change">{a.fromValue ? <><s>{a.fromValue}</s><Icon name="arrow-right" size={14} /></> : null}<b>{a.toValue}</b></div>
        ) : null}
        <div className="t-meta" style={{ marginTop: 6 }}>{a.subject} · <time>{a.time}</time></div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {a.action ? <button className="btn btn-secondary btn-sm" onClick={act}>{a.action.label}</button> : null}
        {isUnread(a) ? (
          <button className="icon-btn" aria-label={`Mark ${a.title} as read`} title="Mark as read" disabled={pending} onClick={() => start(() => markAlertRead(a.id))}><Icon name="check" /></button>
        ) : null}
        {a.severity === "INFO" && !a.resolved ? (
          <button className="icon-btn" aria-label={`Dismiss ${a.title}`} disabled={pending} onClick={() => start(() => dismissAlert(a.id))}><Icon name="x" /></button>
        ) : null}
      </div>
    </article>
  );
}

export function MarkAllRead() {
  const [pending, start] = useTransition();
  const { toast } = useFlow();
  return (
    <button className="btn btn-secondary" disabled={pending} onClick={() => start(async () => { await markAllRead(); toast("All notifications marked as read."); })}>
      <Icon name="check-check" />Mark all as read
    </button>
  );
}

export function ViewAll({ href, label = "View all" }: { href: string; label?: string }) {
  return <Link className="link-btn" href={href}>{label} <Icon name="arrow-right" /></Link>;
}
