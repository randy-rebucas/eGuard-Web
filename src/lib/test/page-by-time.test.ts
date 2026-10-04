import { describe, expect, it } from "vitest";

import { pageByTime } from "../paging";

type Row = { id: string; at: Date };
const t = (m: number) => new Date(Date.UTC(2026, 9, 1, 12, m));
// Newest first, with three rows sharing 12:03
const ROWS: Row[] = [["a", 5], ["b", 4], ["c", 3], ["d", 3], ["e", 3], ["f", 1], ["g", 0]].map(([id, m]) => ({ id: id as string, at: t(m as number) }));

/** Stands in for a findMany ordered newest first. */
const load = async (where: { lt?: Date; equals?: Date }, take?: number) => {
  const rows = ROWS.filter((r) => (where.lt ? r.at < where.lt : true) && (where.equals ? r.at.getTime() === where.equals.getTime() : true));
  return take ? rows.slice(0, take) : rows;
};

async function all(limit: number) {
  const seen: string[] = [];
  let before: Date | undefined;
  for (let i = 0; i < 10; i++) {
    const p = await pageByTime(limit, load, (r: Row) => r.at, before);
    seen.push(...p.rows.map((r) => r.id));
    if (!p.nextBefore) break;
    before = p.nextBefore;
  }
  return seen;
}

describe("pageByTime", () => {
  it("never skips rows that share the timestamp at a page boundary", async () => {
    for (const limit of [1, 2, 3, 4, 5, 6, 7, 8]) expect(await all(limit)).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });

  it("keeps tied rows together, so a page can run a little over the limit", async () => {
    const p = await pageByTime(3, load, (r: Row) => r.at);
    expect(p.rows.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(p.nextBefore).toEqual(t(3));
  });

  it("says there's no next page when the tie ends the list", async () => {
    const tail = async (where: { lt?: Date; equals?: Date }, take?: number) => (await load(where, take)).filter((r) => r.at >= t(3));
    const p = await pageByTime(3, tail, (r: Row) => r.at);
    expect(p.rows).toHaveLength(5);
    expect(p.nextBefore).toBeNull();
  });
});
