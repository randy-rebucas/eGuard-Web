"use client";

import { useActionState } from "react";
import { announceAction, moderateAction, muteAction, staffReplyAction } from "@/app/actions/console-forum";
import { Feedback } from "@/components/feedback";

/** One moderation decision on a thread or reply */
export function ModButton({ kind, id, op, label, confirm, primary }: { kind: "thread" | "post"; id: string; op: string; label: string; confirm?: string; primary?: boolean }) {
  const [state, action, pending] = useActionState(moderateAction, undefined);
  return (
    <form action={action} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} style={{ display: "inline-block" }}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button className={`btn ${primary ? "btn-primary" : "btn-secondary"} btn-sm`} disabled={pending}>{label}</button>
      <Feedback state={state} />
    </form>
  );
}

export function MuteForm({ userId, handle }: { userId: string; handle: string }) {
  const [state, action, pending] = useActionState(muteAction, undefined);
  return (
    <form action={action} className="row" style={{ gap: 4, display: "inline-flex" }}>
      <input type="hidden" name="userId" value={userId} />
      <select className="input" name="days" defaultValue="7" aria-label={`Mute ${handle} for`} style={{ width: "auto" }}>
        <option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="365">1 year</option><option value="0">Unmute</option>
      </select>
      <button className="btn btn-ghost btn-sm" disabled={pending}>Apply</button>
      <Feedback state={state} />
    </form>
  );
}

export function AnnounceForm({ categories }: { categories: { slug: string; name: string }[] }) {
  const [state, action, pending] = useActionState(announceAction, undefined);
  return (
    <form action={action} className="cn-form">
      <Feedback state={state} />
      <div className="field"><label htmlFor="an-cat">Topic</label>
        <select className="input" id="an-cat" name="category" defaultValue="announcements">
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="an-title">Title</label><input className="input" id="an-title" name="title" maxLength={120} required /></div>
      <div className="field"><label htmlFor="an-body">Post</label><textarea className="input cn-textarea" id="an-body" name="body" rows={6} maxLength={10000} required />
        <span className="field-hint">Plain text. Shown as &quot;eGuard team&quot;.</span></div>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" name="pinned" defaultChecked /> Pin it to the top of its topic</label>
      <div className="cn-actions"><button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Posting…" : "Post"}</button></div>
    </form>
  );
}

export function StaffReplyForm({ threadId }: { threadId: string }) {
  const [state, action, pending] = useActionState(staffReplyAction, undefined);
  return (
    <form action={action} className="cn-form">
      <Feedback state={state} />
      <input type="hidden" name="threadId" value={threadId} />
      <textarea className="input cn-textarea" name="body" rows={3} maxLength={10000} required aria-label="Reply as the eGuard team" placeholder="Reply as the eGuard team" />
      <div className="cn-actions"><button className="btn btn-secondary btn-sm" disabled={pending}>{pending ? "Replying…" : "Reply"}</button></div>
    </form>
  );
}
