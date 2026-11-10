# Sending a Broadcast to Parents

## Summary

The broadcast procedure describes how eGuard staff write, test and send one email to many parents, or to a public mailing list, from the Email (broadcasts) page of the console (staff back office). It is for staff who send product news and service notices. A broadcast is either a product update, which goes only to verified parents who have product updates turned on, or a service notice, which goes to every verified parent and must not be used for news. Sending runs in batches of about 600 emails an hour, so a large broadcast takes hours to finish. Who approves a broadcast before it is sent is not yet set and is marked [TO CONFIRM].

## Purpose of the broadcast procedure

The broadcast procedure makes sure that every email sent to many parents goes to the right audience, uses the right kind (product update or service notice), contains only checked facts, and is tested before it goes out. It also keeps the promises made to parents and mailing-list subscribers about what they will receive.

## When the broadcast procedure applies, and when it does not

The broadcast procedure applies to every email sent from the console's Email page:

- a **product update** (new features, news) to parents;
- a **service notice** (Terms or privacy changes, security notices, outages, account changes such as new plan limits) to parents;
- an email to a public **mailing list**: eGuard news, or iPhone launch.

The broadcast procedure does not apply to:

- replies to support tickets, which go out from the support inbox;
- automatic emails sent by eGuard itself (pass reminders, alerts, organization emails);
- Parent care messages, which are run from the console's Parent care pages;
- emails chosen by criteria other than plan (sign-up dates, organization, has a device), emails with images or rich formatting, and automatic lifecycle emails such as a welcome series. The console does not support these in version 1.

## Roles involved in a broadcast

| Role | Responsibility |
|---|---|
| Staff member (console) | Writes the draft, sends a test, schedules or sends the broadcast, watches delivery, stops it if needed. The console has no staff roles in version 1: every staff account can do all of these. |
| Broadcast approver | Approves the subject, message, kind and audience before sending. [TO CONFIRM: approver role for product updates and for service notices] |
| Engineer | Keeps the mail settings, the maintenance job and the "Write with AI" key working; raises the batch size once the email provider's limit is raised. |

## Inputs needed before starting a broadcast

1. A staff account for the console (console.eguard.family), with its password and authenticator app. Accounts are created by engineering; there is no sign-up page.
2. What the email must tell parents, and why.
3. The kind: product update or service notice (see step 2 below).
4. The audience: parents on some or all plans, or one mailing list.
5. Every fact the email states (prices, dates, limits, links), checked against its home document. Prices and plan limits are in "Products and Services Catalogue".
6. The send time, if the broadcast is scheduled, in Philippine time (Asia/Manila).
7. The approval, where one is required (see "Approvals required for a broadcast").

## Choosing the kind and audience of a broadcast

| Kind | Use for | Goes to | Unsubscribe |
|---|---|---|---|
| Product update | New features, news | Verified parents with **Product updates** on (Settings › Notifications; on by default) | Footer link, plus one-click unsubscribe headers that mail apps such as Gmail show as their own button |
| Service notice | Terms or privacy changes, security notices, outages, account changes | Every verified parent, whatever their settings | None, because it is not marketing |

Either kind can be narrowed to some plans; with no plan ticked it goes to every plan. Unverified addresses never receive a broadcast.

Mailing lists are chosen in the **To** field:

| List | Joined from | Promise made on the sign-up form |
|---|---|---|
| eGuard news | The form in every public page's footer | Occasional news, about once a month at most |
| iPhone launch | The `/iphone` page, linked from every "iPhone coming soon" | One email when eGuard for iPhone and iPad is out, and a few about setting it up |

A mailing-list email is always a product update, has no plan filter, starts with "Hi," (no name), and reaches only subscribers who confirmed their address. Unsubscribing removes the address from every list.

## Broadcast procedure, steps 1 to 6: writing the draft

1. **Staff member (console):** sign in at console.eguard.family with email, password and authenticator code. A session ends 12 hours after sign-in or after 30 minutes idle.
2. **Staff member:** choose the kind and audience (see "Choosing the kind and audience of a broadcast"). If the email contains any news or promotion, then it is a product update, not a service notice.
3. **Staff member (console › Email › New email):** enter the subject, the plain-text message, the kind, and the plans or mailing list. A blank line starts a new paragraph and links become clickable. The greeting ("Hi <first name>," for parents) and the footer are added automatically, so the message leaves them out.
4. **Staff member (optional, Write with AI box):** to have a draft written, describe what the email should tell parents and press **Draft with AI**; to change an existing message, describe the change (for example "shorter" or "in Filipino"). See "Using Write with AI in a broadcast". If the box is replaced by a note, then Write with AI is off; write the message by hand.
5. **Staff member:** check every fact against its home document, remove any `[TODO: …]` by filling in the missing fact, and save the draft.
6. **Staff member:** read the preview and the number of parents (or **Would reach N subscribers** for a list) the email would reach now.

## Using Write with AI in a broadcast

Write with AI fills the subject and message only; nothing is saved or sent until the staff member saves the draft, and the test, preview and confirmation steps stay the same. Facts to know:

