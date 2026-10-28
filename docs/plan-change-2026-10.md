# Plan change, 2026-10-28: release and customer notices

The new limits ([subscriptions.md › 2](subscriptions.md#2-plans-products-and-prices), `src/lib/plans.ts`):

| Plan | Before | From this release |
|---|---|---|
| Free | 1 child, 2 devices, alerts when a setting changes | 1 child, 1 device, no alerts when a setting changes |
| eGuard Plus (₱149) | 5 children, 10 devices | 3 children, 5 devices |
| eGuard Family (₱249, was "Family Pro") | 10 children, 20 devices | 6 children, 12 devices |

Families paying when the release goes out keep their old limits for as long as they stay on a paid plan, upgrades
included (`Family.legacyLimits`). Once they're back on Free, a later purchase gets the current limits.

## 1. Deploy

Ship the code and the migration together. Code without the migration fails on `Family.childLimit`, and the
migration without the code gives paying families the new, lower limits on their next store check.

1. Back up the production database.
2. Deploy. The release runs `prisma migrate deploy`, which applies `20261028120000_plan_limits`. That migration:
   - adds `Family.childLimit` and `Family.legacyLimits`
   - renames `Family Pro` to `eGuard Family` on families and on broadcast plan lists. The old retired plan that
     was already called "eGuard Family" (treated as Free) becomes `Free` first.
   - sets paying families to their old limits with `legacyLimits = true`, and every other family to 1 child / 1 device
3. Check, in this order:
   ```sql
   SELECT plan, "childLimit", "deviceLimit", "legacyLimits", count(*) FROM "Family" GROUP BY 1, 2, 3, 4 ORDER BY 1;
   ```
   Expect only `Free 1 1 f`, `eGuard Plus 5 10 t` and `eGuard Family 10 20 t`. No `Family Pro` rows should remain.
4. Free families now over the limit. They stay protected but can't add anything; this is who notice B is for:
   ```sql
   SELECT count(*) FROM "Family" f WHERE plan = 'Free'
     AND (SELECT count(*) FROM "Device" d WHERE d."familyId" = f.id) > 1;
   ```
5. In Google Play Console, rename the `eguard_pro` subscription's listing to "eGuard Family" and update its
   description to 6 children and 12 devices. Keep the product id. Do the same for any store or social copy outside
   `docs/`.

Checked before release: the migrations apply to an empty database and match `schema.prisma` exactly, and the
migration turns seeded families into the rows in step 3 (Free 2 devices → 1/1; Plus → 5/10 kept; Family Pro →
eGuard Family 10/20 kept; the retired plan → Free).

## 2. Customer notices

Send both from **Console › Broadcasts** as **Service** notices: limits are an account change, so they go to every
verified parent even with product updates turned off. Send them on release day, after step 3 checks out.

### A. Paying families: plans **eGuard Plus** and **eGuard Family**

**Subject:** Your eGuard plan keeps its limits

**Body:**

> Hi,
>
> We've changed eGuard's plans for new subscribers. Your plan stays as it is: the same price, and the same number of
> children and devices, for as long as you stay subscribed.
>
> What you have today:
> - eGuard Plus: up to 5 children and 10 devices
> - eGuard Family: up to 10 children and 20 devices
>
> Two other changes:
> - Family Pro is now called eGuard Family. It's the same plan at the same price.
> - Moving from eGuard Plus to eGuard Family keeps the larger limits too.
>
> If your subscription ends and you subscribe again later, the current limits apply. They're on our pricing page:
> https://www.eguard.family/pricing
>
> The eGuard team

### B. Free families: plan **Free**

**Subject:** Changes to eGuard Free

**Body:**

> Hi,
>
> eGuard Free now covers 1 child and 1 device. A phone, a tablet, a computer and a browser each count as one device.
>
> If you already have more than one device paired, nothing is switched off. They all stay protected. To pair
> another, remove one first or move to a paid plan.
>
> What Free still includes:
> - Configuration Health, so you can check that eGuard's protections are in place, any time
> - screen time, bedtime and limits for up to 5 apps
> - an alert if eGuard is removed or tampered with. When it needs you to act, it now also comes as a push
>   notification
>
> Alerts when a setting changes on your child's device are now part of eGuard Plus. You can still see every change
> in your child's history.
>
> If you need more:
> - eGuard Plus, ₱149 a month: 3 children and 5 devices, alerts when a setting changes, all apps, location
> - eGuard Family, ₱249 a month: 6 children and 12 devices, 30-day reports and CSV export
>
> Compare the plans: https://www.eguard.family/pricing
>
> The eGuard team
