import { ActivityQuery, activity, orgApi, queryOf } from "@/lib/org-api";

/** Daily counts of families joining and leaving and codes redeemed and cancelled (last 30 days). */
export const GET = orgApi(async ({ req, caller }) => activity(caller.org.id, queryOf(req, ActivityQuery)));