- **Content rules given to the AI:** plain text only; no marketing in a service notice; never invent features, prices, dates or links. A fact it needs but was not given comes back as `[TODO: …]`, and **an email containing `[TODO` cannot be sent or scheduled** until staff fill it in.
- **Privacy:** only what staff type (the brief, the current subject and message) goes to the AI provider. Staff must not type any parent's name, address or other personal data into the brief.
- **Limit:** 30 drafts an hour per staff member. Each draft is one paid request to the provider (Claude or OpenAI, whichever key is set) and is logged as `broadcast.ai_draft`.
- **Setup:** the box works only when `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set on the server (optionally `AI_PROVIDER` and `OPENAI_MODEL`).

## Broadcast procedure, steps 7 to 10: testing, approval and sending

7. **Staff member (console › broadcast page):** press **Send me a test**. One copy, with `[Test]` in the subject, goes to the signed-in staff member. Check the subject, wording, links, greeting and footer in a real mail app.
8. **Broadcast approver:** approve the draft as tested. If changes are needed, then go back to step 3. [TO CONFIRM: approver role]
9. **Staff member:** tick the confirmation, then press **Send to N parents** (now) or **Schedule** (date and time in Philippine time (Asia/Manila)). Only a draft can be edited, sent or deleted.
10. **Staff member:** if the console says "This email was changed since you opened it", then someone edited the draft in another tab or session. Reload the page, re-read the draft and go back to step 7.

## Broadcast procedure, steps 11 to 13: watching and stopping delivery

11. **Staff member (console › broadcast page):** watch the sent, waiting, failed and skipped counts, and the latest 50 failed or skipped addresses with the reason. The maintenance job sends every 10 minutes; "Send now" also starts the first batch straight away.
12. **Staff member:** if the email is wrong after sending has started, then press **Stop sending**; it takes effect at once. A scheduled email can go **Back to draft**, or be cancelled, before it starts.
13. **Staff member:** when nobody is left waiting, check the broadcast shows as sent. Failed emails are not retried.

## Sending limits for broadcasts

| Limit | Value |
|---|---|
| Emails per sending run | 100, stopping early after 90 seconds |
| Gap between emails (production) | 550 milliseconds, to stay under the email provider Resend's default rate limit |
| Throughput | About 600 emails an hour; 5,000 parents take about 8½ hours |
| Recipient list | Fixed when sending starts; each parent is checked again at their turn and skipped if they unsubscribed, deleted their account, or changed or unverified their address |
| Email claimed but never finished | Marked failed after 15 minutes |

Engineering raises the batch size (and lowers the gap) only once Resend's limit is raised.

## Example: service notices for a plan-limit change

The plan-limit change released on 2026-10-28 used two service notices, sent from the console on release day after the release checks passed: notice A to families on eGuard Plus and eGuard Family ("Your eGuard plan keeps its limits") and notice B to families on Free ("Changes to eGuard Free"). Both were service notices because new limits are an account change, so they reach every verified parent even with product updates turned off. The notice texts and the release checks are in "Releasing a Plan-Limit or Price Change".

## Approvals required for a broadcast

| What | Who approves | Limit |
|---|---|---|
| Product update to parents | [TO CONFIRM: approver role] | Not applicable |
| Service notice (Terms, privacy, security, outage, account change) | [TO CONFIRM: approver role] | Not applicable |
| Email to a mailing list | [TO CONFIRM: approver role] | Within the promise on the sign-up form |

## Exceptions to the broadcast procedure

| Situation | What to do |
|---|---|
| Write with AI refuses ("The AI wouldn't write this one") | Write the message by hand. |
| The draft contains `[TODO: …]` | Fill in the fact; the console will not send or schedule it until then. |
| Many emails fail | Read the failure reasons on the broadcast page and pass them to engineering. Failed emails are not resent automatically. [TO CONFIRM: whether failed recipients are sent a second broadcast] |
| A sent email was wrong | Stop sending; send a correction only after approval. [TO CONFIRM: rule for sending corrections] |
| An audience the console cannot select (by organization, sign-up date, device) | Not possible in version 1; raise it with engineering. |

## Outputs of a broadcast and where they are recorded

| Output | Where it is recorded |
|---|---|
| Draft, schedule and sending status | Console › Email: drafts, scheduled, sending and sent, with how many went out |
| Delivery results | The broadcast's page: sent, waiting, failed, skipped, and the latest 50 failed or skipped addresses with why |
| Staff actions | Console audit log: `broadcast.create`, `broadcast.edit`, `broadcast.test`, `broadcast.send` or `broadcast.schedule` (with the kind, plans and number of parents), `broadcast.unschedule`, `broadcast.cancel`, `broadcast.delete`, `broadcast.ai_draft`, `broadcast.view` |
| Unsubscribes | The parent's Product updates setting is turned off; a mailing-list address is deleted from every list |

Deleting a draft is the only delete, so the unsubscribe links in sent emails keep working.

## Time targets for a broadcast

| Item | Target |
|---|---|
| Service notices for a plan or price change | Release day, after the release checks pass |
| Delivery | See "Sending limits for broadcasts" |
| Notice period before a Terms or privacy change | [TO CONFIRM] |
| Approval turnaround | [TO CONFIRM] |
| How often eGuard news is sent | About once a month at most (the sign-up promise) |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Releasing a Plan-Limit or Price Change; Products and Services Catalogue; Brand Voice and Writing Style Guide; Data Handling and Confidentiality; Systems Overview; Customer Support Playbook |

## Open questions

1. [TO CONFIRM: approver role for product updates and for service notices]; also the approver for mailing-list emails. The sources name no approver; the console has no staff roles in version 1 (console.md §7).
2. [TO CONFIRM: whether failed recipients are sent a second broadcast].
3. [TO CONFIRM: rule for sending corrections] after a wrong email has gone out.
4. [TO CONFIRM: notice period before a Terms or privacy change].
5. [TO CONFIRM: approval turnaround].
6. [TO CONFIRM: owner role], effective date and review date for this SOP.
7. The page's name differs between sources. console.md §8: "One email to many parents at once, from **Email** in the console" (page path `/broadcasts`). plan-change-2026-10.md §2: "Send both from **Console › Broadcasts** as **Service** notices". Confirm the label staff see in the console navigation.
8. Parent care messages are listed by console.md under separate `/care` pages; confirm they are out of scope for this SOP and covered by "Deploying, Pausing and Rolling Back Parent Care".
