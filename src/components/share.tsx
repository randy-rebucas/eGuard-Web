"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icon";
import { useFlow } from "./flow";
import { SHARE_CHANNELS, type ShareMessage } from "@/lib/share";

const never = () => () => {};
/** Whether the browser has its own share sheet (phones, Safari, Edge): false while rendering on the server. */
const useCanShare = () => useSyncExternalStore(never, () => typeof navigator.share === "function", () => false);
/** A touch screen, where links like viber:// and sms: open an app. Desktop browsers would show an error. */
const usePhone = () => useSyncExternalStore(never, () => matchMedia("(pointer: coarse)").matches, () => false);

/** Settings › Share eGuard. `qr`: an SVG of the site's address, made on the server. */
export function ShareEguard({ share, qr }: { share: ShareMessage; qr: string }) {
  const { toast } = useFlow();
  const canShare = useCanShare(), phone = usePhone();
  const copy = (text: string, done: string) =>
    navigator.clipboard.writeText(text).then(() => toast(done), () => toast("Couldn't copy. Select the text and copy it instead."));
  const shareSheet = async () => {
    try {
      await navigator.share({ title: share.title, text: share.text, url: share.url });
    } catch (e) {
      // Closing the share sheet isn't a failure
      if ((e as Error).name !== "AbortError") toast("Couldn't open sharing. Use one of the buttons below.");
    }
  };

  return (
    <div className="dash-col" style={{ gap: 18 }}>
      <p className="t-meta" style={{ marginTop: -6 }}>Know a parent who&apos;d find eGuard useful? Send them a link. It only points to eGuard&apos;s website and says nothing about your family or children.</p>

      <figure className="share-preview" style={{ margin: 0 }}>
        <figcaption className="t-meta" style={{ marginBottom: 6 }}>What they&apos;ll get</figcaption>
        <blockquote style={{ margin: 0, padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", overflowWrap: "anywhere" }}>
          {share.text} <span className="link-btn">{share.url}</span>
        </blockquote>
      </figure>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {canShare ? <button type="button" className="btn btn-primary" onClick={shareSheet}><Icon name="share" />Share…</button> : null}
        <button type="button" className={`btn ${canShare ? "btn-secondary" : "btn-primary"}`} onClick={() => copy(share.message, "Message and link copied.")}><Icon name="copy" />Copy message</button>
        <button type="button" className="btn btn-secondary" onClick={() => copy(share.url, "Link copied.")}><Icon name="link" />Copy link</button>
      </div>

      <div>
        <div className="t-title" style={{ marginBottom: 8 }}>Send it with</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {SHARE_CHANNELS.filter((c) => phone || !("phoneOnly" in c)).map((c) => (
            <a key={c.id} className="btn btn-secondary btn-sm" href={c.href(share)} target={c.href(share).startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{c.label}</a>
          ))}
        </div>
      </div>

      <div className="setting-row" style={{ alignItems: "center", gap: 16 }}>
        <div className="qr" role="img" aria-label={`QR code for ${share.url}`} style={{ width: 132, height: 132, flex: "none", background: "#fff", borderRadius: 12, padding: 6 }} dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="grow"><div className="t-title"><Icon name="qr-code" /> Show it in person</div><div className="t-meta">At a school meeting or with a friend: they point their phone&apos;s camera here to open eGuard&apos;s website.</div></div>
      </div>
    </div>
  );
}
