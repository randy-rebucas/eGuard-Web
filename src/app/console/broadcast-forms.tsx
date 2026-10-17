"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { draftBroadcastWithAi, saveBroadcast, sendBroadcast, testBroadcast } from "@/app/actions/console";
import { Feedback } from "@/components/feedback";

type Draft = { id: string; audience: string; kind: string; subject: string; body: string; plans: string[] };
type AudienceOption = { id: string; label: string; hint: string };

/**
 * Write a new email, or edit a draft. No plan ticked: every plan. `ai`: who drafts with AI (Claude, OpenAI), or null.
 * A mailing list (any audience but PARENTS) has no kind or plans to choose: it's always a product update to the list.
 */
export function BroadcastEditor({ draft, planNames, audiences, ai }: { draft?: Draft; planNames: string[]; audiences: AudienceOption[]; ai: string | null }) {
  const [state, action, pending] = useActionState(saveBroadcast, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // After a failed save, show what was typed rather than what's stored
  const f = state?.fields;
  const v = f ? { audience: f.audience, kind: f.kind, subject: f.subject, body: f.body, plans: f.plans ? f.plans.split("\n") : [] } : draft;
  const kind = v?.kind || "UPDATE";
  const [audience, setAudience] = useState(v?.audience || "PARENTS");
  const parents = audience === "PARENTS";
  return (
    // The key resets the fields to what was typed (or saved) each time the action returns
    <form ref={formRef} key={JSON.stringify(state ?? draft?.id ?? "new")} action={action} className="cn-form" noValidate>
      <Feedback state={state} />
      {draft ? <input type="hidden" name="id" value={draft.id} /> : null}
      <fieldset className="cn-fieldset">
        <legend className="cn-legend">To</legend>
        {audiences.map((a) => (
          <label key={a.id} className="check">
            <input type="radio" name="audience" value={a.id} checked={audience === a.id} onChange={() => setAudience(a.id)} />
            <span><b>{a.label}</b><br /><span className="field-hint">{a.hint}</span></span>
          </label>
        ))}
      </fieldset>
      {parents ? <ParentFields kind={kind} plans={v?.plans ?? []} planNames={planNames} /> : <input type="hidden" name="kind" value="UPDATE" />}
      <AiWriter formRef={formRef} provider={ai} />
      <div className="field">
        <label htmlFor="bc-subject">Subject</label>
        <input className="input" id="bc-subject" name="subject" maxLength={150} required defaultValue={v?.subject ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="bc-body">Message</label>
        <textarea className="input cn-textarea" id="bc-body" name="body" required defaultValue={v?.body ?? ""}
          placeholder={"What's new, in plain text.\n\nA blank line starts a new paragraph. Links like https://eguard.family/help become clickable."} />
        <span className="field-hint">{parents ? <>&ldquo;Hi &lt;first name&gt;,&rdquo; is added above it</> : <>&ldquo;Hi,&rdquo; is added above it (subscribers give no name)</>}, and the sign-off and why they got it below.</span>
      </div>
      <div className="cn-actions">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : draft ? "Save draft" : "Create draft"}</button>
      </div>
    </form>
  );
}

/** Kind and plans: only for an email to parents */
function ParentFields({ kind, plans, planNames }: { kind: string; plans: string[]; planNames: string[] }) {
  return (
    <>
      <fieldset className="cn-fieldset">
        <legend className="cn-legend">Kind</legend>
        <label className="check">
          <input type="radio" name="kind" value="UPDATE" defaultChecked={kind === "UPDATE"} />
          <span><b>Product update</b><br /><span className="field-hint">New features and news. Only parents who haven&apos;t turned product updates off, with an unsubscribe link.</span></span>
        </label>
        <label className="check">
          <input type="radio" name="kind" value="SERVICE" defaultChecked={kind === "SERVICE"} />
          <span><b>Service notice</b><br /><span className="field-hint">Changes to terms or privacy, security notices, outages. Every verified parent, whatever their settings. Not for marketing.</span></span>
        </label>
      </fieldset>
      <fieldset className="cn-fieldset">
        <legend className="cn-legend">Plans</legend>
        <div className="cn-choices">
          {planNames.map((p) => (
            <label key={p} className="check"><input type="checkbox" name="plans" value={p} defaultChecked={plans.includes(p)} /><span>{p}</span></label>
          ))}
        </div>
        <span className="field-hint">None ticked: every plan.</span>
      </fieldset>
    </>
  );
}

/**
 * "Write with AI": describe the email (or, with something already written, what to change) and the AI fills the
 * subject and message. It only fills the form: staff read it, edit it and save it like anything they typed.
 */
function AiWriter({ formRef, provider }: { formRef: React.RefObject<HTMLFormElement | null>; provider: string | null }) {
  const [brief, setBrief] = useState("");
  const [note, setNote] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  if (!provider) return <p className="field-hint">Writing with AI needs ANTHROPIC_API_KEY or OPENAI_API_KEY on the server.</p>;
  const field = (name: string) => formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  const run = () => start(async () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const r = await draftBroadcastWithAi({
      brief, kind: String(data.get("kind") ?? "UPDATE") as "UPDATE" | "SERVICE", plans: data.getAll("plans").map(String),
      subject: String(data.get("subject") ?? ""), body: String(data.get("body") ?? ""),
    });
    if ("error" in r) return setNote({ error: r.error });
    const subject = field("subject"), body = field("body");
    if (subject) subject.value = r.subject;
    if (body) body.value = r.body;
    setBrief("");
    setNote({ ok: r.placeholders ? "Drafted. Fill in the [TODO: …] parts, check it, then save." : "Drafted. Check it, edit anything, then save." });
  });
  return (
    <div className="cn-ai">
      <div className="field">
        <label htmlFor="bc-brief">Write with AI</label>
        <textarea className="input cn-ai-brief" id="bc-brief" value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={4000}
          placeholder={"What should the email tell parents? E.g. Saved places is out for Plus and Pro: get a notice when your child arrives at or leaves school. Set it up in Location › Saved places.\n\nWith a message already below, say what to change: shorter, friendlier, in Filipino…"} />
        <span className="field-hint">{provider} drafts the subject and message below from this, replacing what&apos;s there. Nothing is saved or sent until you do. Only what you type here and below is sent to {provider}.</span>
      </div>
      <Feedback state={note} />
      <div className="cn-actions">
        <button type="button" className="btn btn-secondary" disabled={pending || brief.trim().length < 10} onClick={run}>
          {pending ? "Writing…" : "Draft with AI"}
        </button>
      </div>
    </div>
  );
}

