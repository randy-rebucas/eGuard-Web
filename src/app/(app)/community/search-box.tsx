import { Icon } from "@/components/icon";
import { LIMIT } from "@/lib/forum-shared";

/** A plain GET form to /community/search: works before any JavaScript loads */
export function SearchBox({ q }: { q?: string }) {
  return (
    <form action="/community/search" role="search" className="row" style={{ gap: 8 }}>
      <input className="input grow" type="search" name="q" defaultValue={q} placeholder="Search Community" aria-label="Search Community" minLength={2} maxLength={LIMIT.query} required />
      <button className="btn btn-secondary"><Icon name="search" />Search</button>
    </form>
  );
}
