import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { PLAN_NAMES } from "@/lib/broadcasts";
import { AI_PROVIDER_LABEL, aiProvider } from "@/lib/broadcast-ai";
import { BroadcastEditor } from "../../../broadcast-forms";

export const metadata = { title: "New email" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const aiLabel = () => { const p = aiProvider(); return p ? AI_PROVIDER_LABEL[p] : null; };

export default async function NewBroadcastPage() {
  await requireStaff();
  return (
    <>
      <div>
        <p className="cn-eyebrow"><Link className="inline-link" href="/broadcasts">Email</Link></p>
        <h1 className="cn-h1">New email</h1>
      </div>
      <section className="card card-pad">
        <p className="cn-muted" style={{ marginBottom: 16 }}>It&apos;s saved as a draft first. Then you can preview it, send yourself a test, and send or schedule it.</p>
        <BroadcastEditor planNames={PLAN_NAMES} ai={aiLabel()} />
      </section>
    </>
  );
}
