import { codeJson, findCode, orgApi } from "@/lib/org-api";

/** One code, by its id or the code itself. */
export const GET = orgApi<{ code: string }>(async ({ caller, params }) => ({ code: codeJson(await findCode(caller.org.id, params.code)) }));
