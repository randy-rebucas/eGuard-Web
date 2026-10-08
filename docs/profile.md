# eGuard profile

A one-page overview of eGuard for partners, schools, journalists and anyone who asks "what is eGuard?". Facts are
checked against the code and the launch docs as of 7 October 2026. 

---

## At a glance

| | |
|---|---|
| **Product** | eGuard, parental controls you can verify |
| **Website** | [www.eguard.family](https://www.eguard.family) |
| **Company** | DevCom Digital Marketing Services |
| **Based in** | Brgy. Hipusngo, Baybay City, Leyte 6521, Philippines |
| **Market** | Families in the Philippines (prices in pesos, local payment methods) |
| **Platforms** | Android phones and tablets (Google Play); Chrome, Edge and Firefox (browser extension); parent web dashboard. iPhone and iPad coming soon |
| **Price** | Free for 1 child. Paid plans from ₱149 a month |
| **Contact** | support@devcomdigital.com |
| **Facebook** | @eguardfamily |

---

## What eGuard is

eGuard helps parents set up screen time, bedtime, app and web protections on their children's phones, tablets and
browsers, then shows whether each one is actually working.

Most parental controls stop at "Saved." But a setting can be saved and still not be on the device: the phone was
offline, a system update reset a permission, or someone switched it off. From the parent's side, nothing looks
different.

eGuard closes that gap. It sends each setting to the child's device, and the device reports back what it actually
has. Only then does eGuard mark the setting **Verified**. If the device reports something else, the parent sees
**Failed** and what the device reported. eGuard checks again every time the device syncs, and tells the parent when
something changes.

---

## How it works

1. **Add your child.** Pick a profile (Protected, Balanced or Custom) and eGuard suggests settings for the child's
   age.
2. **Pair the device.** Install eGuard on the child's phone or tablet, or the extension in their browser, and enter
   the one-time pairing code.
3. **eGuard applies and checks each setting.** Where Android allows it, eGuard applies the setting directly. Where it
   doesn't, eGuard walks the parent through the steps on the device. Either way, the setting counts only once the
   device confirms it.
4. **Stay informed.** Parents get an alert when a protection is turned off, a device stops checking in, a limit is
   reached, a new app is installed or an app is waiting for approval. Each alert links to the fix.

---

## The 10 protections

| Protection | What it does |
|---|---|
| Screen Time | Daily limit, with a separate weekend limit |
| Bedtime | Pauses the device overnight, every day or on school nights |
| App Restrictions | Limits apps by age rating; per-app daily limits and blocking |
| App Approval | The child asks for an app; the parent approves or declines |
| Content Restrictions | Age ratings for movies, TV and books |
| Web Filtering | Blocks adult sites, or allows only the sites the parent chooses |
| Downloads | Requires the parent's approval to install apps |
| Location | Shows where the child's device is now |
| Notification Controls | Keeps the device quiet during bedtime |
| Uninstall Protection | Stops eGuard from being removed without the parent |

### Configuration Health

One score per child sums up these 10 checks, each based on what the child's devices report. It measures how the
devices are **configured**, never the child's behavior. If a platform doesn't allow a protection, that check is
never counted against the score.

### Browser protection

The eGuard extension for Chrome, Edge and Firefox applies the child's browser rules: Safe Browsing, SafeSearch,
blocked categories, blocked and allowed sites, and focus hours. When a site is blocked, the child can ask a parent
to open it, for 15 minutes, an hour, today or always. Every browser rule set is digitally signed, so the extension
only enforces rules that really came from eGuard.

---

## Plans

| Plan | Price | Children | Devices | Includes |
|---|---|---|---|---|
| **Free** | ₱0 | 1 | 2 | Basic protection setup, screen time, limited app monitoring |
| **eGuard Plus** | ₱149/month | 5 | 10 | All protections, configuration verification, location sharing |
| **Family Pro** | ₱249/month | 10 | 20 | Everything in Plus, advanced reports, API access |

- Phones, tablets and browsers all count as devices.
- No card needed to start.
- Pay with **GCash, Maya, QR Ph or a card**, as a monthly subscription (card or Maya) or as a one-month pass that
  doesn't renew. eGuard emails a reminder 3 days before a pass ends.
- Plans are bought on the web at [www.eguard.family](https://www.eguard.family). The apps show the plan but don't
  sell it.

Check prices against the [pricing page](https://www.eguard.family/pricing) before quoting them;
`PRICE_PLUS_MONTHLY` and `PRICE_PRO_MONTHLY` can override [plans.ts](../src/lib/plans.ts).

---

## For schools and organizations

Schools, community groups and businesses can set up an eGuard **organization**:

- **Join code.** Families enter the organization's code to join it.
- **Sponsor codes.** The organization buys codes in batches, and each one gives a family a paid plan (eGuard Plus or
  Family Pro) for a set number of months: 1, 3, 6 or 12. Up to 200 codes per batch, and each code can be redeemed
  within 12 months.
- **Volume discounts.** The more codes in a batch, the less each one costs:

  | Codes in the batch | Discount | Example: eGuard Plus, 12 months |
  |---|---|---|
  | 1–9 | none | ₱1,788 per code |
  | 10–49 | 10% off | ₱1,609.20 per code |
  | 50–99 | 15% off | ₱1,519.80 per code (50 codes: ₱75,990, saving ₱13,410) |
  | 100–200 | 20% off | ₱1,430.40 per code |

- **Counts only.** The organization sees how many families joined and redeemed codes, **never a family's data**.
- **Organization API.** With Family Pro, an organization's own systems can read the same counts with an API key.

---

## Privacy

- eGuard collects settings, screen-time totals and app names. It **never** reads messages, photos or browsing
  content.
- The browser extension reports how many pages it blocked, never which sites or URLs.
- Only the current location is kept. Location history is off unless the family turns it on.
- Activity is deleted automatically after 90 days.
- Parents can export or delete their family's data at any time.
- No ads, and no data is sold.
- eGuard is visible on the child's device, never hidden. On Android it shows a notification whenever it's active,
  and there's a page written for children at [eguard.family/for-kids](https://www.eguard.family/for-kids).
- The privacy policy is written under the Data Privacy Act of 2012 (RA 10173).

---

## Help for parents

- **Help Center** at [eguard.family/help](https://www.eguard.family/help): setup and troubleshooting articles.
- **Learn** at [eguard.family/learn](https://www.eguard.family/learn): 100 free guides on screen time, online safety,
  cyberbullying and popular apps.
- **Support** by email at support@devcomdigital.com, or Messenger on the Facebook Page.

---

## Coming soon

- The iPhone and iPad app

---

## About DevCom Digital Marketing Services

DevCom Digital Marketing Services is a digital company based in Baybay City, Leyte, Philippines. eGuard is its
parental control product, built for Filipino families: peso pricing, local payment methods and a privacy policy
written under Philippine law.
