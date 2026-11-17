# Feedback, the NPS survey and store ratings

How eGuard hears from parents, and how it asks for a rating without breaking store rules. Code: `src/lib/feedback.ts`,
`src/lib/feedback-queries.ts`, `src/app/actions/feedback.ts`, `src/components/nps-card.tsx`,
`src/components/feedback-form.tsx`, and `/api/mobile/v1/feedback/*` ([docs/mobile-api.md › Feedback](../mobile-api.md)).
Store reviews that people post on Google Play and the App Store are a separate feature: [console.md §9](../console.md#9-store-reviews).

## The rule that shapes everything: no review gating

Google Play forbids asking for an opinion before or while showing its review card, and Apple allows only its own
review prompt (at most 3 a year). Both forbid asking only happy users. So:

- The **survey** and **Send feedback** are about hearing from parents. Their answers never decide whether a parent is
  asked for a store rating.
- The **store rating prompt** ([below](#store-ratings), `lib/review-prompts`) is chosen only from what the parent does in the app
  (time with eGuard, devices healthy, no open problem). Any feedback in the last 30 days delays it, whatever the score.

## The survey (NPS)

"How likely are you to recommend eGuard to another parent?", 0–10, then an optional comment.

| Score | Group | Comment prompt |
|---|---|---|
| 9–10 | Promoter | "What do you like most?" |
| 7–8 | Passive | "What would make eGuard better?" |
| 0–6 | Detractor | "What went wrong? We'd like to fix it." and "Someone from eGuard may email me" (on by default) |

**When it's shown** (`npsDue`, all must hold):

- the feature flag `nps_survey` is on for the family (console › Feature flags; off until created, so it can be rolled
  out by percentage)
- the account is at least 21 days old, with at least one paired device or browser
- the parent has no open support ticket
- not answered in 180 days, not dismissed ("Not now") in 90, not shown without an answer in 14

**Where:**

- Web: a card at the top of the dashboard, only when the two-step prompt isn't showing (one ask at a time). It stays
  until answered or dismissed.
- Apps: a sheet on the home screen, a few seconds after it has loaded, at most once per app run; the app reports
  `seen`, so it isn't asked again for 14 days. Never in child mode.

## Send feedback

Settings › Support on the web; Help & support › Send feedback in the apps. Kind: feedback, something's not working, or
an idea; a comment (3–2,000 characters); "eGuard may email me" (on by default).

## What happens next

| Feedback | Follow-up |
|---|---|
| 0–6, or "something's not working", with "may email me" and a comment | A support ticket (category `FEEDBACK`) in the parent's name, forwarded to the support inbox like any ticket. The parent sees it under their requests |
| The same without "may email me" or without a comment | `NEEDED`: listed for staff in console › Feedback, never contacted |
| Everything else | Recorded |

10 a parent an hour. Comments are the parent's own words: shown to staff (console › Feedback, with the parent's email,
like a ticket), never sent to an AI provider.

## Console › Feedback

NPS over 30 and 90 days, answers by group, messages by kind, and every answer newest first, filtered by kind, group or
follow-up. Staff mark `NEEDED` ones Contacted or Resolved (audit: `feedback.follow_up`). Console › Alerts lists
unhappy feedback waiting over 2 days.

## Store ratings

Code: `src/lib/review-prompts.ts`, `GET`/`POST /api/mobile/v1/review-prompt`, the `review_invite` parent care
automation, `/rate`; Android `feature/feedback/StoreReview.kt`.

Behind the feature flag `rate_prompt` (off until created). Two ways to ask, sharing the same rules from what the parent
does (`RateFacts` has no score on purpose):

| Rule | App prompt | Email invitation |
|---|---|---|
| Account age | 14+ days | 30+ days |
| Active (a qualifying action) | 3 of the last 14 days | same |
| Devices | one paired 7+ days ago; every device online with its checks passing | same |
| Nothing wrong now | no unresolved urgent alert, no open ticket | same |
| Feedback | none in 30 days, whatever it said | same |
| Asked before | not by this app in 120 days; at most 3 a year | no app prompt in 60 days; no invitation in 180 days |
| Who | the parent app | parents who use the Android app (eGuard isn't on the App Store yet) |

**App prompt (Android):** after a configuration batch ends with every change in place, the app asks
`GET /review-prompt`, waits a moment, and launches Play's own review card, then reports `POST /review-prompt`. Play
decides whether the card shows (it has its own quota); the app never asks a question first. Debug builds use Play's
`FakeReviewManager`, which shows nothing: test the real flow with internal app sharing.

**Email invitation (`review_invite`):** a parent care automation (email only, the parent's "Rating invitation" switch
in Settings › Notifications). Everyone who gets it is offered both: rate eGuard on Google Play, or tell us what's not
working. Its link is `/rate`, which sends a phone to its store, and anything else to Google Play.

**iOS:** not built yet. Apple's `requestReview` would use the same `GET`/`POST /review-prompt`.

## Testimonials

Kind words from the survey or Send feedback can become a quote on eguard.family, only with the parent's consent:
console › Feedback › **Quote this**, then console › Social proof. The whole flow is in
[docs/marketing-site-review.md › Social proof](../marketing-site-review.md#social-proof-how-to-add-it).

## Retention and privacy

- Comments are erased after 365 days (the score stays, for trends); rows are deleted after 730 days
  (`FEEDBACK_RETENTION_DAYS`, run by the maintenance job's data retention).
- Included in the family's data export; deleted with the account.

## Not done yet

- The store rating prompt on iOS (and the invitation linking to the App Store once eGuard is there).
- iOS: the survey and Send feedback are built on Android and the web only so far.
