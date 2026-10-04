"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { Feedback } from "./feedback";
import { useAction, useFlow } from "./flow";
import { peso } from "@/lib/format";
import { planById } from "@/lib/plans";
import {
  addOrgAdmin, buyCodes, cancelCode, createApiKey, createOrganization, joinOrganization, leaveOrganization, makeOrgOwner, previewJoin,
  redeemCode, removeOrgAdmin, replaceJoinCode, revokeApiKey,
} from "@/app/actions/organizations";

/* ---------- Families ---------- */

/** Enter a join code, see who it belongs to and what they'll see, then confirm. */
export function JoinOrgForm() {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ name: string; kind: string; alreadyJoined: boolean } | null>(null);
  const [pending, run] = useAction();

  if (preview) {
    return (
      <div className="org-confirm" role="group" aria-label={`Join ${preview.name}`}>
        <div className="row" style={{ gap: 12 }}>
          <span className="ico-tile"><Icon name="building" /></span>
          <div><div className="t-title">{preview.name}</div><div className="t-meta">{preview.kind}</div></div>
        </div>
        {preview.alreadyJoined ? (
          <p className="t-meta">Your family has already joined {preview.name}.</p>
        ) : (
          <p className="t-meta">{preview.name} will see that one more family joined. It never sees your family&apos;s name, children, devices, settings, activity or location. You can leave at any time.</p>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setPreview(null)}>Cancel</button>
          {preview.alreadyJoined ? null : (
            <button className="btn btn-primary btn-sm" disabled={pending}
              onClick={() => run(() => joinOrganization(code), { ok: `Your family joined ${preview.name}.`, onOk: () => { setPreview(null); setCode(""); } })}>
              {pending ? <><Icon name="loader-circle" className="spin" />Joining…</> : `Join ${preview.name}`}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <form className="row org-code-form" onSubmit={(e) => { e.preventDefault(); run(() => previewJoin(code), { onOk: (r) => { if (r.error === undefined) setPreview(r); } }); }}>
      <label className="sr-only" htmlFor="org-join">Organization code</label>
      <input id="org-join" className="input org-code-input" placeholder="XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false}
        value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} />
      <button className="btn btn-secondary" disabled={pending || code.replace(/[^a-z0-9]/gi, "").length < 8}>{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}

export function LeaveOrgButton({ orgId, name }: { orgId: string; name: string }) {
  const [pending, run] = useAction();
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirm(false)}>Cancel</button>
      <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => leaveOrganization(orgId), { ok: `Your family left ${name}.` })}>
        {pending ? <><Icon name="loader-circle" className="spin" />Leaving…</> : `Leave ${name}`}
      </button>
    </div>
  ) : <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)}>Leave</button>;
}

/** Settings › Subscription: redeem a sponsor code. */
export function RedeemCodeForm() {
  const [state, action, pending] = useActionState(redeemCode, undefined);
  return (
    <form action={action} className="dash-col" style={{ gap: 10 }}>
      <Feedback state={state} />
      <div className="row org-code-form">
        <label className="sr-only" htmlFor="sponsor-code">Sponsor code</label>
        <input id="sponsor-code" name="code" className="input org-code-input" placeholder="XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={18} />
        <button className="btn btn-secondary" disabled={pending}>{pending ? <><Icon name="loader-circle" className="spin" />Redeeming…</> : <><Icon name="ticket" />Redeem</>}</button>
      </div>
    </form>
  );
}

/* ---------- Organization admins ---------- */

export function CreateOrgForm() {
  const [state, action, pending] = useActionState(createOrganization, undefined);
  return (
    <form action={action} className="dash-col" style={{ gap: 14 }}>
      <Feedback state={state} />
      <div className="form-grid">
        <div className="field"><label htmlFor="org-name">Organization name</label><input className="input" id="org-name" name="name" maxLength={80} placeholder="San Isidro Elementary School" /></div>
        <div className="field">
          <label htmlFor="org-kind">Kind</label>
          <select className="input" id="org-kind" name="kind" defaultValue="SCHOOL">
            <option value="SCHOOL">School</option>
            <option value="COMMUNITY">Community group (barangay, parish, NGO)</option>
            <option value="BUSINESS">Business</option>
          </select>
        </div>
      </div>
      <div><button className="btn btn-secondary" disabled={pending}>{pending ? "Creating…" : <><Icon name="plus" />Create organization</>}</button></div>
    </form>
  );
}

