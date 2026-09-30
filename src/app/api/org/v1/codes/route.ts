import { CodesQuery, listCodes, orgApi, queryOf } from "@/lib/org-api";

/** The organization's sponsor codes, in pages of up to 500, optionally by status or batch. */
export const GET = orgApi(async ({ req, caller }) => listCodes(caller.org.id, queryOf(req, CodesQuery)));
