import { orgApi, organizationJson } from "@/lib/org-api";

/** The organization this key belongs to, with counts of families and codes. */
export const GET = orgApi(async ({ caller }) => ({ organization: await organizationJson(caller) }));
