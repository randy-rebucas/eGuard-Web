import { cancelCodeByApi, orgApi } from "@/lib/org-api";

/** Cancels a code that hasn't been used. Needs a key with "Read and cancel codes" access. */
export const POST = orgApi<{ code: string }>(async ({ caller, params }) => ({ code: await cancelCodeByApi(caller, params.code) }), { write: true });
