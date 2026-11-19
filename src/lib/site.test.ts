import { describe, expect, it } from "vitest";
import { TITLE_MAX, breadcrumbs, fullTitle, pageMetadata, siteUrl } from "./site";

describe("fullTitle", () => {
  it("adds the brand suffix when it fits", () => {
    expect(fullTitle("Pricing")).toBe("Pricing · eGuard");
  });

  it("drops the suffix rather than push a title past TITLE_MAX", () => {
    const fits = "x".repeat(TITLE_MAX - " · eGuard".length);
    expect(fullTitle(fits)).toBe(`${fits} · eGuard`);
    expect(fullTitle(`${fits}y`)).toBe(`${fits}y`);
  });
});

describe("pageMetadata", () => {
  it("uses the same title in search results and share tags", () => {
    const m = pageMetadata({ title: "Pricing", description: "d", path: "/pricing" });
    expect(m.title).toEqual({ absolute: "Pricing · eGuard" });
    expect(m.openGraph?.title).toBe("Pricing · eGuard");
  });

  it("leaves an absolute title alone", () => {
    const m = pageMetadata({ title: "eGuard: home", description: "d", path: "/", absoluteTitle: true });
    expect(m.title).toEqual({ absolute: "eGuard: home" });
  });
});

describe("breadcrumbs", () => {
  it("starts at Home and numbers each step", () => {
    const b = breadcrumbs(["Help Center", "/help"]);
    expect(b.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl() },
      { "@type": "ListItem", position: 2, name: "Help Center", item: `${siteUrl()}/help` },
    ]);
  });
});
