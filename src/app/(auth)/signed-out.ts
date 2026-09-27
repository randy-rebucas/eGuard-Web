import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

/** Sign in, create account and forgot password are for signed-out visitors. */
export async function redirectIfSignedIn() {
  if (await getUser()) redirect("/dashboard");
}