function CopyButton({ text, label = "Copy", done = "Copied." }: { text: string; label?: string; done?: string }) {
  const { toast } = useFlow();
  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); toast(done); } catch { toast("Select the text to copy it."); } }}>
      <Icon name="copy" />{label}
    </button>
  );
}

export function JoinCodeCard({ orgId, code }: { orgId: string; code: string }) {
  const [pending, run] = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="dash-col" style={{ gap: 12 }}>
      <div className="pairing-code org-join-code">{code}</div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <CopyButton text={code} done="Code copied." />
        {confirm ? (
          <>
            <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirm(false)}>Keep this code</button>
            <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => replaceJoinCode(orgId), { ok: "New code ready. The old one no longer works.", onOk: () => setConfirm(false) })}>
              {pending ? <><Icon name="loader-circle" className="spin" />Replacing…</> : "Replace it"}
            </button>
          </>
        ) : <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)}><Icon name="refresh-cw" />Replace code</button>}
      </div>
      {confirm ? <p className="t-meta">The current code stops working. Families who already joined stay.</p> : null}
    </div>
  );
}

/** From plans.ts, so the names and child limits stay in step with the pricing page */
const PLAN_NAMES = { PLUS: planById("PLUS").name, PRO: planById("PRO").name };
const planOption = (id: "PLUS" | "PRO") => `${PLAN_NAMES[id]} (up to ${planById(id).entitlements.childLimit} children)`;

/** Plan, months, quantity and a live total; pays through PayMongo's checkout. */
export function BuyCodesForm({ orgId, monthly, maxQuantity, methods }: {
  orgId: string;
  /** Monthly web price per plan, centavos */
  monthly: Record<"PLUS" | "PRO", number>;
  maxQuantity: number;
  methods: string;
}) {
  const [state, action, pending] = useActionState(buyCodes.bind(null, orgId), undefined);
  const [plan, setPlan] = useState<"PLUS" | "PRO">("PLUS");
  const [months, setMonths] = useState(3);
  // Kept as typed, so clearing the field leaves it empty instead of turning it into 0
  const [quantity, setQuantity] = useState("10");
  const q = Math.min(maxQuantity, Math.max(0, Math.floor(Number(quantity)) || 0));
  const each = monthly[plan] * months;
  return (
    <form action={action} className="dash-col" style={{ gap: 14 }}>
      <Feedback state={state} />
      <div className="form-grid org-buy-grid">
        <div className="field">
          <label htmlFor="b-plan">Plan</label>
          <select className="input" id="b-plan" name="plan" value={plan} onChange={(e) => setPlan(e.target.value as "PLUS" | "PRO")}>
            <option value="PLUS">{planOption("PLUS")}</option>
            <option value="PRO">{planOption("PRO")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="b-months">Each code gives</label>
          <select className="input" id="b-months" name="months" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} month{m === 1 ? "" : "s"}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="b-qty">Number of codes</label>
          <input className="input" id="b-qty" name="quantity" type="number" min={1} max={maxQuantity} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
      </div>
      <div className="org-total">
        <div>
          <div className="t-meta">{q} × {PLAN_NAMES[plan]}, {months} month{months === 1 ? "" : "s"} at {peso(each)} each</div>
          <div className="org-total-amount num">{peso(each * q)}</div>
        </div>
        <button className="btn btn-primary" disabled={pending || q < 1}>{pending ? <><Icon name="loader-circle" className="spin" />Opening checkout…</> : <>Continue to payment<Icon name="arrow-right" /></>}</button>
      </div>
      <p className="t-meta">Pay once with {methods}, through PayMongo. Codes appear here as soon as the payment is confirmed. Each code can be redeemed by one family within 12 months.</p>
    </form>
  );
}

