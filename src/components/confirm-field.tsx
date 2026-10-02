/**
 * How a parent confirms a deletion: their password, or typing DELETE when the account has none (Apple/Google
 * sign-in). Matches confirmDestructive on the server, which reads `password` or `phrase`.
 */
export function ConfirmField({ id, hasPassword }: { id: string; hasPassword: boolean }) {
  return hasPassword
    ? <div className="field"><label htmlFor={id}>Your password</label><input className="input" id={id} name="password" type="password" required autoComplete="current-password" /></div>
    : <div className="field"><label htmlFor={id}>Type DELETE to confirm</label><input className="input" id={id} name="phrase" required autoComplete="off" autoCapitalize="characters" spellCheck={false} /></div>;
}

/** The end of a deletion form's explanation, telling the parent which of the two to do. */
export const confirmHint = (hasPassword: boolean) => (hasPassword ? "Enter your password to confirm." : "Type DELETE to confirm.");
