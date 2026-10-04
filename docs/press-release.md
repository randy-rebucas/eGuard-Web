# Press release and pitch: Philippine tech outlets

The pitch email and press release for announcing eGuard to Philippine tech media, ready to send with the press
kit. Fill the `{placeholders}` before sending. Everything else is checked against the live site and
[src/lib/plans.ts](../src/lib/plans.ts) as of 4 October 2026.

Ground rules (see [launch-visibility.md](launch-visibility.md#7-where-to-announce)):

- No user counts, ratings or "trusted by" claims until they're real.
- iPhone and iPad are **coming soon**. Don't let a headline say "Android and iOS".
- Push alerts are **coming soon**. Alerts today are email and in-app.
- Screenshots show the demo family only. No real child's name, photo or location.

---

## 1. Pitch email

Send one email per editor. Name the editor and their beat, keep it under 150 words, and paste the press release
below your signature rather than attaching it.

**Subject options**

- Filipino-made parental control app checks that settings actually stuck on the child's phone
- Before Christmas break screen time: a Leyte-built app that verifies parental controls
- "Saved" isn't "on": new PH app shows parents which phone settings really work

**Body**

> Hi {Editor first name},
>
> With Christmas break coming, a lot of Filipino parents will set screen-time limits on their kids' phones and
> assume they're working. Often they aren't: the phone was offline, an update reset a permission, or a child
> switched something off.
>
> eGuard, made by DevCom Digital Marketing Services in Baybay City, Leyte, is a parental control app that checks.
> Each setting is marked Verified only after the child's device confirms it, and parents are told when that
> changes. It's free for one child, paid plans start at ₱149 a month, and it takes GCash, Maya and QR Ph.
>
> The press release is below, and logos and screenshots are here: {press kit link}. I can set up a demo account
> for you, or arrange a short interview with {Founder name}.
>
> Thanks,
> {Your name}
> {Title}, DevCom Digital Marketing Services
> {Phone} · support@devcomdigital.com

**Angle by outlet type**

| Outlet | Lead with |
|---|---|
| Tech news (YugaTech, Unbox.ph, NoypiGeeks, GadgetMatch, Manila Bulletin Tech, Inquirer Technology, Philstar Tech, GMA News SciTech, Rappler Technology) | The verification loop: the device reports back what it actually has, and the parent sees Verified or Failed |
| Startup and business (BusinessMirror, BusinessWorld, Tech in Asia) | A provincial Leyte company building for Filipino families, with peso pricing and local payment methods |
| Parenting (Smart Parenting, Modern Parenting, theAsianparent Philippines) | Holiday screen time, and what parents can check in five minutes |

Check each outlet's current tech editor and tips address on its site before sending.

**Timing**

- Send Tuesday–Thursday morning.
- **Holiday angle:** pitch in late October to mid-November so it can run before Christmas break.
- **Other hooks later:** the iPhone app launch, Safer Internet Day (February), and the start of the school year
  (June).
- Follow up once, five working days later, with one new detail (a screenshot or a parent tip). Then stop.

---

## 2. Press release

**FOR IMMEDIATE RELEASE**

### Filipino-made parental control app eGuard shows parents whether phone settings are actually working

*Built in Leyte, the app marks a screen-time or bedtime rule "Verified" only once the child's device confirms it*

**BAYBAY CITY, Leyte, {Month day}, 2026.** DevCom Digital Marketing Services today launched **eGuard**
(www.eguard.family), a parental control app for families in the Philippines. It is built around a problem most
parental controls leave unsolved: parents can't tell whether the rules they set are actually running on their
child's phone.

Most parental control tools stop at "Saved." A setting can be saved and still not be on the device: the phone was
offline, a system update reset a permission, or someone switched it off. From the parent's side, nothing looks
different.

eGuard closes that gap with a verification loop. When a parent chooses a setting, such as a two-hour daily limit, a
9:30 PM bedtime or an age rating for apps, eGuard sends it to each of the child's devices. The device reports back
what it actually has. Only then does eGuard mark the setting **Verified**. If the device reports something else,
the parent sees **Failed** and what the device reported. eGuard checks again every time the device syncs, and sends
an email and in-app alert when something changes.

A **Configuration Health** score sums this up for each child across 10 protections. It measures the device's
settings, not the child's behavior.

"{Founder quote}," said {Founder name}, {title} of DevCom Digital Marketing Services.

**Made for Filipino families**

- **Free for one child**, with no card needed to start. eGuard Plus costs ₱149 a month for up to 5 children and
  adds location sharing and full app management. Family Pro costs ₱249 a month for up to 10 children and adds
  advanced reports and API access for schools and organizations.
- **Pay with GCash, Maya, QR Ph or a card**, either as a monthly subscription or as a one-month pass that doesn't
  renew.
- **Works on Android phones and tablets** through the eGuard app on Google Play, and on **Chrome, Edge and Firefox**
  through the eGuard browser extension, all managed from one web dashboard. The iPhone and iPad app is coming soon.
- **Free guides for parents** at www.eguard.family/learn: 100 articles on screen time, online safety,
  cyberbullying and popular apps.

**Privacy by design**

eGuard collects settings, screen-time totals and app names. It never collects messages, photos or browsing
content, shows no ads and sells no data. Parents can export or delete their family's data at any time. eGuard is
visible on the child's device, never hidden, and on Android, children 13 and older are asked to agree to
supervision. eGuard's privacy policy is written under the Data Privacy Act of 2012 (RA 10173).

**Availability**

eGuard is available now at **www.eguard.family**. Families can sign up for free and pair a child's Android device
in a few minutes.

**About DevCom Digital Marketing Services**

DevCom Digital Marketing Services is a digital company based in Baybay City, Leyte, Philippines. eGuard is its
parental control product.

**Media contact**

{Name}, {Title}
support@devcomdigital.com · {Phone}
Press kit (logos and screenshots): {press kit link}

\###

---

## 3. Before sending

- [ ] Founder name, title and quote filled in. The quote should sound like a person talking, say why eGuard exists,
      and make no claim the site doesn't make
- [ ] Release date and press kit link filled in; the link opens without sign-in
- [ ] Prices still match the [pricing page](https://www.eguard.family/pricing) (`PRICE_PLUS_MONTHLY` and
      `PRICE_PRO_MONTHLY` can override [plans.ts](../src/lib/plans.ts))
- [ ] Google Play link works, and the store listing is live in the Philippines
- [ ] A demo account ready for journalists who ask, using the demo family, not a real one
- [ ] Phone number on the media contact answers during work hours
- [ ] If the iPhone app has shipped by send date, update the availability lines and the subject options
