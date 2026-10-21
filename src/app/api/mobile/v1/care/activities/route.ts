import { NextResponse } from "next/server";
import { authed } from "@/lib/mobile-api";
import { careActivities } from "@/lib/parent-care/service";

/**
 * The Safety plan: `plan` (this week's one or two activities, `week` is its local Monday), `inProgress`,
 * `suggested` (more that fit the children's ages), `completed` and `dismissed`. Each activity has its steps,
 * `status` (NEW, STARTED, COMPLETED, DISMISSED), an `article` slug for /learn and, when it's done in eGuard, `appLink`.
 */
export const GET = authed(async ({ user }) => NextResponse.json(await careActivities(user)));
