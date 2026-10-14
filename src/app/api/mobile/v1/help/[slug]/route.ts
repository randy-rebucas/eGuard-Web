import { NextResponse } from "next/server";
import { HELP_ARTICLES, helpForClient } from "@/lib/help";
import { notFound } from "@/lib/errors";
import { clientLabel, open } from "@/lib/mobile-api";

export const GET = open<{ slug: string }>(async ({ req, params }) => {
  const a = HELP_ARTICLES.find((x) => x.slug === params.slug);
  if (!a) throw notFound("Article");
  // The iPhone app gets the article without prices or where to buy (App Store guideline 3.1.1)
  return NextResponse.json(helpForClient(a, clientLabel(req) === "iOS app"));
});