type Code = { id: string; code: string; status: "AVAILABLE" | "REDEEMED" | "CANCELLED" | "EXPIRED"; when: string | null };
const STATUS: Record<Code["status"], [string, string]> = {
  AVAILABLE: ["Available", "tone-accent"], REDEEMED: ["Redeemed", "tone-ok"], CANCELLED: ["Cancelled", "tone-muted"], EXPIRED: ["Expired", "tone-muted"],
};

/** Rows shown per batch before "Show all": a batch can hold 200 codes, and an organization any number of batches. */
const CODES_SHOWN = 20;

export function CodesList({ orgId, codes }: { orgId: string; codes: Code[] }) {
  const [all, setAll] = useState(false);
  const available = codes.filter((c) => c.status === "AVAILABLE").map((c) => c.code);
  // Copy and the CSV always cover every code; only the table is shortened
  const shown = all ? codes : codes.slice(0, CODES_SHOWN);
  return (
    <div className="dash-col" style={{ gap: 10 }}>
      {available.length ? <div><CopyButton text={available.join("\n")} label={`Copy ${available.length} available code${available.length === 1 ? "" : "s"}`} done="Codes copied." /></div> : null}
      <div className="table-scroll">
        <table className="data-table org-codes">
          <thead><tr><th scope="col">Code</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{shown.map((c) => <CodeRow key={c.id} orgId={orgId} c={c} />)}</tbody>
        </table>
      </div>
      {codes.length > CODES_SHOWN ? (
        <div><button type="button" className="link-btn" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? `Show the first ${CODES_SHOWN}` : `Show all ${codes.length} codes`}
        </button></div>
      ) : null}
    </div>
  );
}

function CodeRow({ orgId, c }: { orgId: string; c: Code }) {
  const [pending, run] = useAction();
  const [confirm, setConfirm] = useState(false);
  const [label, tone] = STATUS[c.status];
  return (
    <tr>
      <td><span className="org-code">{c.code}</span></td>
      <td><span className={`pill ${tone}`}>{label}</span>{c.when ? <span className="t-meta"> {c.when}</span> : null}</td>
      <td>
        {c.status !== "AVAILABLE" ? null : confirm ? (
          <span className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirm(false)}>Keep</button>
            <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => cancelCode(orgId, c.id), { ok: "Code cancelled. It can't be redeemed now.", onOk: () => setConfirm(false) })}>
              {pending ? "Cancelling…" : "Cancel code"}
            </button>
          </span>
        ) : <button className="link-btn" onClick={() => setConfirm(true)}>Cancel</button>}
      </td>
    </tr>
  );
}

export function AddOrgAdminForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState(addOrgAdmin.bind(null, orgId), undefined);
  return (
    <form action={action} className="dash-col" style={{ gap: 10 }}>
      <Feedback state={state} />
      <div className="row org-code-form">
        <label className="sr-only" htmlFor="oa-email">Their eGuard email</label>
        <input className="input" id="oa-email" name="email" type="email" placeholder="Email they sign in to eGuard with" style={{ flex: 1, minWidth: 0 }} />
        <button className="btn btn-secondary" disabled={pending}>{pending ? "Adding…" : <><Icon name="user-plus" />Add admin</>}</button>
      </div>
    </form>
  );
}

/* ---------- API keys ---------- */

export type ApiKeyRow = { id: string; name: string; prefix: string; access: string; meta: string; paused: boolean };

