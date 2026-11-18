import "server-only";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { ServiceError, conflict, forbidden, invalid, isUniqueViolation, notFound } from "./errors";
import { LIMITS, enforce, hit } from "./rate-limit";
import { pageByTime } from "./paging";
import { escapeHtml, sendMail } from "./mail";
import { appUrl } from "./email-verification";
import { pushToUsers } from "./push";
import { isEnabled } from "./feature-flags";
import { LIMIT, REPORT_REASONS, type ReportReason } from "./forum-shared";

/**
 * Community (docs/features/community.md): parents helping parents. Signed-in parents only; children never see it.
 *
 * - Parents appear only by the handle they pick (ForumProfile). Their name, email and family are never shown, and
 *   staff in the console see the handle and the post, as other parents do.
 * - Posts go live at once. Parents report what breaks the rules; three open reports hide a post until staff look
 *   (console › Community), and staff can hide, delete, pin, lock and mute.
 * - Plain text only: React escapes it, and nothing is rendered as HTML or as a link.
 * - Posts that look like they name the parent's own child, or hold a phone number, email or address, are held back
 *   once with a warning (privacyHints); the parent can post anyway.
 * - Deleting an account empties what the parent wrote (eraseForUsers); deleted and hidden posts are erased after
 *   30 days (purgeForum).
 */

export const FORUM_FLAG = "community";

export const STATUSES = ["visible", "hidden", "deleted"] as const;
export type Status = (typeof STATUSES)[number];

export { COMMUNITY_RULES, LIMIT, REPORT_REASONS, REPORT_REASON_LABEL, type ReportReason } from "./forum-shared";

/** Open reports from different parents that hide a post until staff review it */
export const AUTO_HIDE_REPORTS = 3;
export const PAGE_SIZE = 20;
export const REPLIES_PAGE = 30;
/** Hidden and deleted posts are erased this long after (lib/maintenance); read notices after `notices` */
export const FORUM_RETENTION_DAYS = { removed: 30, notices: 90 } as const;

export const STAFF_NAME = "eGuard team";
export const DELETED_MEMBER = "Deleted member";

const DAY = 864e5;

/** Whether the parent's family has Community (the `community` feature flag) */
export const communityOn = (familyId: string) => isEnabled(FORUM_FLAG, familyId);

/* ---------- Pure helpers (tested in lib/test/forum.test.ts) ---------- */

const RESERVED = ["admin", "administrator", "moderator", "mod", "staff", "support", "official", "eguard", "team", "deleted"];

/** A handle as typed, and its unique key. Letters (any language), digits, `_` and `.`; nothing that identifies. */
export function normalizeHandle(raw: string) {
  const handle = raw.trim();
  if (handle.length < LIMIT.handleMin || handle.length > LIMIT.handle) throw invalid(`Use ${LIMIT.handleMin} to ${LIMIT.handle} characters.`);
  if (!/^[\p{L}\p{N}_.]+$/u.test(handle)) throw invalid("Use letters, numbers, _ and . only (no spaces).");
  if (/^[._]|[._]$/.test(handle)) throw invalid("Start and end with a letter or number.");
  if ((handle.match(/\p{N}/gu) ?? []).length >= 7) throw invalid("That looks like a phone number. Pick a name that doesn't identify you.");
  const handleKey = handle.toLowerCase();
  if (RESERVED.some((r) => handleKey === r || handleKey.includes("eguard"))) throw invalid("That name is reserved. Try another.");
  return { handle, handleKey };
}

