import { listBatches, orgApi } from "@/lib/org-api";

/** Purchases of sponsor codes, newest first, with each one's code counts. */
export const GET = orgApi(async ({ caller }) => listBatches(caller.org.id));
