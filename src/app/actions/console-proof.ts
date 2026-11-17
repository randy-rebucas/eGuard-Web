"use server";

import { headers } from "next/headers";
import { refresh, updateTag } from "next/cache";
import { isConsoleHost } from "@/lib/console-host";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { ServiceError } from "@/lib/errors";
import { savePlayRating } from "@/lib/social-proof-data";
import {
  PROOF_TAG, discardProposal, editProposal, proposeForParent, proposeFromFeedback, sendConsentRequest, setPublished, setSortOrder,
} from "@/lib/testimonials";
import type { FormState } from "./auth";

/**
 * Console › Social proof (docs/marketing-site-review.md › Social proof): the Play rating the site shows, and parents'
 * quotes, which go on the site only with their consent. Every change that reaches the site expires its cache at once.
 */
async function consoleRequest() {
  const h = await headers();
  if (!isConsoleHost(h.get("host"))) throw new ServiceError(404, "Not found.", "not_found");
  return requireStaff();
}

const str = (form: FormData, k: string) => String(form.get(k) ?? "");

async function run(fn: () => Promise<string>): Promise<FormState> {
  try {
    const ok = await fn();
    refresh();
    return { ok };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
}

export async function savePlayRatingAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await consoleRequest();
  return run(async () => {
    const input = { stars: Number(str(form, "stars")), reviews: Number(str(form, "reviews")), checkedOn: str(form, "checkedOn") };
    await savePlayRating(input, staff.id);
    updateTag(PROOF_TAG);
    await logStaff(staff.id, "proof.rating", undefined, `${input.stars}★, ${input.reviews} reviews, checked ${input.checkedOn}`);
    return "Saved. The site shows it within a minute.";
  });
}

/** A new quote, from a parent's feedback or from what they wrote elsewhere (by their account's email) */
export async function proposeTestimonial(_: FormState, form: FormData): Promise<FormState> {
  const staff = await consoleRequest();
  return run(async () => {
    const input = { quote: str(form, "quote"), displayName: str(form, "displayName") };
    const feedbackId = str(form, "feedbackId");
    const t = feedbackId
      ? await proposeFromFeedback(feedbackId, input, staff.id)
      : await proposeForParent(str(form, "parentEmail"), { ...input, originalText: str(form, "originalText") }, staff.id);
    await logStaff(staff.id, "proof.propose", `testimonial:${t.id}`);
    return "Proposed. Send it to the parent to ask for their consent.";
  });
}

export async function editTestimonial(_: FormState, form: FormData): Promise<FormState> {
  const staff = await consoleRequest();
  return run(async () => {
    const id = str(form, "id");
    const r = await editProposal(id, { quote: str(form, "quote"), displayName: str(form, "displayName") });
    if (r.wasPublished) updateTag(PROOF_TAG);
    await logStaff(staff.id, "proof.edit", `testimonial:${id}`);
    return r.wasPublished ? "Changed and taken off the site: the parent must agree to the new wording." : "Saved. Send it to the parent for consent.";
  });
}

export async function testimonialAction(_: FormState, form: FormData): Promise<FormState> {
  const staff = await consoleRequest();
  const id = str(form, "id");
  const op = str(form, "op");
  return run(async () => {
    switch (op) {
      case "send":
        await sendConsentRequest(id);
        await logStaff(staff.id, "proof.consent_request", `testimonial:${id}`);
        return "Sent. It goes on the site only after the parent agrees and you publish it.";
      case "publish":
      case "unpublish":
        await setPublished(id, op === "publish");
        updateTag(PROOF_TAG);
        await logStaff(staff.id, `proof.${op}`, `testimonial:${id}`);
        return op === "publish" ? "Published." : "Taken off the site.";
      case "discard":
        await discardProposal(id);
        await logStaff(staff.id, "proof.discard", `testimonial:${id}`);
        return "Discarded.";
      case "order":
        await setSortOrder(id, Number(str(form, "sortOrder")));
        updateTag(PROOF_TAG);
        return "Order saved.";
      default:
        throw new ServiceError(400, "Unknown action.", "invalid");
    }
  });
}
