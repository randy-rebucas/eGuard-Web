import type { Article } from "../types";

const R = "2026-10-04";

export const PARENTAL_CONTROLS: Article[] = [
  {
    slug: "parental-controls-philippines-guide",
    topic: "parental-controls",
    title: "Parental controls in the Philippines: a complete guide for parents",
    description: "What parental controls can and can't do, the free tools already on your child's phone, and how to set them up for each age.",
    reviewed: R,
    takeaways: [
      "Start with the free controls built into Android (Google Family Link) and iPhone (Screen Time).",
      "Layer controls: device, app store, apps, browser and home Wi-Fi each cover different gaps.",
      "Controls work best when your child knows about them and helped agree the rules.",
      "Check that settings are actually working; updates and resets can switch them off.",
    ],
    body: `
"Parental controls" covers a lot: time limits, app approvals, content filters, location sharing and more. This guide explains the main types, what's free, and how to set up a sensible system without spending hours on it.

## What parental controls can do

- **Limit time**: daily limits, app limits and a device bedtime
- **Control apps**: approve downloads, block specific apps, set age ratings
- **Filter content**: SafeSearch, web filters, YouTube restrictions
- **Prevent spending**: purchase approvals
- **Share location** with parents
- **Protect settings**: stop a child uninstalling the controls or changing them

## What they can't do

- Stop everything. No filter catches every harmful page, video or message.
- Replace conversations. Most serious harm, like grooming and bullying, happens in apps your child is allowed to use.
- Work on devices you don't control: a friend's phone, a school laptop, a computer shop.
- Keep working forever without checks. Updates, resets and new phones can undo settings.

## The layers

Think of parental controls as layers, each catching different things.

| Layer | Examples | Catches |
|---|---|---|
| Device | Google Family Link, iPhone Screen Time, Samsung Kids | Time limits, app approvals, bedtime, location |
| App store | Google Play and App Store age ratings and approvals | Age-inappropriate apps, purchases |
| Apps | TikTok Family Pairing, YouTube supervised accounts, Roblox Parental Controls | In-app content, chat, spending |
| Browser and search | SafeSearch, Chrome site filters | Adult websites, explicit search results |
| Home network | Router controls, family DNS | Adult sites on any device on your Wi-Fi |

You don't need every layer at every age. A 7-year-old benefits from all of them; a 16-year-old might just need a device bedtime and purchase approvals.

## Free tools to start with

- **Android:** [Google Family Link](/learn/google-family-link-setup)
- **iPhone and iPad:** [Screen Time and Family Sharing](/learn/iphone-screen-time-setup)
- **Samsung:** Family Link plus [Samsung Kids for young children](/learn/samsung-parental-controls)
- **YouTube:** [YouTube Kids and supervised accounts](/learn/youtube-parental-controls)
- **Home Wi-Fi:** [router and DNS filtering](/learn/home-wifi-parental-controls)
- **Games:** [Roblox](/learn/roblox-parental-controls-setup), [consoles](/learn/console-parental-controls), [Fortnite](/learn/fortnite-parental-controls)
- **Social apps:** [TikTok Family Pairing](/learn/tiktok-family-pairing), [Instagram Teen Accounts](/learn/instagram-teen-accounts), [Discord Family Center](/learn/discord-family-center-settings)

## Settings by age

| Age | Suggested setup |
|---|---|
| Under 6 | Shared device only, kids' apps, approved content only on YouTube Kids, used with an adult nearby |
| 6 to 9 | Child account, approve every app, strict filters, short daily limit, bedtime, no chat apps |
| 10 to 12 | Child account, app approvals, filters, limits agreed together, games with chat restricted to friends |
| 13 to 15 | Teen settings in each app, bedtime, purchase approvals, location by agreement, fewer app restrictions |
| 16 to 17 | Mostly self-managed: bedtime or phone out of the bedroom, purchase approvals, check-ins |

See [parental controls for teenagers](/learn/parental-controls-for-teens) for how to step back gradually.

## Tell your child

Secret monitoring tends to backfire. When children discover it, and they usually do, they lose trust and often find ways around it. Explain what you're turning on and why. Children who understand the reasons are less likely to [try to get around the controls](/learn/how-kids-get-around-parental-controls).

## Check that it's working

Parental controls fail quietly. A phone that was offline when you changed a setting, a system update, a reset or a new device can all leave your child without the protection you think is there. Every few weeks:

- Check the controls are still active on each device.
- Check new apps your child has installed.
- Make sure any new phone or tablet is added.

## Do you need a paid app?

Built-in controls are enough for many families. A paid app can help if you manage several children or devices, want one dashboard across Android and iPhone, want alerts when a setting stops working, or want more detailed reports. See [how to choose a parental control app](/learn/choosing-a-parental-control-app).
`,
  },
  {
    slug: "google-family-link-setup",
    topic: "parental-controls",
    title: "How to set up Google Family Link on your child's Android phone",
    description: "Step-by-step: create a supervised Google account for your child, set screen time, app approvals, content filters and location with Family Link.",
    reviewed: R,
    takeaways: [
      "Family Link is Google's free parental control for Android phones and tablets.",
      "Set it up before your child starts using the phone, with your own phone nearby.",
      "Key settings: app approvals, daily limit, downtime (bedtime), Chrome filters and location.",
    ],
    body: `
Google Family Link is free and built for Android. It lets you manage your child's Google account and Android devices from your own phone, whether that's Android or iPhone.

## What you need

- Your child's Android phone or tablet, charged and connected to Wi-Fi
- Your phone with the **Google Family Link** app installed
- Your own Google account
- About 20 minutes

## Step 1: Create or link your child's account

**For a new phone (best):** turn on the phone and, when it asks for a Google account, choose to create one for your child. Enter their real birthday. If they're under 13, Google will ask a parent to sign in and give consent. That creates a supervised account.

**For a phone already in use:** open Family Link on your phone, tap to add a child, and follow the steps. Your child's phone will ask for their password and your approval. If your child is 13 or older, they'll need to agree to supervision, so talk with them first.

> Use your child's real birthday. Google, YouTube and many apps use it to set age-appropriate defaults. A fake older age switches those protections off.

## Step 2: Set app approvals

In Family Link, choose your child, then **Controls**, **Google Play**:

- **Purchases and download approvals:** All content. You'll get a request on your phone for each new app.
- **Content restrictions:** set apps and games to an age rating that fits your child.

Also check **Controls, Apps** to see what's already installed and block anything unsuitable.

## Step 3: Set screen time

Under **Controls, Screen time**:

- **Daily limit:** set a total for each day. You can set different limits for weekends.
- **Downtime:** the device's bedtime. Try 9:00 or 9:30 PM to 6:00 AM for children under 13.
- **School time** (on supported devices): limits the phone during class hours, while allowing calls and chosen apps.

You can also set **app limits** for specific apps, such as one hour for YouTube.

Mark essential apps as **Always allowed**: phone, messages to family, and maps.

## Step 4: Filter content

- **Chrome:** under Controls, Content restrictions, Google Chrome, choose **Try to block explicit sites**, or **Only allow approved sites** for younger children.
- **Google Search:** SafeSearch is turned on for supervised accounts.
- **YouTube:** choose YouTube Kids or a supervised YouTube experience. See [YouTube parental controls](/learn/youtube-parental-controls).

## Step 5: Location

Under **Location**, turn on location sharing so you can see the device on a map. Tell your child you've done it and why.

## Step 6: Protect the settings

- Make sure your child doesn't know your Google password.
- In Controls, check that your child can't add users or use guest mode, which can bypass controls. Options depend on the phone.
- Your child can't remove supervision without you, except in some cases when they turn 13, depending on Google's current rules. If they do, you're notified and their devices are temporarily locked.

## Common problems

- **Settings not applying:** the child's phone must be online. Open Family Link on their phone and refresh.
- **Apps installed before supervision:** these may still be there. Review them in Controls, Apps.
- **Samsung phones:** Family Link works, but some Samsung apps, like the Galaxy Store and Samsung Internet browser, need separate attention. See [Samsung parental controls](/learn/samsung-parental-controls).

## What Family Link doesn't do

It doesn't show messages, filter content inside most apps, or manage settings inside TikTok, Roblox or games. Use each app's own controls too, and see [the complete parental controls guide](/learn/parental-controls-philippines-guide).
`,
  },
  {
    slug: "iphone-screen-time-setup",
    topic: "parental-controls",
    title: "Setting up Screen Time and Family Sharing on a child's iPhone",
    description: "How to set up your child's iPhone or iPad with Family Sharing, Screen Time limits, Downtime, content restrictions and Ask to Buy.",
    reviewed: R,
    takeaways: [
      "Create a child Apple Account through Family Sharing so you can manage Screen Time from your own iPhone.",
      "Set Downtime, App Limits, Content & Privacy Restrictions and a Screen Time passcode your child doesn't know.",
      "Turn on Ask to Buy and Communication Safety.",
    ],
    body: `
Apple's parental controls are built in and free. They work best when your child has their own child account in your Family Sharing group, so you can manage everything from your own iPhone.

## Step 1: Set up Family Sharing

On your iPhone, open **Settings**, tap your name, then **Family**. Tap to add a member and choose to **create a child account**. Enter your child's real birthday. Apple uses age to set defaults and to turn on protections for children automatically.

If your child already has an Apple Account, you can invite them to your family instead.

## Step 2: Turn on Screen Time

In Settings, go to **Screen Time**, choose your child's name, and turn it on. Apple walks you through the main settings.

### Downtime

Blocks most apps during set hours, like a bedtime. Try 9:00 PM to 6:00 AM on school nights. Choose whether a request for more time needs your approval.

### App Limits

Set daily limits for categories (Games, Social) or specific apps.

### Always Allowed

Choose apps that work even during Downtime: Phone, Messages to family, Maps.

### Communication Limits

Control who your child can call, message and FaceTime, during allowed time and during Downtime. For younger children, contacts only.

### Communication Safety

Warns your child and blurs images that may contain nudity in Messages, AirDrop, FaceTime and other supported apps. It's on by default for children under 13 in many regions; check it's on.

## Step 3: Content & Privacy Restrictions

Under Screen Time, **Content & Privacy Restrictions**:

- **iTunes & App Store Purchases:** set In-app Purchases to Don't Allow, and require a password.
- **Content Restrictions:** set app, film, TV and book ratings to your child's age. Set web content to **Limit Adult Websites**, or **Allowed Websites Only** for young children.
- **Location Services:** share location with family; turn off for apps that don't need it.
- **Account changes and passcode changes:** set to Don't Allow so restrictions can't be removed.

## Step 4: Ask to Buy

In Family settings, choose your child and turn on **Ask to Buy**. Every download or purchase sends you a request.

## Step 5: The Screen Time passcode

If you set up Screen Time on your child's own device rather than through Family Sharing, choose a **Screen Time passcode** that's different from the phone's unlock code. Don't enter it where your child can see.

## Things to know

- Screen Time reports show how long your child used each app, but not what they did inside it.
- Some limits can be extended with one tap ("one more minute") unless you require approval.
- Settings inside apps such as TikTok, YouTube and Roblox are separate. Use their own controls too.
- If your child gets a new iPhone, make sure it signs in with the same child account so settings carry over.

Related: [how kids get around parental controls](/learn/how-kids-get-around-parental-controls) and [how much screen time is right](/learn/how-much-screen-time-by-age).
`,
  },
  {
    slug: "samsung-parental-controls",
    topic: "parental-controls",
    title: "Parental controls on Samsung phones and tablets",
    description: "How to use Google Family Link, Samsung Kids and Digital Wellbeing on Galaxy phones and tablets, and the Samsung apps that need extra attention.",
    reviewed: R,
    takeaways: [
      "Use Google Family Link as your main control on Galaxy phones; it's built into Android.",
      "Samsung Kids is a locked-down space for young children on shared tablets.",
      "Check Samsung's own apps separately: Galaxy Store and Samsung Internet aren't covered by all Google filters.",
    ],
    body: `
Samsung Galaxy phones and tablets are among the most common devices in Filipino homes. They run Android, so Google Family Link works on them, but Samsung adds its own tools and its own app store, which are worth knowing about.

## Option 1: Google Family Link (best for phones)

For a child's own phone, set up Family Link as described in our [Family Link guide](/learn/google-family-link-setup). On Galaxy phones it's also reachable from **Settings, Digital Wellbeing and parental controls, Parental controls**.

Family Link gives you app approvals, daily limits, downtime, Chrome filters and location.

### Close the Samsung gaps

- **Galaxy Store:** Samsung's own app store isn't controlled by Google Play approvals. Use Family Link to block the Galaxy Store app, or set age restrictions within the Galaxy Store settings.
- **Samsung Internet:** Chrome filters from Family Link don't apply to Samsung's own browser. Block Samsung Internet in Family Link so your child uses Chrome, or rely on a [home Wi-Fi or DNS filter](/learn/home-wifi-parental-controls).
- **Secure Folder:** Samsung's Secure Folder can hide apps and files behind a separate lock. On a younger child's phone, check it isn't set up. See [secret accounts and vault apps](/learn/secret-accounts-and-vault-apps).

## Option 2: Samsung Kids (best for young children on shared tablets)

Samsung Kids turns a Galaxy phone or tablet into a separate, child-friendly space with its own home screen. Your child can only use the apps you add, and leaving Samsung Kids requires your PIN.

To open it, swipe down to Quick Settings and tap **Kids**, or look in Settings under Digital Wellbeing and parental controls. Inside, open the menu to set:

- A daily play time limit
- Which apps are allowed
- Which contacts your child can call

Samsung Kids is good for children under about 8 who share a parent's tablet. Older children usually find it too limiting.

## Option 3: Digital Wellbeing (for teenagers)

Digital Wellbeing lets a user see their own screen time, set app timers and use Bedtime mode. It's not a parental control, since the user can change it, but it's a good tool for teenagers who manage their own phones. Sit down with your teen and set it up together.

## Tips

- Keep the phone's software updated. Samsung and Google fix security issues regularly.
- Set a screen lock your child knows, and make sure your own Samsung account password is private.
- If you're handing down a Galaxy phone, do a full factory reset and then set it up fresh as a supervised device.
`,
  },
  {
    slug: "home-wifi-parental-controls",
    topic: "parental-controls",
    title: "Parental controls on your home Wi-Fi",
    description: "How to filter adult sites and set internet schedules on your home Wi-Fi with router settings and free family DNS services, and their limits.",
    reviewed: R,
    takeaways: [
      "A family DNS service filters adult sites on every device connected to your Wi-Fi, for free.",
      "Many home routers can pause the internet for specific devices on a schedule.",
      "Wi-Fi controls don't apply when a phone uses mobile data, so combine them with device controls.",
    ],
    body: `
Device controls only protect devices you've set up. Your home Wi-Fi can add a layer that covers everything connected to it: the smart TV, the shared laptop, a cousin's tablet, a game console.

## Option 1: A family DNS filter

DNS is like the internet's phone book: it turns website names into addresses. A **family DNS service** refuses to look up adult and malicious sites, so they don't load on any device using your Wi-Fi.

Free family DNS services include:

| Service | DNS addresses |
|---|---|
| Cloudflare for Families (blocks malware and adult content) | 1.1.1.3 and 1.0.0.3 |
| OpenDNS FamilyShield | 208.67.222.123 and 208.67.220.123 |
| CleanBrowsing Family Filter | 185.228.168.168 and 185.228.169.168 |

### How to set it up

1. Find your router's admin page. The address and login are usually on a sticker on the router, or in your internet provider's app.
2. Look for **DNS** settings, often under LAN, DHCP or Internet settings.
3. Replace the DNS addresses with the family DNS addresses above.
4. Save and restart the router.
5. Test by visiting a site you expect to be blocked.

Some provider routers lock DNS settings. If you can't change them, you can set family DNS on each device instead, or ask your provider whether their app offers parental controls.

## Option 2: Router schedules and device pausing

Many routers and provider apps let you:

- **Pause** internet for a specific device
- Set **schedules** so a child's devices go offline at bedtime
- See which devices are connected

Look for "Parental control", "Access control" or "Time schedule" in the router settings or app.

## The limits

- **Mobile data bypasses Wi-Fi controls.** If your child's phone has load, it can skip your Wi-Fi entirely. Device controls like [Family Link](/learn/google-family-link-setup) still apply.
- **Private DNS and VPNs can bypass DNS filters.** Android's Private DNS setting and VPN apps can route around your filter. Use device controls to block VPN apps.
- **Filters aren't perfect.** Some adult content lives on sites that aren't blocked, like social media.
- **Router changes affect everyone.** Adults in the house may find some sites blocked too.

## Also turn on SafeSearch

DNS filters block websites, not search results. Turn on SafeSearch too. See [SafeSearch and web filters](/learn/safesearch-and-web-filters).

## Computer shops and pisonet

Your home Wi-Fi rules don't follow your child to a computer shop or pisonet. If your child goes to one, talk about which games and sites are okay, and who they talk to there.
`,
  },
  {
    slug: "youtube-parental-controls",
    topic: "parental-controls",
    title: "YouTube parental controls: YouTube Kids, supervised accounts and teens",
    description: "Choose between YouTube Kids, a supervised YouTube account and teen settings, and set each one up properly for your child's age.",
    reviewed: R,
    takeaways: [
      "Under about 9: YouTube Kids, ideally with Approved Content Only.",
      "About 9 to 12: a supervised YouTube account through Family Link, set to the right content level.",
      "Teens: their own account with Restricted Mode, autoplay off and a talk about recommendations.",
    ],
    body: `
YouTube is one of the most-watched services among Filipino children, on phones, tablets and smart TVs. It also offers more parental control options than many parents realise. The right choice depends on your child's age.

## YouTube Kids (younger children)

YouTube Kids is a separate app with a simpler design and a narrower range of videos. When you set it up, choose a content level:

- **Preschool** (4 and under)
- **Younger** (5 to 8)
- **Older** (9 to 12)
- **Approved content only**: your child can only watch videos and channels you choose

Approved content only is the safest choice for young children, because filters can miss things. It takes a few minutes to pick channels, but it means you know exactly what's available.

Other settings:

- Turn **search off** for younger children.
- Use the **timer** to end viewing after a set time.
- **Block** any video or channel you don't like, from the three-dot menu.
- Turn off **autoplay** if you'd rather videos don't run on and on.

## Supervised YouTube (preteens)

For children ready for more than YouTube Kids, a **supervised experience** uses the main YouTube app with limits. Set it up through [Family Link](/learn/google-family-link-setup) or YouTube's parent settings. Choose:

- **Explore**: generally for viewers 9 and older
- **Explore More**: generally for 13 and older
- **Most of YouTube**: almost everything except age-restricted videos

Supervised accounts can't comment, upload or go live, and personalised ads are off.

## Teen accounts

From 13, teens can have their own YouTube account. YouTube applies some teen protections, such as limiting repeated recommendations of certain types of content and reminders to take breaks. You can also:

- Turn on **Restricted Mode** (Settings, General) to hide potentially mature content
- Turn off **autoplay**
- Set **Take a break** and **bedtime** reminders
- Link a teen account to yours for supervision in supported regions

## Smart TVs and shared devices

YouTube on a smart TV is often signed in to a parent's account. Either sign the TV in to a supervised account, use YouTube Kids on the TV, or turn on Restricted Mode on the TV app.

## What controls don't catch

- Inappropriate content disguised as kids' content, like cartoons with violent scenes
- Long hours of Shorts, which can be harder to stop watching
- Comments and links to other platforms in video descriptions

See [YouTube recommendations and Shorts](/learn/youtube-recommendations-and-shorts) for how the feed works and how to talk about it.

> Watch together sometimes. Ask your child to show you their favourite channel and why they like it. It tells you a lot about what they're watching.
`,
  },
  {
    slug: "safesearch-and-web-filters",
    topic: "parental-controls",
    title: "SafeSearch and web filters: what they block and what they miss",
    description: "How to turn on SafeSearch in Google and other search engines, set browser filters, and understand what slips through.",
    reviewed: R,
    takeaways: [
      "SafeSearch hides explicit search results; it doesn't block websites.",
      "Lock SafeSearch on through Family Link, Screen Time or a family DNS service.",
      "No filter is perfect: images on social media, links in chats and in-app browsers can get through.",
    ],
    body: `
Filters are useful, especially for younger children who might stumble onto adult content by accident. But it helps to know exactly what each one does, so you don't rely on it for more than it can deliver.

## SafeSearch

SafeSearch is a setting in search engines that hides explicit images, videos and websites from search results.

### Google

Google has three options: **Filter** (hides explicit results), **Blur** (blurs explicit images), and **Off**. For children, choose Filter.

- For **supervised Google accounts** under 13, SafeSearch is on and locked.
- For teens and shared accounts, go to google.com/safesearch and choose Filter.
- To lock it across your home network, use a family DNS service, which can force SafeSearch. See [home Wi-Fi parental controls](/learn/home-wifi-parental-controls).

### Bing, YouTube and others

Bing has a SafeSearch setting under Settings. YouTube uses Restricted Mode. Each search engine and app has its own setting.

## Browser filters

- **Chrome on Android:** with Family Link, choose Try to block explicit sites, or Only allow approved sites for young children.
- **Safari on iPhone:** in Screen Time, Content Restrictions, Web Content, choose Limit Adult Websites, or Allowed Websites Only.
- **Other browsers:** Family Link and Screen Time filters may not apply to every browser. Block browsers you haven't set up.

## What filters miss

- **Social media and messaging apps.** Explicit content on X, Telegram, Reddit or Discord isn't blocked by SafeSearch.
- **In-app browsers.** Links opened inside games or chat apps may bypass browser filters.
- **New or unlisted sites.** Filters work from lists, which are never complete.
- **Images and videos sent directly** by other people.
- **Text-based harm**: bullying, grooming, self-harm discussions.

## A filter is a seatbelt

Filters reduce accidental exposure, especially for young children. They don't make a phone safe for unsupervised use. Talk to your child about what to do if they see something upsetting: close it, and tell you. See [your child saw pornography: what to say](/learn/child-saw-pornography).

## Quick setup checklist

1. Turn on SafeSearch in Google (Filter).
2. Turn on browser filtering through Family Link or Screen Time.
3. Set a family DNS on your router.
4. Turn on YouTube Restricted Mode or use YouTube Kids.
5. Block browsers and apps you haven't set up.
`,
  },
  {
    slug: "how-kids-get-around-parental-controls",
    topic: "parental-controls",
    title: "How kids get around parental controls, and what to do about it",
    description: "The common workarounds children use, from second phones to VPNs, how to spot them, and why a conversation works better than an arms race.",
    reviewed: R,
    takeaways: [
      "Most workarounds are low-tech: a friend's phone, an old phone, a guessed passcode.",
      "Signs include missing hours in reports, new apps you don't recognise and settings that changed.",
      "A workaround is a signal to talk about why the rule feels unfair, not only to tighten controls.",
    ],
    body: `
If your child is determined, they'll eventually find a way around almost any control. That's not a reason to skip parental controls; it's a reason to understand the common workarounds and pair controls with honest conversation.

## Common workarounds

### Low-tech

- **Learning your passcode** by watching you type it
- **Using another device**: an old phone, a sibling's tablet, a friend's phone, a school laptop
- **Computer shops and pisonet** with no controls at all
- **Asking another adult**: a lolo, lola or yaya who doesn't know the rules

### Device tricks

- **Changing the date or time** to get around schedules (newer systems resist this)
- **Factory resetting** the device to remove supervision
- **Guest mode** or a second user profile on Android
- **Deleting and reinstalling** apps to reset limits

### Network tricks

- **Using mobile data** to avoid Wi-Fi filters
- **VPN apps** or Private DNS to avoid network filters
- **Hotspot from a friend's phone**

### App tricks

- **Watching videos inside another app** (for example YouTube links opened in a chat app)
- **Secret accounts** on social media. See [secret accounts and vault apps](/learn/secret-accounts-and-vault-apps).
- **Lying about age** when signing up

## Signs it's happening

- Screen time reports that look too low
- Device "offline" in your app at odd times
- Apps on the phone you didn't approve, or a VPN icon
- Settings that changed without your input
- Your child seems tired but the reports show nothing late at night

## What to do

### Close the obvious gaps

- Use a passcode your child doesn't know, and type it privately.
- Block VPN apps and browsers you haven't set up.
- Turn off guest mode and adding users where possible.
- Collect old phones and keep them in a drawer only you open.
- Tell other carers about the rules. See [grandparents, yayas and screen rules](/learn/grandparents-yaya-screen-rules).
- Use a parental control tool that alerts you when a setting stops working.

### Then talk

A child who works hard to get around a rule is telling you something. Maybe the limit is too tight for their age, maybe all their friends are in a group chat at night, maybe they're struggling with something they use the phone to escape.

Try: "I noticed the phone was being used after bedtime. I'm not angry, I want to understand. What's going on?"

You might adjust the rule. You might keep it and explain why. Either way, you're more likely to get honesty next time.

### Consequences that make sense

If a workaround breaks trust, a related, time-limited consequence works better than a long ban: for example, the phone charges in your room for a week. Long bans encourage more secrecy and cut a child off from the friends and support they also get online.

> The goal isn't a child who can't get around controls. It's a child who doesn't want to, because the rules feel fair and they know they can come to you.
`,
  },
  {
    slug: "choosing-a-parental-control-app",
    topic: "parental-controls",
    title: "How to choose a parental control app: 10 questions to ask",
    description: "A vendor-neutral checklist for comparing parental control apps on features, privacy, price and honesty, before you install anything on your child's phone.",
    reviewed: R,
    takeaways: [
      "Start with the free built-in controls, and only pay for what they don't do.",
      "Read the privacy policy: you're trusting the company with your child's data.",
      "Prefer apps that are transparent with your child over apps that market secret spying.",
    ],
    body: `
There are dozens of parental control apps. Some are excellent, some do little more than the free tools already on your child's phone, and some collect far more data than they need. These questions help you compare.

We make eGuard, a parental control app, so we have a stake in this. The questions below are the ones we'd ask of any app, including ours.

## 1. What do the free tools already do?

Try [Google Family Link](/learn/google-family-link-setup) or [iPhone Screen Time](/learn/iphone-screen-time-setup) first. A paid app should add something specific you need: managing several children in one place, mixed Android and iPhone families, alerts, reports, or easier setup.

## 2. Does it work on your children's devices?

Check the exact platforms: Android, iPhone, iPad, Windows, Chromebook, browsers. iPhones limit what third-party apps can do, so features often differ between Android and iPhone. Look for a clear list of what works where.

## 3. How does it know a setting is working?

Many apps show a setting as "on" once you save it, even if the child's phone never received it. Ask whether the app confirms settings on the device, and whether it tells you when a device goes offline or a setting is switched off.

## 4. What data does it collect?

Read the privacy policy. Does it read messages? Record screens? Keep browsing history? For how long? Can you export and delete your data? More data isn't always better: it's more to lose in a breach.

## 5. Where is the data stored, and who is responsible?

Look for a named company, a contact for privacy requests and, for Philippine users, compliance with the Data Privacy Act (RA 10173).

## 6. Is it honest with your child?

Avoid apps that advertise secret monitoring, hidden icons or reading every message. Covert surveillance usually damages trust when discovered and may raise legal issues for teens. Good apps are visible on the child's device and explain what they do.

## 7. Does it grow with your child?

Can you loosen settings for a teenager? Is there an age-based starting point? See [parental controls for teens](/learn/parental-controls-for-teens).

## 8. Can your child remove it easily?

Check for uninstall protection and alerts if the app is removed or disabled.

## 9. What does it really cost?

Look at the price in pesos, what the free plan includes, how many children and devices each plan covers, and how you pay (card, GCash, Maya). Check how to cancel before you subscribe.

## 10. Is there real support?

Can you reach a person? Is there a help center with setup guides? Is support available in your time zone?

## Red flags

- Claims to "see everything" or be "undetectable"
- No clear company name or address
- No privacy policy, or one that allows selling data
- Fake reviews or ratings without a source
- Pressure to subscribe before you can try anything

> Whatever you choose, no app replaces talking with your child. See [how to talk with your kids about their online life](/learn/talking-to-kids-about-online-life).
`,
  },
  {
    slug: "parental-controls-for-teens",
    topic: "parental-controls",
    title: "Parental controls for teenagers: what to keep and what to let go",
    description: "How to step back from parental controls as your child becomes a teenager, without leaving them to figure everything out alone at 18.",
    reviewed: R,
    takeaways: [
      "Shift from blocking to agreements: teens learn self-control by practising it.",
      "Keep a few high-value rules longest: phones out of the bedroom at night, purchase approvals, and app-level safety settings.",
      "Make a plan to hand over control fully by 18, with check-ins along the way.",
    ],
    body: `
Controls that suit a 9-year-old will frustrate a 15-year-old, and a 17-year-old who has never managed their own phone faces a sudden cliff at 18. The aim during the teenage years is a gradual handover.

## Why step back

- **Teens need practice.** Self-control around phones is a skill, learned by making small mistakes while you're still there to help.
- **Tight controls push teens to workarounds.** A secret second account is riskier than a monitored one. See [how kids get around controls](/learn/how-kids-get-around-parental-controls).
- **Privacy matters more as they grow.** Teens need private space to develop, just as they did offline.

## What to keep longest

These protect against the most serious harms and cost your teen the least freedom:

1. **Phones out of the bedroom at night**, or at least a device bedtime. Sleep is critical for teens. See [phones and sleep](/learn/phones-and-sleep).
2. **Teen safety settings in each app**: private accounts, limited DMs, sensitive content filters. See [TikTok](/learn/tiktok-privacy-settings) and [Instagram Teen Accounts](/learn/instagram-teen-accounts).
3. **Purchase approvals or spending limits.**
4. **Location sharing by agreement**, with clear reasons. See [location sharing](/learn/location-sharing-safety).

## What to loosen

- **App approvals:** move from approving everything to "tell me when you download something new".
- **Daily time limits:** move from a hard cap to agreed goals they track themselves.
- **Web filters:** loosen gradually, keeping explicit content blocked for younger teens.
- **Checking messages:** stop routine checks; keep the right to look if you have a specific safety concern, and say so upfront.

## A sample plan

| Age | Typical setup |
|---|---|
| 13 | Teen settings on all apps, app approvals, daily limit, bedtime, location shared |
| 14 to 15 | Notify instead of approve for most apps, weekly screen time review together, bedtime, location by agreement |
| 16 | Self-managed time, phone out of bedroom on school nights, spending limit |
| 17 | Mostly independent; monthly check-in; practise for 18 |

Adjust for your child. Some 14-year-olds handle more; some 16-year-olds need more support.

## Earned freedom, clearly explained

Tell your teen exactly what earns more freedom: keeping to bedtime, honesty when something goes wrong, keeping up with school. Make the steps predictable, so it doesn't feel arbitrary.

## Stay in the conversation

As controls step back, conversation matters more. Ask about the creators they follow, the group chats they're in, what's stressful online. Share your own mistakes. See [how to talk with your kids about their online life](/learn/talking-to-kids-about-online-life).

> If something serious happens, like bullying, sextortion or self-harm concerns, it's okay to tighten things temporarily. Explain why and set a date to review.
`,
  },
];
