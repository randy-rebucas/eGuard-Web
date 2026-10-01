/** A condition on the timestamp a list pages by: before a time, or exactly at one. */
export type TimeWhere = { lt?: Date; equals?: Date };

/**
 * Newest-first paging by a timestamp, `limit` at a time, continued with `before` = the previous page's `nextBefore`.
 * Rows sharing the boundary timestamp all go on the same page (it can run a little over `limit`): the next page
 * asks for rows strictly before that time, so a page ending between them would skip the rest.
 * `load` must return rows newest first, matching `where` on the timestamp. No database import, so it's testable alone.
 */
export async function pageByTime<R>(limit: number, load: (where: TimeWhere, take?: number) => Promise<R[]>, at: (r: R) => Date, before?: Date) {
  const rows = await load(before ? { lt: before } : {}, limit + 1);
  if (rows.length <= limit) return { rows, nextBefore: null };
  const edge = at(rows[limit - 1]);
  if (at(rows[limit]).getTime() !== edge.getTime()) return { rows: rows.slice(0, limit), nextBefore: edge };
  const tied = await load({ equals: edge });
  const page = [...rows.slice(0, limit).filter((r) => at(r).getTime() !== edge.getTime()), ...tied];
  const more = (await load({ lt: edge }, 1)).length > 0;
  return { rows: page, nextBefore: more ? edge : null };
}