export function TestForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(testBroadcast, undefined);
  return (
    <form action={action} className="cn-form">
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="cn-actions"><button className="btn btn-secondary" disabled={pending}>{pending ? "Sending…" : "Send me a test"}</button></div>
    </form>
  );
}

/** Now or at a time (Philippine time, like every time in the console), confirmed with the audience size. */
export function SendForm({ id, audience, noun, minTime }: { id: string; audience: number; noun: string; minTime: string }) {
  const [state, action, pending] = useActionState(sendBroadcast, undefined);
  const [mode, setMode] = useState<"now" | "later">("now");
  const parents = `${audience.toLocaleString("en-US")} ${noun}`;
  return (
    <form action={action} className="cn-form">
      <Feedback state={state} />
      <input type="hidden" name="id" value={id} />
      <fieldset className="cn-fieldset">
        <legend className="cn-legend">When</legend>
        <label className="check"><input type="radio" name="mode" value="now" checked={mode === "now"} onChange={() => setMode("now")} /><span>Now</span></label>
        <label className="check"><input type="radio" name="mode" value="later" checked={mode === "later"} onChange={() => setMode("later")} /><span>At a set time</span></label>
      </fieldset>
      {mode === "later" ? (
        <div className="field">
          <label htmlFor="bc-when">Date and time (Philippine time)</label>
          <input className="input" id="bc-when" name="when" type="datetime-local" min={minTime} required />
        </div>
      ) : null}
      <label className="check">
        <input type="checkbox" name="confirm" required />
        <span>Send this to {parents}. I&apos;ve sent myself a test and checked it.</span>
      </label>
      <div className="cn-actions">
        <button className="btn btn-primary" disabled={pending || !audience}>
          {pending ? "Working…" : mode === "now" ? `Send to ${parents}` : "Schedule"}
        </button>
      </div>
    </form>
  );
}
