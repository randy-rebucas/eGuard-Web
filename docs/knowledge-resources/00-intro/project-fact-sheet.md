# Project fact sheet: eguard

Filled from the files in `docs/` (except `docs/prompt-resources/`) on 2026-11-10. Each line names its source. Lines marked [TO CONFIRM] are not answered by the sources. Contradictions between sources are listed in [../_review/source-inventory.md](../_review/source-inventory.md).

```text
PROJECT FACT SHEET
Date written: 2026-11-10 (source: date of this draft)
Company name: DevCom Digital Marketing Services (source: profile.md, press-release.md)
What the company does (2-3 sentences): DevCom Digital Marketing Services is a digital company based in Baybay City, Leyte, Philippines. eGuard is its parental control product, built for Filipino families with peso pricing, local payment methods and a privacy policy written under Philippine law. eGuard lets parents set screen time, bedtime, app and web protections on their children's devices and shows whether each one is actually applied on the device ("Verified" or "Failed"). (source: profile.md, press-release.md) [TO CONFIRM: whether DevCom does any work other than eGuard]
Industry, market and regions served: Consumer parental control software; families in the Philippines; Facebook Page service area "Philippines"; prices in Philippine pesos (source: profile.md, facebook-page.md, launch-visibility.md)
Customers (who buys, typical size, how they buy): Parents and guardians aged 18 and over; the subscription belongs to the family and only the family admin can buy or cancel; all plans are bought on the web at www.eguard.family (Settings › Subscription) through PayMongo, the apps show the plan but do not sell it. Schools, community groups and businesses buy sponsor-code batches for families through an organization. (source: subscriptions.md, mobile-api.md, organizations.md, profile.md) Typical size: [TO CONFIRM: typical number of children and devices per paying family; number of customers]
Products or services (name: one-line description: public price if any):
  - Free: 1 child, 1 device, all 10 protections, Configuration Health, tamper and removal alerts: ₱0 (source: subscriptions.md, profile.md)
  - eGuard Plus: 3 children, 5 devices, alerts when a setting changes, push for every alert, every app, category limits, location sharing: ₱149 a month or ₱1,490 a year (source: subscriptions.md, profile.md)
  - eGuard Family (formerly "Family Pro"): 6 children, 12 devices, everything in Plus, 30-day reports and CSV export, Organization API access: ₱249 a month or ₱2,490 a year (source: subscriptions.md, plan-change-2026-10.md)
  - Sponsor codes for organizations: a paid plan for a family for 1, 3, 6 or 12 months, 1–200 codes per batch, volume discounts of 10%, 15% or 20%: months × monthly web price × quantity (source: organizations.md, profile.md)
  - eGuard for Android (phones and tablets, Google Play), eGuard browser extension (Chrome, Edge, Firefox), parent web dashboard: included in every plan (source: profile.md, faq.md)
  - eGuard for Windows: in testing, no release date; to be included in every plan with no add-on (source: faq.md, pricing-desktop.md)
  - eGuard for iPhone and iPad: coming soon (source: faq.md, profile.md)
  - Knowledge Center (/learn): 100 free guides for parents in 11 topics: free (source: knowledge-center.md)
Company departments (name: what they do): [TO CONFIRM: departments and teams. Sources mention only "staff" who use the console, a support inbox, and "the owner" who makes product and pricing decisions (source: console.md, pricing-desktop.md)]
AI employees and people involved (name or role: responsibility):
  - Owner: accepts or rejects product, pricing and engineering recommendations (source: pricing-desktop.md, desktop-agent-spec.md) [TO CONFIRM: name and title]
  - Founder: quoted in press material (source: press-release.md) [TO CONFIRM: name, title, and whether this is the same person as the owner]
  - Staff: use the console for families, tickets, organizations, broadcasts and Parent care; no staff roles in v1 (source: console.md)
  - Data Protection Officer: contact for privacy requests; not yet named with the National Privacy Commission (source: launch-visibility.md, app-listing.md) [TO CONFIRM: name]
  - Family admin and parent (customer roles); organization owner and admin (customer roles) (source: mobile-api.md, organizations.md)
  - [TO CONFIRM: any AI employees and which documents they should see]
Tools and systems used (CRM, email, ticketing, code hosting, accounting...): Vercel (hosting, cron every 10 minutes); Next.js 16 with PostgreSQL and Prisma; PayMongo (payments); Resend or SMTP (email), Mailpit (test email); Firebase Cloud Messaging (push); MapTiler (map tiles); Google reCAPTCHA v3 and Have I Been Pwned (sign-in protection); eGuard console at console.eguard.family (families, support tickets, organizations, broadcasts, audit log); Anthropic Claude or OpenAI for "Write with AI" broadcast drafts; Google Play Console; Google Search Console and Bing Webmaster Tools; Meta Business Suite (Facebook Page); support inbox support@devcomdigital.com (source: launch-visibility.md, features/parent-care.md, subscriptions.md, console.md, features/location.md, features/authentication.md, mobile-api.md, facebook-page.md) [TO CONFIRM: code hosting, accounting and any CRM]
Currency, time zone and working hours: Philippine peso (₱, PHP); Asia/Manila (Philippine time); support "replies within 1 business day" (source: subscriptions.md, organization-api.md, console.md, mobile-api.md) [TO CONFIRM: working hours]

Project name: eguard (source: owner's instructions)
Project goal (one sentence): [TO CONFIRM]
Business problem it solves / why now: Parents cannot tell whether the rules they set are actually running on their child's phone; most parental controls stop at "Saved", while a setting can be saved and still not be on the device (source: press-release.md, profile.md). Why now: [TO CONFIRM]
In scope: [TO CONFIRM]
Out of scope: [TO CONFIRM]
Deliverables: [TO CONFIRM]
Key dates and deadline:
  - 2026-10-23: owner accepted the Windows pricing recommendations; yearly plans built (source: pricing-desktop.md)
  - 2026-10-28: plan-limit change released (source: plan-change-2026-10.md)
  - 2026-11-14: old sign-in cookie stops being read; remove the legacy code after that (source: features/authentication.md)
  - 90 days after eGuard for Windows leaves beta: price review (source: pricing-desktop.md)
  - Every six months from 4 October 2026: re-check Knowledge Center facts (source: knowledge-center.md)
  - [TO CONFIRM: project deadline; Windows release date; iPhone release date]
Budget or cost limits: Code-signing certificate about $200–500 a year (source: code-signing.md) [TO CONFIRM: project budget and spending limits]
Customers, partners or suppliers involved: PayMongo, Google Play, Apple App Store, Vercel, Resend, Firebase, MapTiler, Dun & Bradstreet (D-U-N-S), a code-signing provider (Certum, SSL.com or DigiCert under consideration) (source: subscriptions.md, app-listing.md, launch-visibility.md, code-signing.md) [TO CONFIRM: named school or community partners]
Success measures (how we know it worked):
  - Funnel: landing visit → account → email verified → first child → first device paired → upgrade (source: launch-visibility.md)
  - Price-review thresholds for Windows: at least 25% of paying families pair a PC; Free-to-Plus conversion with a PC at least 1.5 times that without; churn with a PC no worse; fewer than 5% of PCs with tamper alerts that were eGuard's fault (source: pricing-desktop.md)
  - Parent care pilot hypotheses: +10% relative 7-day retention, +5% 30-day retention, 15–25% reactivation (source: features/parent-care.md)
  - [TO CONFIRM: overall project targets]
Constraints (legal, regulatory, brand, technical, security):
  - Data Privacy Act of 2012 (RA 10173); DevCom is the personal-information controller (source: profile.md, launch-visibility.md)
  - Google Play payments policy: no buying or pointing to the web from the apps; Google Play stalkerware policy: persistent notification, app never hidden (source: subscriptions.md, app-listing.md)
  - Apple App Store guidelines 3.1.1, 3.1.3(b), 4.8, 5.1.1(iv), 5.1.2 and 5.4 (source: app-listing.md, mobile-organizations.md)
  - Meta does not allow Pages or ads directed at children (source: facebook-page.md)
  - No user counts, ratings or "trusted by" claims until real; screenshots use the demo family only (source: press-release.md, launch-visibility.md)
  - Staff never see a child's activity; organizations see counts only; card data never reaches eGuard's servers (source: console.md, organizations.md, subscriptions.md)
  - No analytics, ads or tracking SDKs in the apps (source: mobile-api.md)
  - Windows agent never touches a game's process from the inside and uses no kernel driver (source: desktop-agent-spec.md)
Known risks:
  - iOS app may be rejected if paid features unlock without StoreKit purchases (source: app-listing.md)
  - Family Controls distribution entitlement from Apple can take weeks (source: app-listing.md, child-app-spec.md)
  - Windows installers may show SmartScreen warnings; Defender may flag the agent; anti-cheat may block ending a game (source: pricing-desktop.md, desktop-agent-open-questions.md)
  - Microsoft Family Safety is free and is the main rival on a PC (source: pricing-desktop.md)
  - Legal pages and Parent care not yet reviewed by a lawyer or DPO (source: launch-visibility.md, features/parent-care.md)
Decisions already made (decision: date: who decided):
  - Android applies protections with on-device APIs, not Google Family Link: 2026-10-08: [TO CONFIRM: who] (source: app-listing.md, child-app-spec.md)
  - Windows PCs included in every plan, tamper protection on Free, prices held at launch, yearly plans at two months free, launch offer built but off: 2026-10-23: owner (source: pricing-desktop.md)
  - Plan limits changed to Free 1/1, Plus 3/5, eGuard Family 6/12; "Family Pro" renamed "eGuard Family"; existing subscribers keep their limits: 2026-10-28: owner (source: pricing-desktop.md, plan-change-2026-10.md)
  - More than one parent and configuration history stay on every plan: 2026-10-28: [TO CONFIRM: who] (source: subscriptions.md)
  - Code signing with an OV certificate and cloud signing: [TO CONFIRM: date and who] (source: code-signing.md)
  - Windows agent uses plain Win32 windows; uninstall entry visible and opens "Remove eGuard": 2026-10-23 and 2026-10-24: owner (source: desktop-agent-spec.md)
Words with a special meaning here (term: meaning):
  - Verified: a setting the child's device has confirmed it has (source: profile.md)
  - Failed: the device reported something other than what the parent set (source: faq.md)
  - Configuration Health: one score per child across 10 protections, measuring device settings, never the child's behavior (source: profile.md)
  - Protection: one of the 10 settings areas (Screen Time, Bedtime, App Restrictions, App Approval, Content Restrictions, Web Filtering, Downloads, Location, Notification Controls, Uninstall Protection) (source: profile.md)
  - Family admin: the parent who owns the family's subscription and admin-only actions (source: subscriptions.md, mobile-api.md)
  - Pass: one month or one year paid once, never renews (source: faq.md)
  - Auto-renew: card or Maya charged every month or year until turned off (source: faq.md)
  - Organization, join code, sponsor code, batch: a school, community or business; the code families enter to join; a code that gives a family a paid plan; a purchase of codes (source: organizations.md)
  - Legacy limits: the older, larger limits kept by families subscribed before 2026-10-28 (source: plan-change-2026-10.md)
  - Alerts when a setting changes (driftAlerts): alert raised when a protection changes on the device; eGuard Plus and up (source: subscriptions.md)
  - Service notice / product update: console broadcast to every verified parent / only to parents who opted in (source: console.md)
  - Parent care: tips, weekly plans, reminders, check-ins and monthly reports for parents (source: features/parent-care.md)
  - Profiles Protected, Balanced, Custom: starting settings for a child's age (source: profile.md, features/children.md)
  - Demo family: the made-up family used in screenshots and store review (source: app-listing.md)
Existing material I will paste (list): app-listing.md, browser-extension-api.md, child-app-prompts.md, child-app-spec.md, code-signing.md, console.md, desktop-agent-open-questions.md, desktop-agent-prompt.md, desktop-agent-spec.md, facebook-page.md, faq.md, features/README.md, features/authentication.md, features/children.md, features/dashboard.md, features/devices.md, features/location.md, features/parent-care.md, features/protection.md, knowledge-center.md, launch-visibility.md, marketing-site-review.md, mobile-api.md, mobile-organizations-prompts.md, mobile-organizations.md, organization-api.md, organizations.md, plan-change-2026-10.md, press-release.md, pricing-desktop.md, profile.md, subscriptions.md (source: docs/)
```
