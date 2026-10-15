# Authentication

Signing up, signing in and staying signed in, on the website (`/login`, `/register`, `/register/verify`,
`/forgot-password`, `/reset-password`, `/login/two-step`) and in the apps (`/api/mobile/v1/auth/*`,
[mobile-api.md](../mobile-api.md) › P4.2). Hardened on 2026-10-15; this page records what protects each step and why.

## Creating an account

Two steps, on the web and in the apps (`src/lib/signup.ts`):

1. **The form** (name, family name, email, password, the parent-or-guardian box). Nothing is created yet. A
   `SignupRequest` row is stored with the password already hashed, and a 6-digit code is emailed. The browser gets
   the ticket in an httpOnly cookie (`eg_signup`); the app gets it as `signup`.
2. **The code.** It works only with that ticket, 5 tries per code, for 15 minutes. Then the family and its admin are
   created with the email already verified, and the parent is signed in.

**Why two steps:** the form must answer the same whether or not the email already has an account. Otherwise anyone
could find out who uses eGuard, which is sensitive for a child-safety app. An email that has an account gets
"You already have an eGuard account" (sign-in and reset links) instead of a code, and no code finishes that
sign-up. Same response, same timing (the password is hashed either way, and mail goes out after the response).

A side effect: every account made with a password has a proven email, so nobody can squat an address they don't
own. The ticket requirement means a person who receives a code they didn't ask for can't finish someone else's
sign-up. "Continue with Google / Apple / LinkedIn" skips the code, since the provider verified the email.

Limits: 10 sign-ups an hour per address (`signupIp`), 6 sign-up emails an hour to one inbox (`signupMail`, silent so
it reveals nothing), a resend once a minute and 5 per sign-up.

## Passwords

- **Hashing:** argon2id, 19 MiB, 2 passes (`src/lib/auth.ts`). Hashes made with bcrypt before 2026-10-15 still verify
  and are re-hashed at the parent's next successful sign-in (also staff, in the console). The 72-byte limit stays:
  older bcrypt hashes were made under it, and the apps check the same one.
- **Breached passwords** are turned down at sign-up, reset, change and accepting an invitation
  (`src/lib/breached-password.ts`). It uses Have I Been Pwned's range API: only the first 5 characters of the SHA-1
  leave the server, and responses are padded. If the service is down, the password is allowed.
  `PWNED_PASSWORDS=off` skips the check.
- Minimum 10 characters.

## Signing in

- **Rate limits** (unchanged): 10 failures per account per address, 50 per account from anywhere, and 30 per address
  across accounts, in 15 minutes. A missing email takes as long as a wrong password (a decoy argon2 hash).
- **Bot check:** Google reCAPTCHA v3 on the website's sign-in, create-account and forgot-password forms
  (`src/lib/bot-check.ts`). There's nothing to click: each form keeps a fresh token in a hidden field
  (`g-recaptcha-response`), and the server turns down a token for another form or a score under `RECAPTCHA_MIN_SCORE`
  (default 0.5; scores turned down are logged as `[bot-check] turned down`). It's **off until `RECAPTCHA_SITE_KEY` and
  `RECAPTCHA_SECRET_KEY` are set**. If Google is unreachable, forms go through. Google's badge is hidden and the notice
  its terms require is shown under the form instead. The privacy policy names reCAPTCHA only while it's on. The apps
  don't use it: they're covered by the same rate limits, and creating an account needs the emailed code.
- **Two-step verification** (unchanged): authenticator code or recovery code. A family admin without it sees a
  dashboard prompt once set up (intro seen, email verified, a child added). "Not now" hides it for 90 days
  (`User.twoFactorPromptClosedAt`). It's only shown when the server can offer two-step (`TWO_FACTOR_KEY` set).
- **New-device email** (`src/lib/sign-in-notice.ts`): "New sign-in to your eGuard account" when a session starts on a
  browser or app install the parent hasn't used before. It names the device, the time in the family's time zone and
  the address, and says to reset the password if it wasn't them. A browser is known by its `eg_device` cookie, an app
  by its `X-eGuard-Install` header. Older apps without the header are known by platform only. The first device
  (sign-up, the first sign-in after this shipped) is remembered silently. Devices unused for 180 days are forgotten.

## Sessions

- A random 32-byte token; only its SHA-256 is stored. Lasts 30 days.
- **Cookies are `__Host-` in production** (`__Host-eg_session`, `__Host-eg_2fa`, `__Host-eg_signup`,
  `__Host-eg_device`): Secure, path `/`, no Domain, so no other subdomain can plant or read them. They're plain names in
  development (http). The old `eg_session` is still read until 2026-11-14, so nobody was signed out by the rename;
  remove `LEGACY_COOKIE` in `src/lib/auth.ts` after that.
- Cookies are removed with `clearCookie()`, never `cookies().delete()`. Next's delete leaves out `Secure`, which a
  browser ignores for a `__Host-` cookie. This was found while testing; it also affected the console's `__Host-eg_staff`
  at sign-out.
- **Idle limit:** a browser session also ends after 14 days unused (`Session.web`). App sessions don't, because push
  alerts tied to them must keep arriving while the parent doesn't open the app.
- Changing a password signs out the other sessions; resetting one signs out every session.

## Checks

- Unit: `src/app/actions/auth.test.ts`, `src/lib/test/{signup,breached-password,bot-check,sign-in-notice,login-limits,security-notice}.test.ts`.
- API (against a running server): `tests/api/auth-hardening.test.ts`, and `mobile-api.test.ts` › 3 / 3b. The helper
  `register()` in `tests/api/helpers.ts` does both sign-up steps, reading the code from Mailpit.

## To switch on in production

1. Run the `auth_hardening` migration (`npm run db:deploy`).
2. Create a reCAPTCHA v3 key at google.com/recaptcha/admin for `www.eguard.family` and set `RECAPTCHA_SITE_KEY` and
   `RECAPTCHA_SECRET_KEY`. Watch the logs for `[bot-check] turned down` in the first days; lower `RECAPTCHA_MIN_SCORE`
   if real parents are being refused.
3. Ship the Android and iOS builds with the code step before or with the server. Older app builds can't finish
   creating an account (they expect a token from `/auth/register`); signing in still works on them.