/** Trims, normalizes line breaks, drops control characters and runs of blank lines. */
export function cleanText(s: string) {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const ThreadSchema = z.object({
  category: z.string().trim().min(1, "Choose a topic."),
  title: z.string().transform(cleanText).pipe(z.string()
    .min(LIMIT.titleMin, `Give it a title of at least ${LIMIT.titleMin} characters.`)
    .max(LIMIT.title, `Keep the title under ${LIMIT.title} characters.`)
    .refine((t) => !t.includes("\n"), "Keep the title on one line.")),
  body: z.string().transform(cleanText).pipe(z.string()
    .min(LIMIT.bodyMin, "Write a little more.")
    .max(LIMIT.body, `Keep it under ${LIMIT.body.toLocaleString("en")} characters.`)),
});
export const BodySchema = ThreadSchema.shape.body;
export const TitleSchema = ThreadSchema.shape.title;

const HANDLE_IN_TEXT = /(?:^|[^\p{L}\p{N}_.@])@([\p{L}\p{N}_.]{3,24})/gu;

/** The handle keys @mentioned in a post, at most 5 (a post can't page the whole forum). */
export function parseMentions(body: string) {
  const keys = new Set<string>();
  for (const m of body.matchAll(HANDLE_IN_TEXT)) {
    keys.add(m[1].replace(/[._]+$/, "").toLowerCase());
    if (keys.size >= 5) break;
  }
  return [...keys];
}

export type PrivacyHint = "child_name" | "phone" | "email" | "address";
export const PRIVACY_HINT_LABEL: Record<PrivacyHint, string> = {
  child_name: "your child's name",
  phone: "a phone number",
  email: "an email address",
  address: "an address",
};

/**
 * What in a post might identify a family: the parent's own children's first names, a phone number, an email or a
 * street address. A hint, not a filter: the parent is asked once and can post anyway.
 */
export function privacyHints(text: string, childNames: string[] = []): PrivacyHint[] {
  const hints: PrivacyHint[] = [];
  const firsts = childNames.map((n) => n.trim().split(/\s+/)[0]).filter((n) => n.length >= 2);
  const escaped = firsts.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length && new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join("|")})(?![\\p{L}\\p{N}])`, "iu").test(text)) hints.push("child_name");
  if (/(?:\+?\d[\s-]?){10,}/.test(text) || /\b09\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/.test(text)) hints.push("phone");
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) hints.push("email");
  if (/\b\d+\s+[\p{L}.]+\s+(street|st\.|avenue|ave\.|road|rd\.)|\b(barangay|brgy\.?|purok|sitio)\s+\S+/iu.test(text)) hints.push("address");
  return hints;
}

/** Thrown when a post needs the parent's OK first; `extra.hints` says what was found */
export const PRIVACY_CODE = "privacy_check";
function privacyError(hints: PrivacyHint[]) {
  const list = hints.map((h) => PRIVACY_HINT_LABEL[h]);
  const what = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0];
  return new ServiceError(422, `This looks like it includes ${what}. Other parents will see it. Edit it, or post anyway.`, PRIVACY_CODE, { hints });
}

type AuthorRow = { authorId: string | null; staffAuthorId: string | null; author?: { forumProfile: { handle: string } | null } | null };
export type Author = { name: string; kind: "member" | "staff" | "deleted"; mine: boolean };

/** How an author is shown: their handle, "eGuard team", or "Deleted member" */
export function authorOf(row: AuthorRow, viewerId?: string): Author {
  if (row.staffAuthorId) return { name: STAFF_NAME, kind: "staff", mine: false };
  const handle = row.author?.forumProfile?.handle;
  if (!row.authorId || !handle) return { name: DELETED_MEMBER, kind: "deleted", mine: false };
  return { name: handle, kind: "member", mine: row.authorId === viewerId };
}

/** 0–359: an avatar colour from a handle, so it's the same everywhere and says nothing about the person */
export function handleHue(handle: string) {
  let h = 0;
  for (const c of handle.toLowerCase()) h = (h * 31 + c.codePointAt(0)!) % 360;
  return h;
}

/* ---------- Who may do what ---------- */

export type Viewer = { id: string; familyId: string; emailVerified: boolean };
type Profile = { userId: string; handle: string; mutedUntil: Date | null; notifyReplies: boolean };

export const getProfile = (userId: string) =>
  db.forumProfile.findUnique({ where: { userId }, select: { userId: true, handle: true, mutedUntil: true, notifyReplies: true } });

/** Why a parent can't take part yet, or null: posting, replying, voting and reporting all need this */
export function participationBlock(v: Pick<Viewer, "emailVerified">, profile: Pick<Profile, "mutedUntil"> | null, now = new Date()) {
  if (!v.emailVerified) return forbidden("Verify your email to take part in Community.");
  if (!profile) return new ServiceError(409, "Choose a community name first.", "no_profile");
  if (profile.mutedUntil && profile.mutedUntil > now) {
    return forbidden(`A moderator paused your posting until ${profile.mutedUntil.toLocaleDateString("en", { month: "long", day: "numeric" })}. You can still read.`);
  }
  return null;
}

async function participant(v: Viewer, now = new Date()) {
  if (!(await communityOn(v.familyId))) throw notFound("Community");
  const profile = await getProfile(v.id);
  const block = participationBlock(v, profile, now);
  if (block) throw block;
  return profile!;
}

/** Throws unless the family has Community (pages call notFound() themselves) */
async function reader(v: Viewer) {
  if (!(await communityOn(v.familyId))) throw notFound("Community");
}

/* ---------- Profile ---------- */

/** Picks or changes the parent's handle; the first time, they accept the community rules too */
export async function setHandle(v: Viewer, raw: string, acceptRules: boolean, now = new Date()) {
  await reader(v);
  if (!v.emailVerified) throw forbidden("Verify your email to take part in Community.");
  const { handle, handleKey } = normalizeHandle(raw);
  const existing = await getProfile(v.id);
  if (!existing && !acceptRules) throw invalid("Read and accept the community rules to continue.");
  if (existing?.handle === handle) return existing;
  await enforce(`forum-handle:${v.id}`, LIMITS.forumHandle, "You've changed your name a few times today. Try again tomorrow.");
  try {
    return await db.forumProfile.upsert({
      where: { userId: v.id },
      create: { userId: v.id, handle, handleKey, acceptedRulesAt: now },
      update: { handle, handleKey },
      select: { userId: true, handle: true, mutedUntil: true, notifyReplies: true },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("Someone already uses that name. Try another.");
    throw e;
  }
}

export async function setNotifyReplies(userId: string, on: boolean) {
  await db.forumProfile.updateMany({ where: { userId }, data: { notifyReplies: on } });
}

/* ---------- Reading ---------- */

const authorSelect = { authorId: true, staffAuthorId: true, author: { select: { forumProfile: { select: { handle: true } } } } } as const;

const threadListSelect = {
  id: true, title: true, status: true, pinned: true, locked: true, replyCount: true, score: true, lastActivityAt: true, createdAt: true,
  category: { select: { slug: true, name: true } },
  ...authorSelect,
} satisfies Prisma.ForumThreadSelect;

type ThreadListRow = Prisma.ForumThreadGetPayload<{ select: typeof threadListSelect }>;
const toListItem = (t: ThreadListRow, viewerId: string) => ({
  id: t.id, title: t.title, status: t.status, pinned: t.pinned, locked: t.locked, replyCount: t.replyCount, score: t.score,
  lastActivityAt: t.lastActivityAt, createdAt: t.createdAt, category: t.category, by: authorOf(t, viewerId),
});
export type ThreadListItem = ReturnType<typeof toListItem>;

export async function listCategories(v: Viewer) {
  await reader(v);
  const [cats, counts] = await Promise.all([
    db.forumCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    db.forumThread.groupBy({ by: ["categoryId"], where: { status: "visible" }, _count: { _all: true }, _max: { lastActivityAt: true } }),
  ]);
  const by = new Map(counts.map((c) => [c.categoryId, c]));
  return cats.map((c) => ({ ...c, threads: by.get(c.id)?._count._all ?? 0, lastActivityAt: by.get(c.id)?._max.lastActivityAt ?? null }));
}

export async function getCategory(v: Viewer, slug: string) {
  await reader(v);
  const c = await db.forumCategory.findUnique({ where: { slug } });
  if (!c) throw notFound("Topic");
  return c;
}

/**
 * Threads newest activity first, `before` the previous page's `nextBefore`. Pinned threads lead the first page.
 * Without `categoryId`: every topic (Community's "Latest").
 */
export async function listThreads(v: Viewer, { categoryId, before }: { categoryId?: string; before?: Date } = {}) {
  await reader(v);
  const base = { status: "visible", ...(categoryId ? { categoryId } : {}) } satisfies Prisma.ForumThreadWhereInput;
  const [pinned, page] = await Promise.all([
    before || !categoryId ? [] : db.forumThread.findMany({ where: { ...base, pinned: true }, select: threadListSelect, orderBy: { lastActivityAt: "desc" }, take: 5 }),
    pageByTime(PAGE_SIZE,
      (at, take) => db.forumThread.findMany({
        where: { ...base, ...(categoryId ? { pinned: false } : {}), lastActivityAt: at }, select: threadListSelect, orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }], take,
      }),
      (t) => t.lastActivityAt, before),
  ]);
  return { pinned: pinned.map((t) => toListItem(t, v.id)), threads: page.rows.map((t) => toListItem(t, v.id)), nextBefore: page.nextBefore };
}

/** Threads the parent started, any status but deleted (so they see what a moderator hid) */
export async function myThreads(v: Viewer) {
  await reader(v);
  const rows = await db.forumThread.findMany({ where: { authorId: v.id, status: { not: "deleted" } }, select: threadListSelect, orderBy: { lastActivityAt: "desc" }, take: 50 });
  return rows.map((t) => toListItem(t, v.id));
}

const REMOVED_TEXT: Record<Exclude<Status, "visible">, string> = {
  hidden: "This was hidden by a moderator.",
  deleted: "This was deleted by its author.",
};

/**
 * One thread and a page of its replies (oldest first). Hidden posts show their text only to their author; deleted
 * ones are a placeholder. A thread that's hidden or deleted is not found, except by its author (hidden) or where
 * it still has replies worth reading (deleted).
 */
export async function getThread(v: Viewer, id: string, page = 1) {
  await reader(v);
  const t = await db.forumThread.findUnique({
    where: { id },
    select: {
      id: true, title: true, body: true, status: true, pinned: true, locked: true, replyCount: true, score: true, editedAt: true, createdAt: true,
      category: { select: { slug: true, name: true, staffOnly: true } },
      ...authorSelect,
    },
  });
  if (!t) throw notFound("Thread");
  const mine = t.authorId === v.id;
  if (t.status === "hidden" && !mine) throw notFound("Thread");
  const pages = Math.max(1, Math.ceil(t.replyCount / REPLIES_PAGE));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages + 1);
  const [posts, votes, sub, profile] = await Promise.all([
    db.forumPost.findMany({
      where: { threadId: id, OR: [{ status: "visible" }, { status: "deleted" }, { status: "hidden", authorId: v.id }] },
      select: { id: true, body: true, status: true, score: true, editedAt: true, createdAt: true, ...authorSelect },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (p - 1) * REPLIES_PAGE,
      take: REPLIES_PAGE,
    }),
    db.forumVote.findMany({ where: { userId: v.id, OR: [{ threadId: id }, { post: { threadId: id } }] }, select: { threadId: true, postId: true } }),
    db.forumSubscription.findUnique({ where: { userId_threadId: { userId: v.id, threadId: id } }, select: { active: true } }),
    getProfile(v.id),
  ]);
  if (t.status === "deleted" && !posts.length && p === 1) throw notFound("Thread");
  const voted = new Set(votes.map((x) => x.threadId ?? x.postId));
  const shown = (row: { status: string; body: string; authorId: string | null }) =>
    row.status === "visible" || (row.status === "hidden" && row.authorId === v.id) ? row.body : REMOVED_TEXT[row.status as Exclude<Status, "visible">];
  return {
    thread: {
      id: t.id, status: t.status, pinned: t.pinned, locked: t.locked, replyCount: t.replyCount, score: t.score, editedAt: t.editedAt, createdAt: t.createdAt, category: t.category,
      body: shown(t), title: t.status === "deleted" ? "[deleted]" : t.title, by: authorOf(t, v.id), voted: voted.has(t.id),
    },
    posts: posts.map((r) => ({
      id: r.id, status: r.status, score: r.score, editedAt: r.editedAt, createdAt: r.createdAt, body: shown(r), by: authorOf(r, v.id), voted: voted.has(r.id),
    })),
    page: p,
    pages,
    following: !!sub?.active,
    profile,
  };
}

/** Full-text search over visible threads and their replies, best match first */
export async function searchThreads(v: Viewer, raw: string, page = 1) {
  await reader(v);
  const q = raw.trim().slice(0, LIMIT.query);
  if (q.length < 2) return { threads: [] as ThreadListItem[], more: false };
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const offset = (Math.max(1, Math.floor(page) || 1) - 1) * PAGE_SIZE;
  // 'simple': no stemming, so Filipino and English both match as typed. Unindexed for now (a few thousand
  // threads scan quickly); add a GIN index on the expression when it grows.
  const ids = await db.$queryRaw<{ id: string }[]>`
    WITH q AS (SELECT websearch_to_tsquery('simple', ${q}) AS query)
    SELECT t.id FROM "ForumThread" t, q
    WHERE t.status = 'visible' AND (
      to_tsvector('simple', t.title || ' ' || t.body) @@ q.query
      OR t.title ILIKE ${like}
      OR EXISTS (SELECT 1 FROM "ForumPost" p WHERE p."threadId" = t.id AND p.status = 'visible' AND to_tsvector('simple', p.body) @@ q.query)
    )
    ORDER BY ts_rank(to_tsvector('simple', t.title || ' ' || t.body), q.query) DESC, t."lastActivityAt" DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}`;
  const want = ids.slice(0, PAGE_SIZE).map((r) => r.id);
  const rows = await db.forumThread.findMany({ where: { id: { in: want } }, select: threadListSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return { threads: want.flatMap((id) => (byId.has(id) ? [toListItem(byId.get(id)!, v.id)] : [])), more: ids.length > PAGE_SIZE };
}

/* ---------- Writing ---------- */

async function childNames(familyId: string) {
  return (await db.child.findMany({ where: { familyId }, select: { name: true } })).map((c) => c.name);
}

async function checkPrivacy(v: Viewer, text: string, acknowledged: boolean) {
  if (acknowledged) return;
  const hints = privacyHints(text, await childNames(v.familyId));
  if (hints.length) throw privacyError(hints);
}

export async function createThread(v: Viewer, input: z.input<typeof ThreadSchema>, { acknowledged = false } = {}, now = new Date()) {
  const profile = await participant(v, now);
  const t = ThreadSchema.parse(input);
  const category = await db.forumCategory.findUnique({ where: { slug: t.category } });
  if (!category) throw invalid("Choose a topic.");
  if (category.staffOnly) throw forbidden("Only the eGuard team posts in Announcements.");
  await checkPrivacy(v, `${t.title}\n${t.body}`, acknowledged);
  await enforce(`forum-thread:${v.id}`, LIMITS.forumThread, "You've started a lot of threads this hour. Try again a little later.");
  const thread = await db.forumThread.create({
    data: {
      categoryId: category.id, authorId: v.id, title: t.title, body: t.body, lastActivityAt: now, createdAt: now,
      subscriptions: { create: { userId: v.id } },
    },
    select: { id: true },
  });
  after(() => notifyMentions(thread.id, null, v.id, profile.handle, t.body).catch((e) => console.error("[forum] mention notices failed", thread.id, e)));
  return thread;
}

export async function reply(v: Viewer, threadId: string, rawBody: string, { acknowledged = false } = {}, now = new Date()) {
  const profile = await participant(v, now);
  const body = BodySchema.parse(rawBody);
  const t = await db.forumThread.findUnique({ where: { id: threadId }, select: { status: true, locked: true } });
  if (!t || t.status !== "visible") throw notFound("Thread");
  if (t.locked) throw forbidden("This thread is closed to new replies.");
  await checkPrivacy(v, body, acknowledged);
  await enforce(`forum-post:${v.id}`, LIMITS.forumPost, "You've replied a lot this hour. Try again a little later.");
  const post = await db.$transaction(async (tx) => {
    const post = await tx.forumPost.create({ data: { threadId, authorId: v.id, body, createdAt: now }, select: { id: true } });
    await tx.forumThread.update({ where: { id: threadId }, data: { replyCount: { increment: 1 }, lastActivityAt: now } });
    await tx.forumSubscription.upsert({ where: { userId_threadId: { userId: v.id, threadId } }, create: { userId: v.id, threadId }, update: { active: true } });
    return post;
  });
  after(() => notifyReply(threadId, post.id, v.id, profile.handle, body).catch((e) => console.error("[forum] reply notices failed", post.id, e)));
  return post;
}

export type Target = { threadId: string; postId?: undefined } | { postId: string; threadId?: undefined };

/** The parent's own thread or reply, as long as it isn't deleted */
async function ownTarget(v: Viewer, target: Target) {
  const row = target.postId
    ? await db.forumPost.findUnique({ where: { id: target.postId }, select: { authorId: true, status: true, threadId: true } })
    : await db.forumThread.findUnique({ where: { id: target.threadId }, select: { authorId: true, status: true, id: true } });
  if (!row || row.authorId !== v.id || row.status === "deleted") throw notFound(target.postId ? "Reply" : "Thread");
  return { status: row.status as Status, threadId: "threadId" in row ? row.threadId : row.id };
}

/** Edits the parent's own visible post. A thread's title can change too. */
export async function editOwn(v: Viewer, target: Target, input: { title?: string; body: string }, { acknowledged = false } = {}, now = new Date()) {
  await participant(v, now);
  const own = await ownTarget(v, target);
  if (own.status !== "visible") throw forbidden("A moderator hid this, so it can't be edited. You can delete it.");
  const body = BodySchema.parse(input.body);
  const title = target.threadId && input.title !== undefined ? TitleSchema.parse(input.title) : undefined;
  await checkPrivacy(v, `${title ?? ""}\n${body}`, acknowledged);
  await enforce(`forum-post:${v.id}`, LIMITS.forumPost, "You've posted a lot this hour. Try again a little later.");
  if (target.postId) await db.forumPost.update({ where: { id: target.postId }, data: { body, editedAt: now } });
  else await db.forumThread.update({ where: { id: target.threadId }, data: { body, ...(title ? { title } : {}), editedAt: now } });
  return { threadId: own.threadId };
}

/** Deletes the parent's own post: its text is erased at once; a placeholder keeps the conversation readable */
export async function deleteOwn(v: Viewer, target: Target, now = new Date()) {
  if (!(await communityOn(v.familyId))) throw notFound("Community");
  const own = await ownTarget(v, target);
  await db.$transaction(async (tx) => {
    if (target.postId) {
      await tx.forumPost.update({ where: { id: target.postId }, data: { status: "deleted", statusAt: now, body: "" } });
      if (own.status === "visible") await tx.forumThread.update({ where: { id: own.threadId }, data: { replyCount: { decrement: 1 } } });
    } else {
      await tx.forumThread.update({ where: { id: target.threadId }, data: { status: "deleted", statusAt: now, title: "", body: "" } });
    }
    await tx.forumReport.updateMany({ where: { ...targetWhere(target), status: "open" }, data: { status: "dismissed", resolvedAt: now } });
  });
  return { threadId: own.threadId };
}

const targetWhere = (t: Target) => (t.postId ? { postId: t.postId } : { threadId: t.threadId });

/** "Helpful": on, or off again. Not on one's own posts. */
export async function toggleVote(v: Viewer, target: Target, now = new Date()) {
  await participant(v, now);
  const row = target.postId
    ? await db.forumPost.findUnique({ where: { id: target.postId }, select: { authorId: true, status: true } })
    : await db.forumThread.findUnique({ where: { id: target.threadId }, select: { authorId: true, status: true } });
  if (!row || row.status !== "visible") throw notFound(target.postId ? "Reply" : "Thread");
  if (row.authorId === v.id) throw forbidden("You can't mark your own post as helpful.");
  await enforce(`forum-vote:${v.id}`, LIMITS.forumVote, "Slow down a little and try again shortly.");
  const where = { userId: v.id, ...targetWhere(target) };
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.forumVote.findFirst({ where, select: { id: true } });
      const delta = existing ? -1 : 1;
      if (existing) await tx.forumVote.delete({ where: { id: existing.id } });
      else await tx.forumVote.create({ data: { ...where, createdAt: now } });
      const updated = target.postId
        ? await tx.forumPost.update({ where: { id: target.postId }, data: { score: { increment: delta } }, select: { score: true } })
        : await tx.forumThread.update({ where: { id: target.threadId }, data: { score: { increment: delta } }, select: { score: true } });
      return { voted: !existing, score: updated.score };
    });
  } catch (e) {
    // A double click raced past findFirst: the vote is in, which is what they asked for
    if (isUniqueViolation(e)) return { voted: true, score: null };
    throw e;
  }
}

export const ReportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { error: "Choose a reason." }),
  note: z.string().trim().max(LIMIT.note, `Keep the note under ${LIMIT.note} characters.`).optional(),
});

/**
 * A parent reports a post. AUTO_HIDE_REPORTS open reports from different parents hide it until staff review it,
 * so something harmful doesn't wait for office hours.
 */
export async function report(v: Viewer, target: Target, input: z.input<typeof ReportSchema>, now = new Date()) {
  if (!(await communityOn(v.familyId))) throw notFound("Community");
  if (!v.emailVerified) throw forbidden("Verify your email to take part in Community.");
  const r = ReportSchema.parse(input);
  const row = target.postId
    ? await db.forumPost.findUnique({ where: { id: target.postId }, select: { authorId: true, status: true, threadId: true } })
    : await db.forumThread.findUnique({ where: { id: target.threadId }, select: { authorId: true, status: true, id: true } });
  if (!row || row.status !== "visible") throw notFound(target.postId ? "Reply" : "Thread");
  if (row.authorId === v.id) throw invalid("That's your own post. You can edit or delete it instead.");
  await enforce(`forum-report:${v.id}`, LIMITS.forumReport, "You've sent a lot of reports today. Our team is looking at them.");
  try {
    await db.forumReport.create({ data: { reporterId: v.id, ...targetWhere(target), reason: r.reason, note: cleanText(r.note ?? "") || null, createdAt: now } });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("You've already reported this. Our team will look at it.");
    throw e;
  }
  const open = await db.forumReport.count({ where: { ...targetWhere(target), status: "open" } });
  if (open < AUTO_HIDE_REPORTS) return { hidden: false };
  const threadId = "threadId" in row ? row.threadId : row.id;
  await setStatus(target, threadId, "hidden", now);
  return { hidden: true };
}

/** Changes a post's status, keeping the thread's reply count to visible replies */
async function setStatus(target: Target, threadId: string, status: Status, now: Date, tx: Prisma.TransactionClient | typeof db = db) {
  if (target.postId) {
    const was = (await tx.forumPost.findUnique({ where: { id: target.postId }, select: { status: true } }))?.status;
    if (!was || was === status) return false;
    await tx.forumPost.update({ where: { id: target.postId }, data: { status, statusAt: now, ...(status === "deleted" ? { body: "" } : {}) } });
    const delta = (status === "visible" ? 1 : 0) - (was === "visible" ? 1 : 0);
    if (delta) await tx.forumThread.update({ where: { id: threadId }, data: { replyCount: { increment: delta } } });
    return true;
  }
  const r = await tx.forumThread.updateMany({
    where: { id: target.threadId, status: { not: status } },
    data: { status, statusAt: now, ...(status === "deleted" ? { title: "", body: "" } : {}) },
  });
  return r.count > 0;
}

/* ---------- Following and notices ---------- */

export async function setFollow(v: Viewer, threadId: string, follow: boolean) {
  await reader(v);
  const t = await db.forumThread.findUnique({ where: { id: threadId }, select: { status: true } });
  if (!t || t.status !== "visible") throw notFound("Thread");
  await db.forumSubscription.upsert({ where: { userId_threadId: { userId: v.id, threadId } }, create: { userId: v.id, threadId, active: follow }, update: { active: follow } });
  return { following: follow };
}

export const unreadNotices = (userId: string) => db.forumNotification.count({ where: { userId, readAt: null } });

export async function listNotices(v: Viewer, before?: Date) {
  await reader(v);
  const page = await pageByTime(PAGE_SIZE,
    (at, take) => db.forumNotification.findMany({
      where: { userId: v.id, createdAt: at },
      select: { id: true, kind: true, actor: true, readAt: true, createdAt: true, postId: true, thread: { select: { id: true, title: true, status: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    }),
    (n) => n.createdAt, before);
  return { notices: page.rows, nextBefore: page.nextBefore };
}

/** Marks some (or, with none given, all) of the parent's notices read */
export async function markNoticesRead(userId: string, ids?: string[], now = new Date()) {
  await db.forumNotification.updateMany({ where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: now } });
}

/** Opening a thread reads its notices */
export async function readThreadNotices(userId: string, threadId: string, now = new Date()) {
  await db.forumNotification.updateMany({ where: { userId, threadId, readAt: null }, data: { readAt: now } });
}

const NOTICE_TEXT: Record<string, (actor: string, title: string) => string> = {
  reply: (a, t) => `${a} replied to “${t}”`,
  mention: (a, t) => `${a} mentioned you in “${t}”`,
  moderation: (_a, t) => `A moderator removed your post in “${t}”`,
};
export const noticeText = (kind: string, actor: string | null, title: string) => (NOTICE_TEXT[kind] ?? NOTICE_TEXT.reply)(actor ?? "Someone", title || "[deleted]");

export const threadLink = (threadId: string, postId?: string | null) => `/community/t/${threadId}${postId ? `#p-${postId}` : ""}`;

/** Who a new post should notify: followers, and parents @mentioned. Never the person who wrote it. */
export function recipients(actorId: string, followers: string[], mentioned: string[]) {
  const mention = new Set(mentioned.filter((id) => id !== actorId));
  const reply = new Set(followers.filter((id) => id !== actorId && !mention.has(id)));
  return { reply: [...reply], mention: [...mention] };
}

async function notifyMentions(threadId: string, postId: string | null, actorId: string, actor: string, body: string) {
  await deliver(threadId, postId, actorId, actor, [], body);
}

async function notifyReply(threadId: string, postId: string, actorId: string, actor: string, body: string) {
  const subs = await db.forumSubscription.findMany({ where: { threadId, active: true }, select: { userId: true } });
  await deliver(threadId, postId, actorId, actor, subs.map((s) => s.userId), body);
}

/** In-app notices, then email and push for those who want them. A failure here never fails the post. */
async function deliver(threadId: string, postId: string | null, actorId: string, actor: string, followers: string[], body: string) {
  const keys = parseMentions(body);
  const mentioned = keys.length ? (await db.forumProfile.findMany({ where: { handleKey: { in: keys } }, select: { userId: true } })).map((p) => p.userId) : [];
  const to = recipients(actorId, followers, mentioned);
  const all = [...to.reply.map((userId) => ({ userId, kind: "reply" })), ...to.mention.map((userId) => ({ userId, kind: "mention" }))];
  if (!all.length) return;
  await db.forumNotification.createMany({ data: all.map((n) => ({ ...n, threadId, postId, actor })) });

  const thread = await db.forumThread.findUnique({ where: { id: threadId }, select: { title: true } });
  const title = thread?.title ?? "";
  const users = await db.user.findMany({
    where: { id: { in: all.map((n) => n.userId) } },
    select: { id: true, email: true, emailVerifiedAt: true, notifyEmail: true, notifyPush: true, forumProfile: { select: { notifyReplies: true } } },
  });
  const kindOf = new Map(all.map((n) => [n.userId, n.kind]));
  const link = `${appUrl()}${threadLink(threadId, postId)}`;
  await Promise.allSettled(users.map(async (u) => {
    if (!u.emailVerifiedAt || !u.notifyEmail || !u.forumProfile?.notifyReplies) return;
    // At most one email per thread per hour: a busy thread mustn't flood an inbox (the in-app notices still list each)
    if ((await hit(`forum-mail:${u.id}:${threadId}`, LIMITS.forumMail)).limited) return;
    const line = noticeText(kindOf.get(u.id)!, actor, title);
    await sendMail({
      to: u.email,
      subject: line.length > 90 ? `${line.slice(0, 87)}…` : line,
      text: `${line}.\n\nRead it: ${link}\n\nYou get these emails because you follow this thread in eGuard Community. Turn them off in Settings › Notifications.\n\n— eGuard`,
      html: `<p>${escapeHtml(line)}.</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">Read it</a></p>`
        + `<p style="color:#555;font-size:13px">You get these emails because you follow this thread in eGuard Community. Turn them off in Settings › Notifications.</p>`,
    });
  })).then((rs) => rs.forEach((r) => r.status === "rejected" && console.error("[forum] email failed", r.reason)));
  const push = users.filter((u) => u.notifyPush).map((u) => u.id);
  if (push.length) {
    await pushToUsers(push, { title: "eGuard Community", body: `${actor} replied in “${title.slice(0, 60)}”`, data: { type: "community", threadId, ...(postId ? { postId } : {}) } })
      .catch((e) => console.error("[forum] push failed", e));
  }
}

