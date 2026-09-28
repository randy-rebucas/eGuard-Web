import { ZodError } from "zod";

/**
 * An error whose message is safe to show to a parent. Server actions surface the message;
 * the mobile API maps `status` to the HTTP status code.
 */
export class ServiceError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export const notFound = (what: string) => new ServiceError(404, `${what} not found.`, "not_found");
export const forbidden = (message = "Only the family admin can do this.") => new ServiceError(403, message, "forbidden");
export const invalid = (message: string) => new ServiceError(400, message, "invalid");
export const conflict = (message: string) => new ServiceError(409, message, "conflict");
/** The family's plan doesn't cover this: at a limit (children, devices) or a feature it doesn't include. */
export const planLimit = (message: string) => new ServiceError(409, message, "plan_limit");
export const planRequired = (message: string) => new ServiceError(403, message, "plan_required");

/** Prisma's unique-constraint error (P2002): a concurrent request won the race past our "already exists?" check. */
export const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";

/** What a server action returns: its data, or a message safe to show the parent. */
export type Result<T extends object = object> = (T & { error?: undefined }) | { error: string };

/**
 * Runs a server action body so expected failures come back as `{ error }`.
 * Production redacts thrown messages, so a thrown ServiceError would reach the parent as a generic error.
 * Anything else (bugs, the database being down, redirect()) still throws.
 */
export async function toResult<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return (await fn()) as Result<T>;
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Check the details and try again." };
    throw e;
  }
}
