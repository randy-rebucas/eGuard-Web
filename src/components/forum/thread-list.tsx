import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar } from "@/components/ui";
import { ago } from "@/lib/format";
import { handleHue, type Author, type ThreadListItem } from "@/lib/forum";

/** A member's handle on its colour; the eGuard team gets the shield; a deleted member a plain grey */
export function AuthorBadge({ by, tz, at, edited }: { by: Author; tz: string; at: Date; edited?: Date | null }) {
  return (
    <div className="row" style={{ gap: 10, minWidth: 0 }}>
      {by.kind === "staff"
        ? <span className="ico-tile" style={{ width: 32, height: 32 }}><Icon name="shield-check" /></span>
        : <Avatar name={by.kind === "deleted" ? "?" : by.name} hue={by.kind === "deleted" ? 220 : handleHue(by.name)} size="sm" />}
      <div style={{ minWidth: 0 }}>
        <div className="t-title row" style={{ gap: 6, fontSize: 14 }}>
          <span className={by.kind === "deleted" ? "t-meta" : undefined}>{by.name}</span>
          {by.kind === "staff" ? <span className="pill tone-accent">Team</span> : null}
          {by.mine ? <span className="pill tone-muted">You</span> : null}
        </div>
        <div className="t-meta">{ago(at, tz)}{edited ? " · edited" : ""}</div>
      </div>
    </div>
  );
}

/** Threads as rows: title, who started it, the topic (`showCategory`), replies and "Helpful" votes */
export function ThreadList({ threads, tz, showCategory, empty }: { threads: ThreadListItem[]; tz: string; showCategory?: boolean; empty?: React.ReactNode }) {
  if (!threads.length) return <>{empty ?? null}</>;
  return (
    <ul className="card card-pad dash-col forum-list" style={{ gap: 2, listStyle: "none" }}>
      {threads.map((t) => (
        <li key={t.id}>
          <Link href={`/community/t/${t.id}`} className="list-row">
            {t.by.kind === "staff"
              ? <span className="ico-tile" style={{ width: 32, height: 32 }}><Icon name="megaphone" /></span>
              : <Avatar name={t.by.kind === "deleted" ? "?" : t.by.name} hue={t.by.kind === "deleted" ? 220 : handleHue(t.by.name)} size="sm" />}
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="t-title forum-title">
                {t.pinned || t.locked ? (
                  // Inline beside the title: Tailwind's base styles make a bare svg a block, which put these on a line of their own
                  <span className="forum-flags">
                    {t.pinned ? <span title="Pinned"><Icon name="pin" size={14} /><span className="sr-only">Pinned: </span></span> : null}
                    {t.locked ? <span title="Closed to replies"><Icon name="lock" size={14} /><span className="sr-only">Closed: </span></span> : null}
                  </span>
                ) : null}
                {t.title}
              </div>
              <div className="t-meta">
                {t.by.name}{showCategory ? <> · {t.category.name}</> : null} · {ago(t.lastActivityAt, tz)}
              </div>
            </div>
            <span className="t-meta num row" style={{ gap: 12, flexShrink: 0 }}>
              <span className="row" style={{ gap: 4 }} aria-label={`${t.replyCount} ${t.replyCount === 1 ? "reply" : "replies"}`}><Icon name="message-circle" size={15} />{t.replyCount}</span>
              {t.score ? <span className="row" style={{ gap: 4 }} aria-label={`${t.score} found it helpful`}><Icon name="thumbs-up" size={15} />{t.score}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
