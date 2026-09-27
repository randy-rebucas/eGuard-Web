import { NextResponse } from "next/server";
import { HELP_ARTICLES } from "@/lib/help";
import { notFound } from "@/lib/errors";
import { open } from "@/lib/mobile-api";

export const GET = open<{ slug: string }>(async ({ params }) => {
  const a = HELP_ARTICLES.find((x) => x.slug === params.slug);
  if (!a) throw notFound("Article");
  return NextResponse.json(a);
});
