"use client";

/** Community forms and post controls (lib/forum, app/actions/forum). */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Feedback } from "@/components/feedback";
import { useAction } from "@/components/flow";
import {
  deletePost, editPost, followThread, postReply, readNotices, reportPost, saveHandle, startThread, voteHelpful,
} from "@/app/actions/forum";
import { COMMUNITY_RULES, LIMIT, REPORT_REASONS, REPORT_REASON_LABEL, type ReportReason } from "@/lib/forum-shared";
import type { FormState } from "@/app/actions/auth";

/** Shown with an error from the privacy check: send the same text again, saying the parent is sure */
function PostAnyway({ state, pending }: { state: FormState; pending: boolean }) {
  if (state?.fields?.privacy !== "1") return null;
  return <button className="btn btn-secondary" name="acknowledged" value="1" disabled={pending}>Post anyway</button>;
}

/** Keeps a controlled field in step with the form's result: restored after an error, cleared after `clearOnOk` */
function useField(state: FormState, key: string, initial = "", clearOnOk = false) {
  const [value, setValue] = useState(initial);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state?.ok && clearOnOk) setValue("");
    else if (state?.fields?.[key] !== undefined) setValue(state.fields[key]);
  }
  return [value, setValue] as const;
}

/** The first step: a community name, and the rules. With `current`, only changes the name. */
export function HandleForm({ current }: { current?: string }) {
  const [state, action, pending] = useActionState(saveHandle, undefined);
  const [handle, setHandle] = useField(state, "handle", current ?? "");
  return (
    <form action={action} className="dash-col" style={{ gap: 14 }}>
      <Feedback state={state} />
      {current ? null : (
        <div>
          <div className="t-title">Community rules</div>
          <ul className="t-meta" style={{ margin: "6px 0 0 18px", display: "grid", gap: 4 }}>
            {COMMUNITY_RULES.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}
      <div className="field">
        <label htmlFor="fh-handle">{current ? "Your community name" : "Choose a community name"}</label>
        <input className="input" id="fh-handle" name="handle" value={handle} onChange={(e) => setHandle(e.target.value)}
          minLength={LIMIT.handleMin} maxLength={LIMIT.handle} required autoComplete="off" spellCheck={false} aria-describedby="fh-hint" />
        <span className="field-hint" id="fh-hint">Other parents see only this name, never your real name or email. Letters, numbers, _ and . ({LIMIT.handleMin}–{LIMIT.handle} characters).</span>
      </div>
      {current ? null : (
        <label className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <input type="checkbox" name="rules" required style={{ marginTop: 3 }} />
          <span>I&apos;ll follow the community rules.</span>
        </label>
      )}
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : current ? "Save name" : "Join Community"}</button></div>
    </form>
  );
}

export function ThreadForm({ categories, initialCategory }: { categories: { slug: string; name: string }[]; initialCategory?: string }) {
  const [state, action, pending] = useActionState(startThread, undefined);
  const [category, setCategory] = useField(state, "category", initialCategory ?? "");
  const [title, setTitle] = useField(state, "title");
  const [body, setBody] = useField(state, "body");
  return (
    <form action={action} className="card card-pad dash-col" style={{ gap: 14 }}>
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="ft-cat">Topic</label>
        <select className="input" id="ft-cat" name="category" value={category} onChange={(e) => setCategory(e.target.value)} required>
          <option value="" disabled>Choose a topic</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ft-title">Title</label>
        <input className="input" id="ft-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} minLength={LIMIT.titleMin} maxLength={LIMIT.title} required autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="ft-body">What would you like to ask or share?</label>
        <textarea className="input" id="ft-body" name="body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} minLength={LIMIT.bodyMin} maxLength={LIMIT.body} required aria-describedby="ft-hint" />
        <span className="field-hint" id="ft-hint">Plain text. Say &quot;my 9-year-old&quot;, not their name. Mention someone with @name.</span>
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Posting…" : <><Icon name="messages-square" />Post thread</>}</button>
        <PostAnyway state={state} pending={pending} />
      </div>
    </form>
  );
}

export function ReplyForm({ threadId }: { threadId: string }) {
  const [state, action, pending] = useActionState(postReply.bind(null, threadId), undefined);
  const [body, setBody] = useField(state, "body", "", true);
  return (
    <form action={action} className="card card-pad dash-col" style={{ gap: 12 }} id="reply">
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="fr-body">Your reply</label>
        <textarea className="input" id="fr-body" name="body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} minLength={LIMIT.bodyMin} maxLength={LIMIT.body} required />
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Posting…" : "Post reply"}</button>
        <PostAnyway state={state} pending={pending} />
      </div>
    </form>
  );
}

function EditForm({ kind, id, title, body, onDone }: { kind: "thread" | "post"; id: string; title?: string; body: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (s: FormState, f: FormData) => {
    const r = await editPost(s, f);
    if (r?.ok) onDone();
    return r;
  }, undefined);
  const [t, setT] = useField(state, "title", title ?? "");
  const [b, setB] = useField(state, "body", body);
  return (
    <form action={action} className="dash-col" style={{ gap: 12 }}>
      <Feedback state={state} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      {kind === "thread" ? (
        <div className="field"><label htmlFor={`fe-t-${id}`}>Title</label>
          <input className="input" id={`fe-t-${id}`} name="title" value={t} onChange={(e) => setT(e.target.value)} minLength={LIMIT.titleMin} maxLength={LIMIT.title} required /></div>
      ) : null}
      <div className="field"><label htmlFor={`fe-b-${id}`}>{kind === "thread" ? "Post" : "Reply"}</label>
        <textarea className="input" id={`fe-b-${id}`} name="body" rows={6} value={b} onChange={(e) => setB(e.target.value)} minLength={LIMIT.bodyMin} maxLength={LIMIT.body} required /></div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <PostAnyway state={state} pending={pending} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone} disabled={pending}>Cancel</button>
      </div>
    </form>
  );
}

