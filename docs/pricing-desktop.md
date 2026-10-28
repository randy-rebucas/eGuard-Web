# Pricing with Windows PCs

How eGuard's plans and prices change now that a child's Windows PC can be a protected device
([desktop-agent-spec.md](desktop-agent-spec.md)).

**Status:** the owner accepted the recommendations on 2026-10-23. Built that day: the yearly plans (checked against
PayMongo test mode: a yearly plan's first invoice is ₱1,490), browsers on a PC taking no device slot
([section 7](#7-what-changes-in-the-code-and-on-the-site)), and the launch offer, off until `PC_LAUNCH_OFFER_UNTIL` is set.

**Superseded in part, 2026-10-28:** the owner changed the limits to Free 1 child / 1 device, eGuard Plus 3 / 5 and
eGuard Family (the ₱249 plan, renamed from Family Pro) 6 / 12, with alerts when a setting changes on Plus and up only
(`driftAlerts`). Families subscribed before then keep their limits while subscribed. The device counts below (Free's
2 slots: one phone and one PC) are from before that: on Free a family now fits one phone **or** one PC. Tamper and
removal alerts stay on Free, as section 3 recommends.

**Written:** 2026-10-23. **Current plans:** [subscriptions.md › 2](subscriptions.md#2-plans-products-and-prices),
[src/lib/plans.ts](../src/lib/plans.ts).

## The short version

1. **Windows is included in every plan.** There's no PC add-on and no new tier.
2. **Prices stay ₱149 and ₱249 a month while the PC agent is new.** Annual plans are added now (two months free).
3. **Fix the device count first.** Today a PC plus its browsers takes 2 or 3 of Free's 2 slots, so a free family
   with one phone and one PC can't use the extension at all.
4. **Upsell with "Gaming time" across phone and PC.** Category limits are already Plus only, and a single limit that
   covers Roblox on the phone and CS2 on the PC is the clearest reason to pay.
5. **After 90 days of the agent being generally available, review the prices.** If the numbers in
   [section 6](#6-when-to-raise-prices) are met, new subscribers pay ₱179 and ₱299. Everyone already subscribed keeps
   their price.

## 1. Where eGuard stands

| | Price | Per month in pesos (approx.) | PCs |
|---|---|---|---|
| **eGuard Plus** | ₱149 / month | ₱149 | Included (this proposal) |
| **eGuard Family** | ₱249 / month | ₱249 | Included (this proposal) |
| Qustodio Basic | $59.95 / year | about ₱290 | Yes |
| Qustodio Complete | $104.95 / year, unlimited devices | about ₱510 | Yes |
| Microsoft Family Safety | Free with a Microsoft account | ₱0 | Windows and Xbox app and game limits |

The peso amounts assume about ₱58 to the dollar. Qustodio prices are from its US pages in October 2026. Check them
again before any public comparison.

What this means:
- **eGuard is already the low-price option.** Plus costs about half of Qustodio Basic. Adding PCs makes that gap
  larger, which is a strength in the Philippine market, so prices don't need to rise to "pay for" PCs.
- **Microsoft Family Safety is the real rival on a PC, and it's free.** eGuard can't charge for "limits on a PC"
  alone. What it can charge for is what Microsoft doesn't do:
  - one dashboard for Android, iPhone and the PC
  - one gaming limit across all of them
  - protections that are checked, not assumed
  - an agent the child can't remove
  - alerts when someone tries
  - working without moving the child to a Microsoft account

## 2. What PCs should cost to run

| Cost | Rough size | Notes |
|---|---|---|
| Code signing | About $10 a month (Azure Trusted Signing), or $200–400 a year (OV certificate) | Needed before launch, or Windows warns on every install |
| Server load | Small | A PC syncs every 5 minutes, like a phone. Removal and extra time sync every minute, but only for a short time |
| Support | The biggest real cost | PC questions (admin accounts, shared PCs, games that won't close) take longer than phone ones |
| Catalog upkeep | A few hours a month | Adding newly popular games to the catalog |

All of this is covered by a handful of extra Plus subscribers a month. **PCs don't need their own price.**

## 3. What each plan gets on a PC

Use the existing limits as they are. Nothing PC-only needs a new entitlement.

| On a PC | Free | eGuard Plus | eGuard Family |
|---|---|---|---|
| Pair a Windows PC | Yes, as its one device (a phone **or** a PC) | Yes | Yes |
| Daily screen time, bedtime, extra time | Yes | Yes | Yes |
| Uninstall protection and tamper alerts | Yes | Yes | Yes |
| App scan (games and unverified publishers) | Yes | Yes | Yes |
| Apps the parent can see and manage | 5, as on phones | All | All |
| Block or limit a game | The 5 shown | All | All |
| **Gaming time across phone and PC** (category limits) | No | **Yes** | Yes |
| Alerts as push notifications | Security alerts only (removed, tampered with, protection off) | Every alert | Every alert |
| 30-day reports and CSV export | No | No | Yes |

Why tamper protection is on Free:
- An eGuard that a child can uninstall would make the whole product look weak.
- An alert that goes unseen costs a family's trust more than it earns in upgrades.

## 4. Device slots: change before launch

`usedDeviceSlots` ([device-slots.ts](../src/lib/device-slots.ts)) counts every device plus every browser. The agent
forces the eGuard extension into Chrome, Edge and Firefox (spec section 9), so one PC can take up to 4 slots:

| Family | Today | Proposed |
|---|---|---|
| Free: 1 phone and 1 PC with Chrome | 3 of 2 (**blocked**) | 2 of 2 |
| Plus: 2 phones, 1 PC with Chrome and Edge | 5 of 10 | 3 of 10 |

**Proposal:** a browser on a paired PC is part of that PC and doesn't take a slot. A browser on a computer with no
agent (a Mac or a school laptop) still takes one, as today.

**How to build it:**
- The agent passes the extension a managed policy with its device id when it forces the install.
- The extension sends it on `/browser/v1/pair`.
- The server stores it as `BrowserInstallation.deviceId`.
- `usedDeviceSlots` counts only browsers whose `deviceId` is null.
- When the PC is removed, its browsers are removed with it.

With this change the device limits (2, 10 and 20 then; 1, 5 and 12 since 2026-10-28) don't need to grow for PCs.

## 5. Prices

**At launch, while the agent is in beta:**

| Product | Today | Proposed |
|---|---|---|
| Plus, monthly (auto-renew or pass) | ₱149 | ₱149 |
| Pro, monthly | ₱249 | ₱249 |
| Plus, **yearly** | – | **₱1,490** (two months free) |
| Pro, **yearly** | – | **₱2,490** (two months free) |

Why prices don't rise at launch:
- The agent is unproven.
- The first installers may show SmartScreen warnings.
- Charging more for a feature that isn't proven yet leads to refunds and bad reviews.

Why yearly plans now:
- They keep families through the months when a child isn't gaming.
- They pay for code signing up front.
- The code already handles yearly periods for the old `family_yearly` product.

**Launch offer (optional):** a family that pairs its first PC on Free gets one month of Plus once. Sponsor codes
already grant months of a plan (organizations). Check whether they can be issued to a family directly before
building anything new.

## 6. When to raise prices

Review 90 days after the agent leaves beta. Raise prices for **new subscribers only** to **Plus ₱179** and
**Pro ₱299** (yearly ₱1,790 and ₱2,990) if all of these hold:

- At least 25% of paying families have paired a PC.
- Free-to-Plus conversion among families with a PC is at least 1.5 times that of families without one.
- Monthly churn among families with a PC is no worse than among those without.
- Fewer than 5% of PCs show uninstall or tamper alerts that turned out to be eGuard's fault.

If conversion rises but churn also rises, hold the price and fix the product first.

**Existing subscribers keep their price.**
- On the web this already happens: a new price creates a new PayMongo plan, and existing subscriptions stay on
  theirs (subscriptions.md › Prices).
- On Google Play, create the higher price as a new price cohort and keep existing subscribers on the legacy price,
  so nobody gets a "price increase" prompt.

## 7. What changes in the code and on the site

| When | Change | Where | Status |
|---|---|---|---|
| Before launch | PC browsers don't take slots | `src/lib/browser-link.ts`, `device-slots.ts`, `browser-service.ts`, `createPairingCode`, `moveDevice`, migration `20261023120000_browser_on_computer` | **Done 2026-10-23.** The extension (eguard-browser) still has to read `deviceLink` from its managed policy and send it on `/pair` |
| Before launch | Yearly products: auto-renew and passes, `PRICE_PLUS_YEARLY` and `PRICE_PRO_YEARLY` | `plans.ts`, `web-billing.ts`, `paymongo.ts` (`interval: "yearly"`), `billing.tsx`, `checkout.tsx`, `/pricing` | **Done 2026-10-23.** PayMongo test mode accepts the yearly plan (₱1,490 first invoice) |
| Before launch | Google Play yearly base plans on `eguard_plus` and `eguard_pro` | Play Console (no server change) | Owner, in Play Console |
| **At launch, not before** | Pricing cards add "Windows PCs and games" to every plan, and "Gaming time across phone and PC" to Plus | `plans.ts` `features`, landing page, `/download/windows` | Waits for the agent |
| At launch | Free's card says "Windows PC: time limits and 5 apps" | `plans.ts` | Waits for the agent |
| After 90 days | `PRICE_PLUS_MONTHLY=179`, `PRICE_PRO_MONTHLY=299` (env, no release), plus the Play price cohorts | env, Play Console | If section 6 holds |

The marketing site must not mention PCs until the agent ships (desktop-agent-spec.md › 13).

## 8. Decisions for the owner

1. **Include PCs in every plan, with no add-on?** Recommended: yes.
2. **Tamper protection on Free?** Recommended: yes.
3. **Hold prices at launch and add yearly plans at two months free?** Recommended: yes.
4. **The PC launch offer (one month of Plus)?** **Built 2026-10-23**, off until `PC_LAUNCH_OFFER_UNTIL` is set.
   Sponsor codes belong to an organization's paid batch, so it's eGuard's own `PROMO` purchase instead
   (subscriptions.md › Windows launch offer).
5. **The 90-day price review and its thresholds?** Recommended as written. Change the numbers if your current
   conversion and churn data say otherwise. Since 2026-10-28 a Free family can't have a phone and a PC, so compare
   conversion from the 2026-10-28 cohort on, not with families who signed up on the old 2-device Free.
