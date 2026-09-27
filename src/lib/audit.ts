import "server-only";
import { db } from "./db";

/** Appends to the family's audit log (who did what, shown nowhere else). */
export const audit = (familyId: string, actor: string, action: string, detail?: string) =>
  db.auditLog.create({ data: { familyId, actor, action, detail } });