/* ---------- Staff (console › Community) ---------- */

/** Open reports, grouped by the post they're about, oldest first */
export async function listReports() {
  const reports = await db.forumReport.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      id: true, reason: true, note: true, createdAt: true, threadId: true, postId: true,
      thread: { select: { id: true, title: true, body: true, status: true, ...authorSelect } },
      post: { select: { id: true, body: true, status: true, threadId: true, thread: { select: { title: true } }, ...authorSelect } },
    },
  });
  const groups = new Map<string, {
    key: string; target: Target; threadId: string; threadTitle: string; body: string; status: string; author: Author; authorId: string | null;
    reasons: { reason: ReportReason; note: string | null; at: Date }[];
  }>();
  for (const r of reports) {
    const src = r.post ?? r.thread;
    if (!src) continue;
    const key = r.postId ? `post:${r.postId}` : `thread:${r.threadId}`;
    const g = groups.get(key) ?? {
      key,
      target: r.postId ? { postId: r.postId } : { threadId: r.threadId! },
      threadId: r.post?.threadId ?? r.thread!.id,
      threadTitle: r.post?.thread.title ?? r.thread!.title,
      body: src.body,
      status: src.status,
      author: authorOf(src),
      authorId: src.authorId,
      reasons: [],
    };
    g.reasons.push({ reason: r.reason as ReportReason, note: r.note, at: r.createdAt });
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Console › Community's tiles */
export async function communityStats(now = new Date()) {
  const since = new Date(now.getTime() - 7 * DAY);
  const [threads7, posts7, members, muted] = await Promise.all([
    db.forumThread.count({ where: { createdAt: { gte: since } } }),
    db.forumPost.count({ where: { createdAt: { gte: since } } }),
    db.forumProfile.count(),
    db.forumProfile.count({ where: { mutedUntil: { gt: now } } }),
  ]);
  return { threads7, posts7, members, muted };
}

/** The latest threads and replies, whatever their status, for staff to look over */
export async function listRecent(take = 40) {
  const [threads, posts] = await Promise.all([
    db.forumThread.findMany({ orderBy: { createdAt: "desc" }, take, select: { id: true, title: true, body: true, status: true, pinned: true, locked: true, createdAt: true, category: { select: { name: true } }, ...authorSelect } }),
    db.forumPost.findMany({ orderBy: { createdAt: "desc" }, take, select: { id: true, threadId: true, body: true, status: true, createdAt: true, thread: { select: { title: true } }, ...authorSelect } }),
  ]);
  return {
    threads: threads.map((t) => ({ ...t, by: authorOf(t) })),
    posts: posts.map((p) => ({ ...p, by: authorOf(p) })),
  };
}

export const MOD_OPS = ["hide", "unhide", "delete", "dismiss", "pin", "unpin", "lock", "unlock"] as const;
export type ModOp = (typeof MOD_OPS)[number];

/**
 * A staff decision on a post. Hiding or deleting resolves its open reports as actioned and tells the author;
 * dismissing (or unhiding) resolves them as dismissed. Returns the post's author, for the audit log.
 */
export async function moderate(staffId: string, target: Target, op: ModOp, now = new Date()) {
  const row = target.postId
    ? await db.forumPost.findUnique({ where: { id: target.postId }, select: { threadId: true, authorId: true } })
    : await db.forumThread.findUnique({ where: { id: target.threadId }, select: { id: true, authorId: true } });
  if (!row) throw notFound(target.postId ? "Reply" : "Thread");
  const threadId = "threadId" in row ? row.threadId : row.id;
  if (target.postId && ["pin", "unpin", "lock", "unlock"].includes(op)) throw invalid("Only threads can be pinned or locked.");
  const changed = await db.$transaction(async (tx) => {
    switch (op) {
      case "pin": case "unpin":
        await tx.forumThread.update({ where: { id: threadId }, data: { pinned: op === "pin" } });
        return true;
      case "lock": case "unlock":
        await tx.forumThread.update({ where: { id: threadId }, data: { locked: op === "lock" } });
        return true;
      case "dismiss":
        break;
      default: {
        const changed = await setStatus(target, threadId, op === "unhide" ? "visible" : op === "hide" ? "hidden" : "deleted", now, tx);
        await tx.forumReport.updateMany({
          where: { ...targetWhere(target), status: "open" },
          data: { status: op === "unhide" ? "dismissed" : "actioned", resolvedById: staffId, resolvedAt: now },
        });
        return changed;
      }
    }
    await tx.forumReport.updateMany({ where: { ...targetWhere(target), status: "open" }, data: { status: "dismissed", resolvedById: staffId, resolvedAt: now } });
    return true;
  });
  if (changed && (op === "hide" || op === "delete") && row.authorId) {
    await db.forumNotification.create({ data: { userId: row.authorId, threadId, postId: target.postId ?? null, kind: "moderation", actor: STAFF_NAME } })
      .catch((e) => console.error("[forum] moderation notice failed", e));
  }
  return { threadId, authorId: row.authorId };
}

/** Mutes (days > 0) or unmutes (0) a member: they keep reading, but can't post, reply, vote or report */
export async function muteMember(userId: string, days: number, now = new Date()) {
  if (!Number.isInteger(days) || days < 0 || days > 365) throw invalid("Choose 0 to 365 days.");
  const r = await db.forumProfile.updateMany({ where: { userId }, data: { mutedUntil: days ? new Date(now.getTime() + days * DAY) : null } });
  if (!r.count) throw notFound("Member");
}

/** An eGuard team post in Announcements (pinned by default), or in another topic */
export async function postAnnouncement(staffId: string, input: { title: string; body: string; category?: string; pinned?: boolean }, now = new Date()) {
  const t = ThreadSchema.parse({ category: input.category || "announcements", title: input.title, body: input.body });
  const category = await db.forumCategory.findUnique({ where: { slug: t.category } });
  if (!category) throw invalid("Choose a topic.");
  return db.forumThread.create({
    data: { categoryId: category.id, staffAuthorId: staffId, title: t.title, body: t.body, pinned: input.pinned ?? true, lastActivityAt: now, createdAt: now },
    select: { id: true },
  });
}

/** A staff reply in a thread (no notices to staff; parents following it hear about it) */
export async function staffReply(staffId: string, threadId: string, rawBody: string, now = new Date()) {
  const body = BodySchema.parse(rawBody);
  const t = await db.forumThread.findUnique({ where: { id: threadId }, select: { status: true } });
  if (!t || t.status !== "visible") throw notFound("Thread");
  const post = await db.$transaction(async (tx) => {
    const post = await tx.forumPost.create({ data: { threadId, staffAuthorId: staffId, body, createdAt: now }, select: { id: true } });
    await tx.forumThread.update({ where: { id: threadId }, data: { replyCount: { increment: 1 }, lastActivityAt: now } });
    return post;
  });
  after(() => notifyReply(threadId, post.id, `staff:${staffId}`, STAFF_NAME, body).catch((e) => console.error("[forum] reply notices failed", post.id, e)));
  return post;
}

/* ---------- Data rights and upkeep ---------- */

/** What the parent wrote in Community, for their account export: never other parents' posts */
export async function exportForum(userId: string) {
  const [profile, threads, posts, votes] = await Promise.all([
    db.forumProfile.findUnique({ where: { userId }, select: { handle: true, notifyReplies: true, acceptedRulesAt: true, createdAt: true } }),
    db.forumThread.findMany({ where: { authorId: userId, status: { not: "deleted" } }, select: { id: true, title: true, body: true, status: true, createdAt: true, editedAt: true, category: { select: { name: true } } } }),
    db.forumPost.findMany({ where: { authorId: userId, status: { not: "deleted" } }, select: { id: true, threadId: true, body: true, status: true, createdAt: true, editedAt: true } }),
    db.forumVote.count({ where: { userId } }),
  ]);
  return { profile, threads: threads.map((t) => ({ ...t, category: t.category.name })), replies: posts, helpfulVotes: votes };
}

/**
 * Before deleting accounts: empties what these parents wrote. Their threads and replies stay as "Deleted member"
 * placeholders so other parents' replies still read in order; profile, votes, follows and notices cascade with
 * the user row.
 */
export async function eraseForUsers(userIds: string[], now = new Date(), tx: Prisma.TransactionClient | typeof db = db) {
  if (!userIds.length) return;
  const visible = await tx.forumPost.groupBy({ by: ["threadId"], where: { authorId: { in: userIds }, status: "visible" }, _count: { _all: true } });
  await tx.forumPost.updateMany({ where: { authorId: { in: userIds } }, data: { status: "deleted", statusAt: now, body: "" } });
  await tx.forumThread.updateMany({ where: { authorId: { in: userIds } }, data: { status: "deleted", statusAt: now, title: "", body: "" } });
  for (const g of visible) await tx.forumThread.update({ where: { id: g.threadId }, data: { replyCount: { decrement: g._count._all } } });
}

/**
 * Maintenance: hidden posts are erased FORUM_RETENTION_DAYS.removed days after they were hidden (a parent's
 * appeal has that long); deleted threads with no replies left are removed outright; old read notices go.
 */
export async function purgeForum(now = new Date()) {
  const cutoff = new Date(now.getTime() - FORUM_RETENTION_DAYS.removed * DAY);
  const [posts, threads] = await Promise.all([
    db.forumPost.updateMany({ where: { status: "hidden", statusAt: { lt: cutoff } }, data: { status: "deleted", body: "" } }),
    db.forumThread.updateMany({ where: { status: "hidden", statusAt: { lt: cutoff } }, data: { status: "deleted", title: "", body: "" } }),
  ]);
  const empty = await db.forumThread.deleteMany({ where: { status: "deleted", statusAt: { lt: cutoff }, posts: { none: { status: { not: "deleted" } } } } });
  const notices = await db.forumNotification.deleteMany({ where: { readAt: { lt: new Date(now.getTime() - FORUM_RETENTION_DAYS.notices * DAY) } } });
  return { erased: posts.count + threads.count, threadsRemoved: empty.count, noticesRemoved: notices.count };
}
