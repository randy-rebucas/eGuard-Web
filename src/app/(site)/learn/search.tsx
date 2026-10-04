"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export type SearchItem = { slug: string; title: string; description: string; topic: string };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Filters the article list in the browser; the full list is small enough to ship with the page. */
export function LearnSearch({ items }: { items: SearchItem[] }) {
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const words = norm(query).split(/\s+/).filter(Boolean);
  const hits = words.length
    ? items.filter((it) => { const hay = norm(`${it.title} ${it.description} ${it.topic}`); return words.every((w) => hay.includes(w)); }).slice(0, 12)
    : [];

  return (
    <div className="kc-search">
      <label className="kc-search-box">
        <Search aria-hidden />
        <span className="sr-only">Search articles</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 100 guides: TikTok, Roblox, bedtime, bullying…" autoComplete="off" />
      </label>
      {words.length ? (
        <div className="kc-hits" aria-live="polite">
          {hits.length ? (
            <ul>
              {hits.map((h) => (
                <li key={h.slug}><Link href={`/learn/${h.slug}`}><small>{h.topic}</small><b>{h.title}</b><span>{h.description}</span></Link></li>
              ))}
            </ul>
          ) : <p>No guides match “{query}”. Try a shorter word, like “TikTok” or “sleep”.</p>}
        </div>
      ) : null}
    </div>
  );
}
