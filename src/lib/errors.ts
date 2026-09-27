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
