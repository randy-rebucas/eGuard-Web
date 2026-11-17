"use client";

import { useState, useTransition } from "react";
import { answerNps, dismissNps } from "@/app/actions/feedback";
import { Icon } from "./icon";

const SCORES = Array.from({ length: 11 }, (_, i) => i);

/**
 * The NPS survey on the dashboard (lib/feedback npsDue). Two steps: a score, then an optional comment. A low score
 * with "you may contact me" opens a support ticket, so a person answers. Nothing here asks for a store review.
 */
export function NpsCard() {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [contactOk, setContactOk] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (closed) return null;

  if (done) {
    return (
      <div className="verify-banner info-banner" role="status">
        <Icon name="circle-check" />
        <p>{done}</p>
        <button className="btn btn-ghost" onClick={() => setClosed(true)}>Close</button>
      </div>
    );
  }

  const send = () => start(async () => {
    const res = await answerNps(score!, comment, contactOk);
    if (res.error) setError(res.error);
    else setDone(res.ok ?? "Thank you.");
  });
  const low = score != null && score <= 6;

  return (
    <section className="card nps-card" aria-labelledby="nps-title" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <h2 id="nps-title" className="t-title" style={{ margin: 0 }}>How likely are you to recommend eGuard to another parent?</h2>
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { await dismissNps(); setClosed(true); })}>Not now</button>
      </div>
      <div role="radiogroup" aria-label="0 is not at all likely, 10 is extremely likely" className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {SCORES.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={score === n} className={`btn btn-sm ${score === n ? "btn-primary" : "btn-secondary"}`}
            style={{ minWidth: 40 }} onClick={() => { setScore(n); setError(null); }}>{n}</button>
        ))}
      </div>
      <div className="row t-meta" style={{ justifyContent: "space-between" }}><span>Not at all likely</span><span>Extremely likely</span></div>
      {score != null ? (
        <>
          <div className="field">
            <label htmlFor="nps-comment">{low ? "What went wrong? We'd like to fix it." : score >= 9 ? "What do you like most? (optional)" : "What would make eGuard better? (optional)"}</label>
            <textarea className="input" id="nps-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {low ? (
            <label className="check">
              <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} />
              <span>Someone from eGuard may email me about this</span>
            </label>
          ) : null}
          {error ? <div className="form-error" role="alert"><Icon name="triangle-alert" />{error}</div> : null}
          <div><button className="btn btn-primary" disabled={pending} onClick={send}>{pending ? "Sending…" : "Send"}</button></div>
        </>
      ) : null}
    </section>
  );
}
