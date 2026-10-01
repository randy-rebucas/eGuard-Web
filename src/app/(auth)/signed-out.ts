import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/return-to";

/** Sign in, create account and forgot password are for signed-out visitors. Signed in, go where they were headed. */
export async function redirectIfSignedIn(next?: unknown) {
  if (await getUser()) redirect(safeNext(next) ?? "/dashboard");
}
