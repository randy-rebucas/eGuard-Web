# Releasing a Plan-Limit or Price Change

## Summary

The plan-change release procedure describes how eGuard releases a change to what a plan includes (the number of children and devices, or an entitlement such as alerts when a setting changes) or to a plan's price. It is for engineering, the owner who decides the change, and the staff who send the customer notices. A plan-limit change ships as code and a database migration together, followed by database checks, store and website copy updates, and service notices to parents on release day. A price change is made through server settings and applies to new purchases only: existing auto-renew subscribers keep their old price. The 2026-10-28 plan-limit change is used throughout as the worked example.

## Purpose of the plan-change release procedure

The plan-change release procedure makes sure that a change to plans or prices reaches every place it must (the server, the database, the pricing page, Google Play Console and other copy) in the right order, that families already paying are protected as promised, and that parents are told on the day the change takes effect.

## When the plan-change release procedure applies, and when it does not

The plan-change release procedure applies to:

- changing the number of children or devices a plan allows (`childLimit`, `deviceLimit`);
- moving an entitlement between plans (for example alerts when a setting changes, `driftAlerts`);
- renaming a plan (for example "Family Pro" to "eGuard Family" on 2026-10-28);
- changing a monthly or yearly price on the web, or on Google Play once Google Play billing is turned on.

The plan-change release procedure does not apply to:

- turning the Windows launch offer on or off (the `PC_LAUNCH_OFFER_UNTIL` setting);
- sponsor-code volume discounts, which are set in code for organizations (see "Pricing and Discount Rules");
- granting one family a plan by hand, which is not supported (see "Refunding a Purchase").

## Roles involved in a plan-change release

| Role | Responsibility |
|---|---|
| Owner | Decides the change: accepts or rejects plan and pricing recommendations. Updates products in Google Play Console. |
| Engineer | Changes the plan definitions in code and writes the migration; backs up the database; deploys; runs the checks; changes price settings on the server. |
| Staff member (console) | Sends the customer notices from the console (see "Sending a Broadcast to Parents"). |
| Person responsible for website, store and social copy | Updates plan descriptions outside the code. [TO CONFIRM: role responsible for store and social copy] |

## Inputs needed before starting a plan-change release

1. The owner's written decision: the old and new limits or prices, which plans they apply to, and the release date. Decisions are recorded in "eguard: Decision Log".
2. The rule for families already paying. For limits, the 2026-10-28 rule was that families paying on release day keep their old limits while subscribed ("legacy limits"). For prices, see step 4 of "Release procedure for a price change on the web".
3. The code change to the plan definitions (`src/lib/plans.ts`; there is no plans table) and, for a limit change, the database migration.
4. Proof that the migration applies to an empty database, matches `schema.prisma` exactly, and turns seeded test families into the expected rows.
5. The customer notice texts, one for each affected group of families.
6. The list of places outside the code that describe the plans: Google Play Console product listings, store copy, social media copy and any other published text.

## Release procedure for a plan-limit change, steps 1 to 4: deploying

1. **Engineer (production database):** back up the production database.
2. **Engineer (hosting, release):** deploy the code and the migration together. The release runs `prisma migrate deploy`. Code without the migration fails, and the migration without the code gives paying families the new, lower limits at their next store check.
3. **Engineer (production database):** check the families by plan and limits:

   ```sql
   SELECT plan, "childLimit", "deviceLimit", "legacyLimits", count(*) FROM "Family" GROUP BY 1, 2, 3, 4 ORDER BY 1;
   ```

   For the 2026-10-28 release the expected rows were only `Free 1 1 f`, `eGuard Plus 5 10 t` and `eGuard Family 10 20 t`, with no `Family Pro` rows left. If any other row appears, then stop and go to "Exceptions to the plan-change release procedure".
4. **Engineer (production database):** count the families now over their new limit. For the 2026-10-28 release, Free families with more than one device:

   ```sql
   SELECT count(*) FROM "Family" f WHERE plan = 'Free'
     AND (SELECT count(*) FROM "Device" d WHERE d."familyId" = f.id) > 1;
   ```

   These families stay protected but cannot add anything; they are the audience for the Free notice.

## Release procedure for a plan-limit change, steps 5 to 7: copy and notices

5. **Owner (Google Play Console):** update each affected subscription's listing (name and description) to the new limits. Keep the product id. On 2026-10-28 the `eguard_pro` listing was renamed "eGuard Family" and its description changed to 6 children and 12 devices.
6. **Person responsible for copy:** update every store and social description outside the code to the new limits.
7. **Staff member (console):** on release day, and only after step 3 checks out, send the customer notices as **service notices**, one per affected group, following "Sending a Broadcast to Parents". New limits are an account change, so the notices go to every verified parent, even those with product updates turned off.

## What the 2026-10-28 plan-limit migration did

The migration `20261028120000_plan_limits`:

