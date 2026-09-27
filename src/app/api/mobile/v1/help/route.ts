import { NextResponse } from "next/server";
import { z } from "zod";
import { HELP_CATEGORIES, searchHelp, type HelpCategory } from "@/lib/help";
import { open, query } from "@/lib/mobile-api";
import { supportEmail } from "@/lib/support";

const Query = z.object({
  q: z.string().max(100).default(""),
  category: z.enum(HELP_CATEGORIES.map((c) => c.id) as [HelpCategory, ...HelpCategory[]]).optional(),
});

/** Help & Support: categories and articles, searchable with `?q=`. Public, so it works before sign-in too. */
export const GET = open(async ({ req }) => {
  const q = query(req, Query);
  return NextResponse.json({
    categories: HELP_CATEGORIES,
    articles: searchHelp(q.q, q.category).map((a) => ({ slug: a.slug, category: a.category, title: a.title, summary: a.summary })),
    contact: { email: supportEmail(), replyTime: "Replies within 1 business day" },
  });
});