function ReportForm({ kind, id, onDone }: { kind: "thread" | "post"; id: string; onDone: () => void }) {
  const [pending, run] = useAction();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  return (
    <div className="dash-col forum-report" style={{ gap: 10 }} role="group" aria-label="Report this post">
      <div className="t-title" style={{ fontSize: 14 }}>Why are you reporting this?</div>
      <select className="input" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} aria-label="Reason">
        <option value="" disabled>Choose a reason</option>
        {REPORT_REASONS.map((r) => <option key={r} value={r}>{REPORT_REASON_LABEL[r]}</option>)}
      </select>
      <textarea className="input" rows={2} maxLength={LIMIT.note} placeholder="Anything our team should know (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={pending || !reason}
          onClick={() => reason && run(() => reportPost(kind, id, reason, note), { ok: "Thanks. Our team will look at it.", onOk: onDone })}>Send report</button>
        <button className="btn btn-ghost btn-sm" onClick={onDone} disabled={pending}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * A post's text and its controls: Helpful, and Report (others' posts) or Edit and Delete (the parent's own).
 * `children`: the text as the server rendered it; replaced by the edit form while editing.
 */
export function PostShell({ kind, id, title, body, score, voted, mine, canAct, children }: {
  kind: "thread" | "post"; id: string; title?: string; body: string; score: number; voted: boolean; mine: boolean;
  /** false for removed posts and parents who can't take part yet: only the text */
  canAct: boolean;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "report">("view");
  const [pending, run] = useAction();
  const router = useRouter();
  if (mode === "edit") return <EditForm kind={kind} id={id} title={title} body={body} onDone={() => setMode("view")} />;
  return (
    <>
      {children}
      {canAct ? (
        <div className="row forum-actions" style={{ gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          <button className={`btn btn-sm ${voted ? "btn-secondary" : "btn-ghost"}`} aria-pressed={voted} disabled={pending || mine}
            title={mine ? "Others can mark your post as helpful" : undefined}
            onClick={() => run(() => voteHelpful(kind, id))}>
            <Icon name="thumbs-up" />Helpful{score ? <span className="num"> · {score}</span> : null}
          </button>
          {mine ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setMode("edit")} disabled={pending}><Icon name="pencil" />Edit</button>
              <button className="btn btn-ghost btn-sm" disabled={pending}
                onClick={() => confirm(kind === "thread" ? "Delete your thread? Replies from others stay." : "Delete your reply?")
                  && run(() => deletePost(kind, id), { ok: "Deleted.", onOk: () => kind === "thread" && router.push("/community") })}>
                <Icon name="trash" />Delete
              </button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setMode(mode === "report" ? "view" : "report")} aria-expanded={mode === "report"}><Icon name="flag" />Report</button>
          )}
        </div>
      ) : null}
      {mode === "report" ? <div style={{ marginTop: 12 }}><ReportForm kind={kind} id={id} onDone={() => setMode("view")} /></div> : null}
    </>
  );
}

export function FollowButton({ threadId, following }: { threadId: string; following: boolean }) {
  const [pending, run] = useAction();
  return (
    <button className="btn btn-secondary" disabled={pending} aria-pressed={following}
      onClick={() => run(() => followThread(threadId, !following), { ok: following ? "You won't hear about new replies." : "You'll hear about new replies." })}>
      <Icon name={following ? "bell-off" : "bell"} />{following ? "Unfollow" : "Follow"}
    </button>
  );
}

export function MarkAllRead() {
  const [pending, run] = useAction();
  return <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => readNotices(), { ok: "All caught up." })}><Icon name="check-check" />Mark all read</button>;
}