- added `Family.childLimit` and `Family.legacyLimits`;
- renamed "Family Pro" to "eGuard Family" on families and on broadcast plan lists, after first turning an older retired plan already called "eGuard Family" (treated as Free) into Free;
- set paying families to their old limits with `legacyLimits = true`, and every other family to 1 child and 1 device.

Families keep legacy limits for as long as they stay on a paid plan, upgrades included. Once they are back on Free, a later purchase gets the current limits. A move to a smaller plan never removes anything: children and devices over the limit stay protected, but no more can be added. Current plan limits are in "Products and Services Catalogue".

## Customer notice A (2026-10-28): paying families

Sent to families on eGuard Plus and eGuard Family. Subject: **Your eGuard plan keeps its limits**.

> Hi,
>
> We've changed eGuard's plans for new subscribers. Your plan stays as it is: the same price, and the same number of children and devices, for as long as you stay subscribed.
>
> What you have today:
> - eGuard Plus: up to 5 children and 10 devices
> - eGuard Family: up to 10 children and 20 devices
>
> Two other changes:
> - Family Pro is now called eGuard Family. It's the same plan at the same price.
> - Moving from eGuard Plus to eGuard Family keeps the larger limits too.
>
> If your subscription ends and you subscribe again later, the current limits apply. They're on our pricing page: https://www.eguard.family/pricing
>
> The eGuard team

## Customer notice B (2026-10-28): Free families

Sent to families on Free. Subject: **Changes to eGuard Free**. Prices are in Philippine pesos (₱).

> Hi,
>
> eGuard Free now covers 1 child and 1 device. A phone, a tablet, a computer and a browser each count as one device.
>
> If you already have more than one device paired, nothing is switched off. They all stay protected. To pair another, remove one first or move to a paid plan.
>
> What Free still includes:
> - Configuration Health, so you can check that eGuard's protections are in place, any time
> - screen time, bedtime and limits for up to 5 apps
> - an alert if eGuard is removed or tampered with. When it needs you to act, it now also comes as a push notification
>
> Alerts when a setting changes on your child's device are now part of eGuard Plus. You can still see every change in your child's history.
>
> If you need more:
> - eGuard Plus, ₱149 a month: 3 children and 5 devices, alerts when a setting changes, all apps, location
> - eGuard Family, ₱249 a month: 6 children and 12 devices, 30-day reports and CSV export
>
> Compare the plans: https://www.eguard.family/pricing
>
> The eGuard team

## Release procedure for a price change on the web

Web prices are server settings in pesos, the same for auto-renew and passes: `PRICE_PLUS_MONTHLY`, `PRICE_PRO_MONTHLY`, `PRICE_PLUS_YEARLY` and `PRICE_PRO_YEARLY`. The pricing page reads the same settings. A price change in these settings needs no code release.

1. **Owner:** decide the new price and confirm it applies to new subscribers only. Current prices are in "Products and Services Catalogue"; price rules and the planned price review are in "Pricing and Discount Rules".
2. **Engineer (hosting environment settings):** set the new value. An invalid value makes the server fail loudly instead of charging a wrong amount, so check the pricing page and Settings › Subscription load afterwards.
3. **Engineer:** check the effect. Passes use the new price immediately. Auto-renew needs one PayMongo plan per price: eGuard looks for a plan named like `eGuard Plus monthly 149.00 PHP` and creates it on first use, so the first new auto-renew at the new price creates a new PayMongo plan.
4. **Engineer:** confirm existing auto-renew subscribers are untouched. They stay on their old PayMongo plan and price; eGuard does not move anyone automatically.
5. **Person responsible for copy:** update any published price outside the code.
6. **Staff member (console):** send a customer notice if the owner decides one is needed. [TO CONFIRM: whether a price change for new subscribers needs a notice to existing parents]

## Release procedure for a price change on Google Play

Google Play billing is turned off: the apps show the plan but do not sell it, and Google Play is listed as free with no in-app products. The Google Play products exist for when billing is turned on: `eguard_plus` (eGuard Plus) and `eguard_pro` (eGuard Family); `eguard_family` is a legacy product that must stay active for existing subscribers but not be offered.

1. **Owner (Google Play Console):** create the new price as a **new price cohort** and keep existing subscribers on the legacy price, so nobody gets a "price increase" prompt.
2. **Owner (Google Play Console):** for yearly prices, make sure each product has a yearly base plan. The server reads the expiry from the purchase and needs no change for new base plans.

## Approvals required for a plan-change release

| What | Who approves | Limit |
|---|---|---|
| Any change to plan limits, entitlements, plan names or prices | Owner | Not applicable |
| Deploying the code and migration | [TO CONFIRM: release approver role] | Not applicable |
| Customer notice texts | [TO CONFIRM: approver role] | Not applicable |

## Exceptions to the plan-change release procedure

