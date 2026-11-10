# Refreshing the Store-Review Demo Account

## Summary

The demo account refresh procedure explains how the engineering team refreshes the review demo account, the production eGuard account that Google Play and App Store reviewers sign in to. The review demo account belongs to the "eGuard Demo Family", a made-up family on eGuard Family with three children, 5 devices, two weeks of screen time, alerts and history, and its alert emails turned off. Its demo devices do not sync, so they show as offline after about a day; the refresh script replaces the demo family's data and can reset the password. The script only ever touches the eGuard Demo Family. The full seed command must never be run against production, because it deletes every family.

## Purpose of the demo account refresh procedure

The purpose of the demo account refresh is to give store reviewers working credentials and screens full of realistic data, so that a review is not rejected or delayed because screens are empty or devices show "Offline". The procedure also keeps the password handled safely and keeps the demo family separate from real families.

## When the demo account refresh procedure applies

The demo account refresh applies:

- before an app is submitted or resubmitted for store review;
- when the demo devices show as offline (after about a day without syncing);
- when the review demo account's password must be reset.

The procedure does not apply to test families created for other purposes (production go-live removes those; see "Production Go-Live Checks"), or to the seed accounts used in development, which must never be used for store review.

## Roles involved in the demo account refresh

| Role | Responsibility |
|---|---|
| Engineering | Runs the refresh script against production, checks the result, pairs and keeps test devices online when used. [TO CONFIRM: which role or person] |
| Password manager owner | Stores the review demo account's password and updates it after a reset. [TO CONFIRM: which password manager and who has access] |
| Store submitter | Updates the credentials in Google Play Console (App content › App access) and in the App Store review notes. [TO CONFIRM: who] |

## Inputs needed before the demo account refresh

| Input | Detail |
|---|---|
| Production database access | The production `DATABASE_URL`, passed on the command line only for the run |
| The refresh script | `npm run seed:demo` in the eGuard repository |
| Optional new password | `DEMO_PASSWORD`, if a chosen password is wanted; otherwise the script generates one |
| Password manager access | To read or store the review demo account's credentials |
| Test devices (optional) | A test Android phone and a test iPhone, charged and able to stay online during review |

## Procedure: refreshing the demo family

1. Engineering runs a dry run first: `DATABASE_URL=<production url> npm run seed:demo`. The dry run shows what would change and changes nothing.
2. Engineering reads the dry-run output. If the script refuses because the review demo account's email belongs to anything other than the eGuard Demo Family, then stop and go to "Exceptions in the demo account refresh and what to do".
3. Engineering applies the refresh: `DATABASE_URL=<production url> npm run seed:demo -- --apply`. The script replaces the demo family. It sets a new password unless `DEMO_PASSWORD` is set.
4. If a new password was generated, then engineering copies it into the password manager straight away; the password is printed only once. Go to step 5. If `DEMO_PASSWORD` was used, then confirm the password manager entry matches and go to step 6.
5. The store submitter updates the credentials in Google Play Console › App content › App access and in the App Store review notes.
6. Engineering signs in to the parent web dashboard with the review demo account and checks that the dashboard, Configuration Health, screen time, alerts and history have data and that the family is on eGuard Family.
7. If the review needs live devices, then engineering follows "Procedure: pairing real test devices for store review".

## Procedure: pairing real test devices for store review

The source recommends real test devices "for the richest review", because the seeded demo devices do not sync.

1. Engineering makes sure the demo family is on eGuard Family, so reviewers can see every feature, location included.
2. Engineering uses one demo child on the Protected profile (the reviewer notes name this child) and pairs a test Android phone and a test iPhone to that child, so health, alerts, screen time and location have real data.
3. Engineering leaves one app waiting for approval and one open alert, so those screens are not empty.
4. Engineering keeps the test devices charged and online for the whole review; otherwise reviewers see "Offline".

[TO CONFIRM: whether the iPhone test device can be paired today, given that eGuard for iPhone and iPad is "coming soon"]

## Approvals required for the demo account refresh

| What | Who approves | Limit |
|---|---|---|
| Running the refresh script against production | [TO CONFIRM: approver] | The dry run must be read first |
| Changing the review demo account's password | [TO CONFIRM: approver] | The new password goes only into the password manager and the store consoles |

## Exceptions in the demo account refresh and what to do

| Situation | What to do |
|---|---|
| The script refuses because the email belongs to another account | Stop. Do not force it. Find out which account holds the email before going further. [TO CONFIRM: who investigates] |
| Someone suggests `npm run db:seed` to reset data | Never run `npm run db:seed` against production: it deletes every family |
| Someone suggests a seed account from development | Do not use seed accounts for store review; use only the review demo account |
| The password was lost | Run step 3 again to set a new password, then steps 4 and 5 |
| Demo devices show "Offline" during a review | Run the refresh again, or bring the paired test devices back online |

## Outputs of the demo account refresh and where they are recorded

| Output | Where it is recorded |
|---|---|
| Refreshed eGuard Demo Family | Production database |
| Review demo account password | The password manager only |
| Credentials for reviewers | Google Play Console (App content › App access); App Store review notes |
| Refresh record | [TO CONFIRM: where the refresh is logged] |

The production funnel report (`npm run funnel`) leaves out the review demo family, so a refresh does not distort sign-up numbers.

## Time targets for the demo account refresh

| Step | Target |
|---|---|
| Demo devices go offline | About a day after a refresh, because they do not sync |
| Refresh before a submission | [TO CONFIRM: how close to submission, for example the same day] |
| Test devices | Charged and online for the whole review period |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Submitting the App to Google Play and the App Store; Production Go-Live Checks; Data Handling and Confidentiality; Systems Overview |

## Open questions

1. Owner role, effective date and review date of this procedure are not stated in the sources.
2. Who runs the refresh, who approves running it and changing the password, which password manager holds the credentials and who has access, who updates the store consoles, and who investigates if the script refuses.
3. How close to a submission the refresh should run, and where refreshes are logged.
4. The demo set-up differs within app-listing.md §12: the seeded demo family has three children and 5 devices that do not sync, while the reviewer notes say "The family already has a child … with paired Android and iOS devices", which matches the optional real-device steps. Confirm which set-up reviewers should see.
5. app-listing.md says "The native apps aren't built yet" and that the iPhone app is "coming soon" elsewhere (source inventory contradictions 4 and 6), yet §12 asks for a paired test iPhone. Confirm which test devices can actually be paired.
6. app-listing.md §12 lists "Create the review account in production … and verify its email" as step 1 of the real-device steps, while the same section says the demo account is already created. This document treats the account as existing.
7. The review demo account's email address and the development seed account's email were left out of this document on purpose; the password is never written down outside the password manager.
8. launch-visibility.md says to "Keep the review demo family only if app store review needs it". Confirm the demo family should stay in production between reviews.
