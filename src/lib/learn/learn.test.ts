import { describe, expect, it } from "vitest";
import { ARTICLES, TOPICS, articleBySlug, articlesIn, readMinutes, relatedTo } from "./index";
import { linksIn, parseInline, parseMarkdown } from "./markdown";

describe("knowledge center content", () => {
  it("has 100 articles with unique slugs and titles", () => {
    expect(ARTICLES).toHaveLength(100);
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length);
    expect(new Set(ARTICLES.map((a) => a.title)).size).toBe(ARTICLES.length);
  });

  it("uses URL-safe slugs and real dates", () => {
    for (const a of ARTICLES) {
      expect(a.slug, a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(a.reviewed, a.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(a.reviewed)), a.slug).toBe(false);
    }
  });

  it("keeps descriptions short enough for search results, and 3–4 takeaways", () => {
    for (const a of ARTICLES) {
      expect(a.description.length, a.slug).toBeLessThanOrEqual(170);
      expect(a.takeaways.length, a.slug).toBeGreaterThanOrEqual(3);
      expect(a.takeaways.length, a.slug).toBeLessThanOrEqual(4);
    }
  });

  it("puts every article in a known topic, and every topic's pillar in that topic", () => {
    const ids = new Set(TOPICS.map((t) => t.id));
    for (const a of ARTICLES) expect(ids.has(a.topic), a.slug).toBe(true);
    for (const t of TOPICS) {
      expect(articleBySlug(t.pillar)?.topic, t.id).toBe(t.id);
      expect(articlesIn(t.id)[0].slug).toBe(t.pillar);
      expect(articlesIn(t.id).length, t.id).toBeGreaterThanOrEqual(6);
    }
  });

  it("only links to pages that exist", () => {
    const topicIds = new Set<string>(TOPICS.map((t) => t.id));
    for (const a of ARTICLES) {
      for (const href of linksIn(a.body)) {
        if (href.startsWith("/learn/topics/")) expect(topicIds.has(href.slice(14)), `${a.slug} → ${href}`).toBe(true);
        else if (href.startsWith("/learn/")) expect(articleBySlug(href.slice(7)), `${a.slug} → ${href}`).not.toBeNull();
        else expect(href, a.slug).toMatch(/^(https:\/\/|\/[a-z])/);
      }
    }
  });

  it("links every article from at least one other article", () => {
    const linked = new Set(ARTICLES.flatMap((a) => linksIn(a.body).filter((h) => h !== `/learn/${a.slug}`)));
    const orphans = ARTICLES.filter((a) => !linked.has(`/learn/${a.slug}`) && TOPICS.every((t) => t.pillar !== a.slug)).map((a) => a.slug);
    expect(orphans).toEqual([]);
  });

  it("writes bodies the renderer understands", () => {
    for (const a of ARTICLES) {
      const lines = a.body.split("\n");
      // Nested lists and headings other than ## and ### aren't supported
      expect(lines.filter((l) => /^\s+(- |\d+\. )/.test(l)), a.slug).toEqual([]);
      expect(lines.filter((l) => /^(# |#### )/.test(l.trim())), a.slug).toEqual([]);
      const blocks = parseMarkdown(a.body);
      expect(blocks.filter((b) => b.type === "h2").length, a.slug).toBeGreaterThanOrEqual(3);
      for (const b of blocks) {
        const texts = "items" in b ? b.items : "rows" in b ? [...b.head, ...b.rows.flat()] : [b.text];
        for (const t of texts) {
          // An unmatched ** would show up as literal asterisks
          const leftover = parseInline(t).filter((x) => x.type === "text").map((x) => x.text).join("");
          expect(leftover.includes("**"), `${a.slug}: ${t}`).toBe(false);
        }
        if (b.type === "table") for (const r of b.rows) expect(r.length, a.slug).toBe(b.head.length);
      }
    }
  });

  it("suggests related reading from the same article set", () => {
    for (const a of ARTICLES) {
      const r = relatedTo(a);
      expect(r.length, a.slug).toBe(3);
      expect(r.some((x) => x.slug === a.slug)).toBe(false);
      expect(readMinutes(a)).toBeGreaterThan(1);
    }
  });
});

describe("markdown subset", () => {
  it("parses headings, lists, notes and tables", () => {
    const blocks = parseMarkdown("## Hello world\n\nA **bold** [link](/learn/x).\n\n- a\n- b\n\n1. one\n2. two\n\n> note\n\n| A | B |\n|---|---|\n| 1 | 2 |");
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "ol", "note", "table"]);
    expect(blocks[0]).toMatchObject({ id: "hello-world" });
    expect(parseInline("A **bold** [link](/learn/x).")).toEqual([
      { type: "text", text: "A " }, { type: "bold", text: "bold" }, { type: "text", text: " " },
      { type: "link", text: "link", href: "/learn/x" }, { type: "text", text: "." },
    ]);
  });

  it("gives repeated headings distinct ids", () => {
    const ids = parseMarkdown("## Tips\n\n## Tips").flatMap((b) => (b.type === "h2" ? [b.id] : []));
    expect(ids).toEqual(["tips", "tips-2"]);
  });
});