| Situation | What to do |
|---|---|
| The step 3 check shows unexpected rows | Do not send the notices. [TO CONFIRM: rollback steps, for example restoring the step 1 backup] |
| A feature is listed in the plan notes but not built (for example family-wide policies) | Do not add it to any plan card, help page or app until it ships. |
| A change mentions Windows PCs before eGuard for Windows ships | Do not publish it; the marketing site must not mention PCs until the agent ships. |
| A family is over its new limit | Nothing is switched off; the family cannot add more until it removes some or upgrades. |
| A parent with an expiring card on an old price | eGuard cannot change the card; the parent turns auto-renew off and on again after the paid period (and then pays the current price) or buys passes. |

## Outputs of a plan-change release and where they are recorded

| Output | Where it is recorded |
|---|---|
| The decision | "eguard: Decision Log" |
| Database backup | [TO CONFIRM: where backups are kept] |
| New plan definitions and migration | The code repository (`src/lib/plans.ts`, `prisma/migrations`) |
| Check results (steps 3 and 4) | [TO CONFIRM: where release check results are recorded] |
| New prices | Hosting environment settings; new PayMongo plans in the PayMongo dashboard |
| Customer notices | Console › Email and the console audit log (`broadcast.send`) |
| Store listings | Google Play Console |

## Time targets for a plan-change release

| Item | Target |
|---|---|
| Customer notices | Release day, after the step 3 check passes |
| Price review after eGuard for Windows leaves beta | 90 days after it leaves beta (see "Pricing and Discount Rules") |
| Notice period before a price change | [TO CONFIRM] |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | Products and Services Catalogue; Pricing and Discount Rules; eguard: Decision Log; Sending a Broadcast to Parents; Engineering Standards and Release Procedure; Systems Overview |

## Open questions

1. [TO CONFIRM: role responsible for store and social copy].
2. [TO CONFIRM: whether a price change for new subscribers needs a notice to existing parents].
3. [TO CONFIRM: release approver role] and [TO CONFIRM: approver role] for customer notice texts.
4. [TO CONFIRM: rollback steps, for example restoring the step 1 backup]. plan-change-2026-10.md gives no rollback.
5. [TO CONFIRM: where backups are kept] and [TO CONFIRM: where release check results are recorded].
6. [TO CONFIRM: notice period before a price change].
7. [TO CONFIRM: owner role], effective date and review date. Suggested: review every 3 months, because the SOP describes plans and prices.
8. Plan limits disagree across sources. Current (used here): subscriptions.md, profile.md, plan-change-2026-10.md: Free 1 child / 1 device; eGuard Plus 3 / 5; eGuard Family 6 / 12, with legacy limits 5/10 and 10/20. Out of date: faq.md "eGuard Plus … Up to 5", "eGuard Family … Up to 10"; facebook-page.md About "up to 10" (its Messenger FAQ says "up to 6"); features/children.md §6 "Free 1, Plus 5, Pro 10"; features/devices.md §6 "Free 2, Plus 10, Pro 20"; mobile-api.md `/subscription/plans` example Free `deviceLimit: 2`, Plus 5/10, Family 10/20. These files should be updated as part of step 6 of a limit release.
9. Price settings are listed differently. subscriptions.md §2 lists four price settings including `PRICE_PLUS_YEARLY` and `PRICE_PRO_YEARLY`; subscriptions.md §10 lists only "`PRICE_PLUS_MONTHLY`, `PRICE_PRO_MONTHLY`". pricing-desktop.md §7 plans the review as "`PRICE_PLUS_MONTHLY=179`, `PRICE_PRO_MONTHLY=299`", while §6 also names yearly prices of ₱1,790 and ₱2,990. Confirm that a price change sets the yearly settings too.
10. Google Play base plans disagree. app-listing.md §6 lists only "monthly, auto-renewing" base plans for `eguard_plus` and `eguard_pro`; subscriptions.md §2 says "each product needs a monthly and a yearly base plan", and pricing-desktop.md §7 lists yearly base plans as an owner task in Play Console. Confirm whether the yearly base plans exist.
11. The plan-change release asks for Google Play Console listing updates (plan-change-2026-10.md step 5) while subscriptions.md §14 says Google Play billing is turned off. Confirm whether the Play subscription products are published or only prepared.
12. The Google Play package name is [TO CONFIRM: Google Play package name]: app-listing.md and mobile-api.md give `app.eguard.android`; facebook-page.md links `com.devcom.eguard`.
13. pricing-desktop.md §2 says "A PC syncs every 5 minutes, like a phone"; desktop-agent-spec.md and mobile-api.md say computers sync every minute. Not used in this SOP, but pricing-desktop.md's cost notes rely on it.
14. Notice B says "a computer and a browser each count as one device", while pricing-desktop.md says a browser on a paired Windows PC takes no device slot (built 2026-10-23) and faq.md says "Chrome and Edge on one laptop count as two devices". [TO CONFIRM: whether a browser on a paired Windows PC takes a device slot]. Reuse the notice text only once this is settled.
