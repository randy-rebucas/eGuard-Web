import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth-forms";
import { invitation } from "@/lib/invitations";
import { FormSuspense } from "../form-suspense";

export const metadata = { title: "Your invitation", robots: { index: false }, referrer: "no-referrer" };

/** Where an emailed invitation lands. Works signed in or out: the token alone identifies the invitation. */
export default function AcceptInvitePage(props: PageProps<"/accept-invite">) {
  return <FormSuspense><AcceptInvite searchParams={props.searchParams} /></FormSuspense>;
}

async function AcceptInvite({ searchParams }: Pick<PageProps<"/accept-invite">, "searchParams">) {
  const { token } = await searchParams;
  const t = typeof token === "string" ? token : "";
  const invite = t ? await invitation(t) : null;
  if (!invite || invite.expired) {
    return (
      <div className="auth-form">
        <div className="auth-head">
          <h1>{invite?.expired ? "This invitation has expired" : "This invitation doesn't work"}</h1>
          <p>{invite?.expired
            ? `Ask ${invite.invitedBy ?? "the family admin"} to send you a new one from Settings › Family.`
            : "It may have been used, declined or replaced by a newer one. Ask the family admin to send a new invitation."}</p>
        </div>
        <Link className="btn btn-primary auth-submit" href="/login">Go to sign in</Link>
      </div>
    );
  }
  return <AcceptInviteForm token={t} invite={invite} />;
}
