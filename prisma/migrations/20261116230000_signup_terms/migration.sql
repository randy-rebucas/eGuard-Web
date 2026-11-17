-- What a sign-up agreed to: the Terms of Use / Privacy Policy date (LEGAL.updated) its form showed, carried to the
-- account's audit entry when the code step creates it (lib/signup). Null for clients that don't send `terms`.
ALTER TABLE "SignupRequest" ADD COLUMN "termsVersion" TEXT;
