# Facebook Page setup

Everything to fill in on the eGuard Facebook Page so it reaches **100% Page completeness**: name, category, bio,
contact details, address, action button, photos and the first posts. Copy is ready to paste; character counts are
given where Facebook sets a limit.

This builds on [launch-visibility.md](launch-visibility.md), which covers the website and the 30-day plan. The same
rules apply here: only claim what's true today.

- Android is on Google Play; **iPhone and iPad are coming soon**.
- Push alerts are included with eGuard Plus and Family Pro, in the eGuard parent app. Every plan gets email and
  in-app alerts.
- No ratings, user counts or "trusted by" lines until they're real.
- The Page is for **parents**. Meta doesn't allow Pages or ads directed at children, so nothing on it speaks to kids.

## Contents

1. [Page identity](#1-page-identity)
2. [Bio](#2-bio)
3. [Contact details](#3-contact-details)
4. [Address and service area](#4-address-and-service-area)
5. [Action button](#5-action-button)
6. [Photos](#6-photos)
7. [More details](#7-more-details)
8. [First posts](#8-first-posts)
9. [Checklist](#9-checklist)

---

## 1. Page identity

| Field | Value | Notes |
|---|---|---|
| Page name | **eGuard** | Keep it short and the same as the app and the site. Don't add "Official" or keywords: Meta rejects names that look like ads |
| Username | **@eguardfamily** | Matches the domain `eguard.family`. Fallbacks: `@eguardph`, `@eguardapp`. Gives the Page `facebook.com/eguardfamily` |
| Category 1 | **App Page** | The main thing people get from us |
| Category 2 | **Software Company** | |
| Category 3 | **Internet Company** | Optional. Facebook allows up to three |
| Page owner | DevCom Digital Marketing Services | Create the Page from a Business Portfolio (Meta Business Suite) owned by DevCom, not from one person's profile, so access survives staff changes. Add at least two admins |

---

## 2. Bio

Facebook's Page bio (the intro under the name) allows **101 characters**. Pick one:

| Option | Text | Chars |
|---|---|---|
| **A (recommended)** | Parental controls you can verify. Screen time, bedtime and app rules for Filipino families. | 91 |
| B | Set screen time and app rules on your child's phone, and see each one confirmed. Free for 1 child. | 98 |
| C (Filipino) | Parental controls na sigurado kang gumagana. Para sa mga pamilyang Pilipino. Libre para sa 1 anak. | 98 |

Option A matches the site title ("Parental controls you can verify, for families in the Philippines"), so search
results, link previews and the Page all say the same thing.

### About (longer description)

Some Page layouts show a longer **Details / About** text. Use this one:

> eGuard helps parents set up screen time, bedtime, app and web protections on their children's phones and tablets,
> then shows whether each one is actually working.
>
> Most parental controls stop at "Saved." But a setting can be saved and still not be on the phone: the device was
> offline, an update reset a permission, or someone switched it off. eGuard checks each device and tells you what's
> verified, what needs attention, and what to fix.
>
> • Works on Android phones and tablets (Google Play) and in Chrome, Edge and Firefox. iPhone and iPad coming soon.
> • Free for 1 child and 2 devices. eGuard Plus is ₱149 a month for up to 5 children; Family Pro is ₱249 a month for
>   up to 10.
> • Made in Baybay City, Leyte by DevCom Digital Marketing Services.
>
> Start free: https://www.eguard.family

Before posting, check the prices still match the [pricing page](https://www.eguard.family/pricing)
(`PRICE_PLUS_MONTHLY` and `PRICE_PRO_MONTHLY` can override [plans.ts](../src/lib/plans.ts)).

---

## 3. Contact details

| Field | Value | Notes |
|---|---|---|
| Website | `https://www.eguard.family` | The production domain. Add `?utm_source=facebook&utm_medium=page` if you want Page visits split out in analytics |
| Email | `support@devcomdigital.com` | The inbox someone reads, and the one the privacy policy and terms name ([legal.ts](../src/lib/legal.ts)). Don't use an `@eguard.family` address yet: the domain has no MX record, so it can't receive mail (see [launch-visibility.md § 3](launch-visibility.md#3-domain-and-email)) |
| Phone | **{Phone}**, in `+63 9XX XXX XXXX` format | Still to decide. Use a business mobile, not a personal one: it's public and Facebook may text it to confirm. Only add it if someone answers it during work hours; otherwise leave it off and rely on Messenger. Use the same number as the press release's media contact ([press-release.md](press-release.md)) |
| Messenger | On | Turn on an instant reply and FAQs (below) so parents aren't left waiting |
| Other accounts | Google Play listing | `https://play.google.com/store/apps/details?id=com.devcom.eguard`. Add TikTok or YouTube here once they exist |

### Messenger instant reply

> Hi! Thanks for messaging eGuard. We usually reply within a working day. For help setting up, see
> https://www.eguard.family/help. To start free, go to https://www.eguard.family/register.

### Messenger FAQs (up to 4)

| Question | Answer |
|---|---|
| How much does eGuard cost? | Free for 1 child and 2 devices. eGuard Plus is ₱149/month (up to 5 children) and Family Pro is ₱249/month (up to 10). See https://www.eguard.family/pricing |
| Does it work on iPhone? | Not yet. Android phones and tablets work now through Google Play, and Chrome, Edge and Firefox through the browser extension. The iPhone and iPad app is coming soon. |
| How do I set it up? | Make a free account at https://www.eguard.family/register, add your child, then install eGuard from Google Play on their phone and enter the pairing code. |
| Can my child see what I see? | eGuard tells your child what's on and what you can see. There's a page for them at https://www.eguard.family/for-kids |

---

## 4. Address and service area

Facebook lets a Page show a street address, a service area, or both.

| Field | Value |
|---|---|
| Address | Brgy. Hipusngo, Baybay City, Leyte 6521, Philippines |
| Service area | Philippines |
| Show address on Page | **Yes**, recommended |
| Hours | **Always open** for the app, or set office hours (for example Mon–Fri, 9:00–17:00) if you add a phone number |

The address is already public in the privacy policy and terms, and a real, findable address is a trust signal for
parents deciding whether to let an app onto their child's phone. If you'd rather not show it, choose **service area
only** ("Philippines"): the Page still counts as complete, and the legal pages keep the address for anyone who needs
it.

---

## 5. Action button

The blue button under the cover photo. Pick **one**.

| Button | Goes to | Good for | Verdict |
|---|---|---|---|
| **Sign up** | `https://www.eguard.family/register?utm_source=facebook&utm_medium=page&utm_campaign=page_button` | Turning Page visitors into accounts. The free plan needs no card, so it's a small step | **Recommended** |
| Use app | Google Play listing | Parents already on their child's Android phone | Second choice. It skips the parent account, which they need first to get a pairing code |
| Send message | Messenger | Questions before signing up | Only if someone checks Messenger every day. Messenger is still reachable from the Page without the button |
| Learn more | `https://www.eguard.family` | Awareness | Weaker: one more click before anything happens |
| Call now | Phone | — | Not until there's a staffed number |

Set it in **Page › Edit action button › Sign up**. After a month, compare clicks in Page insights against
sign-ups with `utm_source=facebook`, and try **Use app** if clicks are high but sign-ups aren't. Note the Meta Pixel
never runs on `/register` or other sign-in pages (see [privacy](../src/app/%28site%29/privacy/page.tsx)), so
measure button sign-ups with the UTM tag, not the pixel.

---

## 6. Photos

| Asset | Size | Source | Notes |
|---|---|---|---|
| Profile picture | 720 × 720 (shown as a circle, at least 320) | [public/brand/logo-mark-512.png](../public/brand/logo-mark-512.png) or [app-icon-1024.png](../public/brand/app-icon-1024.png) | Use the mark alone, centred with padding, so the circle crop doesn't cut it. Same icon as Google Play |
| Cover photo | 1640 × 856 (shows about 1640 × 624 on desktop) | New, from the landing art in [public/landing](../public/landing) | Logo, the line "Parental controls you can verify", and a phone showing a verified protection. Keep text and the phone in the centre: mobile crops the sides |

Screenshots in photos and posts show the demo family only: no real child's name, photo or location.

---

## 7. More details

| Field | Value |
|---|---|
| Founded / Started | 2026 (Launched) |
| Price range | ₱ (Free plan, paid from ₱149/month) |
| Products | eGuard parent dashboard (web), eGuard for Android, eGuard browser extension (Chrome, Edge, Firefox) |
| Privacy policy | `https://www.eguard.family/privacy` |
| Language | English, Filipino |
| Page transparency | Leave on. It shows the Page is run from the Philippines, which helps |

---

## 8. First posts

A Page with no posts looks abandoned. Publish these in the first week, before inviting anyone:

1. **Pinned intro post.** What eGuard is, the "Saved isn't on" problem, free for 1 child, link to the site.
   Pin it to the top of the Page.
2. **How it works.** Three steps (add a child, install on their phone, see what's verified) with a screenshot from
   [/how-it-works](https://www.eguard.family/how-it-works).
3. **A Knowledge Center guide.** Share one useful guide from [/learn](https://www.eguard.family/learn), such as
   Facebook privacy settings for teens. Helpful posts get shared in parent groups; ads for the app don't.

Each shared link uses the page's own share image. Check one in the Facebook Sharing Debugger first, as in
[launch-visibility.md](launch-visibility.md).

---

## 9. Checklist

- [ ] Business Portfolio created for DevCom; Page created from it, with two admins
- [ ] Name **eGuard**, username **@eguardfamily**
- [ ] Categories: App Page, Software Company, Internet Company
- [ ] Bio (option A, 91 characters) and the longer About text
- [ ] Website `https://www.eguard.family`
- [ ] Email `support@devcomdigital.com`
- [ ] Phone: business mobile decided, added, and answered during work hours (or deliberately left off)
- [ ] Address shown, or service area "Philippines"
- [ ] Hours set
- [ ] Action button **Sign up** to `/register` with UTM tags
- [ ] Messenger instant reply and FAQs on
- [ ] Google Play listing linked
- [ ] Profile picture and cover photo uploaded, checked on a phone
- [ ] Prices in the About text match the pricing page
- [ ] Three first posts published, intro post pinned
- [ ] Page link added to the site footer once it's live (the social icons were removed until accounts existed; see
      [site-chrome.tsx](../src/components/site-chrome.tsx))
