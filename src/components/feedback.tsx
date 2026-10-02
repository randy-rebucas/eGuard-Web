import { Icon } from "./icon";
import type { FormState } from "@/app/actions/auth";

/** A form action's result: the error or the confirmation. */
export function Feedback({ state }: { state: FormState }) {
  if (state?.error) return <div className="form-error" role="alert"><Icon name="triangle-alert" />{state.error}</div>;
  if (state?.ok) return <div className="form-ok" role="status"><Icon name="circle-check" />{state.ok}</div>;
  return null;
}