/** The organization's API keys, and a form to create one (shown once, with how to call the API). */
export function ApiKeys({ orgId, keys, canCreate, atLimit, baseUrl, upgrade }: {
  orgId: string; keys: ApiKeyRow[]; canCreate: boolean; atLimit: boolean; baseUrl: string;
  /** Why this admin can't create keys, when they can't */
  upgrade: string;
}) {
  const [pending, run] = useAction();
  const [name, setName] = useState("");
  const [access, setAccess] = useState("READ");
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);

  if (created) {
    const example = `curl ${baseUrl}/organization \\\n  -H "Authorization: Bearer ${created.token}"`;
    return (
      <div className="org-confirm" role="status">
        <div><div className="t-title">Copy the key for {created.name} now</div><div className="t-meta">This is the only time it&apos;s shown. Store it in your system&apos;s secret settings, not in code or a spreadsheet. If it&apos;s lost, revoke it and create another.</div></div>
        <code className="org-api-key">{created.token}</code>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <CopyButton text={created.token} label="Copy key" done="Key copied." />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreated(null)}>I&apos;ve saved it</button>
        </div>
        <div className="t-meta">Try it:</div>
        <code className="org-api-key">{example}</code>
      </div>
    );
  }

  return (
    <div className="dash-col" style={{ gap: 12 }}>
      {keys.map((k) => <ApiKeyItem key={k.id} orgId={orgId} k={k} />)}
      {keys.length ? null : <p className="t-meta">No API keys yet.</p>}
      {!canCreate ? (
        <p className="t-meta">{upgrade}</p>
      ) : atLimit ? (
        <p className="t-meta">This organization has the most keys it can have. Revoke one you no longer use to create another.</p>
      ) : (
        <form className="dash-col" style={{ gap: 10 }} onSubmit={(e) => {
          e.preventDefault();
          run(() => createApiKey(orgId, { name, access }), { onOk: (r) => { setCreated(r as { name: string; token: string }); setName(""); } }); // onOk only runs without an error
        }}>
          <div className="form-grid">
            <div className="field"><label htmlFor="ak-name">What will use it</label><input className="input" id="ak-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Enrollment system" /></div>
            <div className="field">
              <label htmlFor="ak-access">Access</label>
              <select className="input" id="ak-access" value={access} onChange={(e) => setAccess(e.target.value)}>
                <option value="READ">Read only</option>
                <option value="WRITE">Read and cancel codes</option>
              </select>
            </div>
          </div>
          <div><button className="btn btn-secondary" disabled={pending}>{pending ? "Creating…" : <><Icon name="key-round" />Create API key</>}</button></div>
        </form>
      )}
    </div>
  );
}

function ApiKeyItem({ orgId, k }: { orgId: string; k: ApiKeyRow }) {
  const [pending, run] = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="setting-row">
      <span className="ico-tile"><Icon name="key-round" /></span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="t-title">{k.name} {k.paused ? <span className="pill tone-warn">Paused</span> : null}</div>
        <div className="t-meta"><span className="org-code">{k.prefix}…</span> · {k.access === "WRITE" ? "Read and cancel codes" : "Read only"} · {k.meta}</div>
      </div>
      {confirm ? (
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirm(false)}>Keep</button>
          <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => revokeApiKey(orgId, k.id), { ok: `${k.name} revoked. It stops working now.` })}>
            {pending ? "Revoking…" : "Revoke key"}
          </button>
        </div>
      ) : <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)}>Revoke</button>}
    </div>
  );
}

export function OrgAdminActions({ orgId, userId, name, you, isOwner, canManage }: {
  orgId: string; userId: string; name: string; you: boolean; isOwner: boolean; canManage: boolean;
}) {
  const [pending, run] = useAction();
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  if (!you && !canManage) return null;
  if (confirm) {
    return (
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirm(false)}>Cancel</button>
        <button className="btn btn-secondary btn-sm" disabled={pending}
          onClick={() => run(() => removeOrgAdmin(orgId, userId), {
            ok: you ? "You no longer manage this organization." : `${name} was removed.`,
            onOk: () => { if (you) router.push("/settings/organizations"); },
            onError: () => setConfirm(false),
          })}>
          {pending ? "Removing…" : you ? "Stop managing" : `Remove ${name}`}
        </button>
      </div>
    );
  }
  return (
    <div className="row" style={{ gap: 6 }}>
      {canManage && !isOwner ? (
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => makeOrgOwner(orgId, userId), { ok: `${name} is now an owner.` })}>Make owner</button>
      ) : null}
      <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)}>{you ? "Leave" : "Remove"}</button>
    </div>
  );
}
