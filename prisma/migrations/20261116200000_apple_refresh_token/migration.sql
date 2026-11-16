-- Sign in with Apple: the refresh token from the app's authorization code (sealed with TWO_FACTOR_KEY), so deleting
-- an account or unlinking Apple can revoke it at Apple (App Store guideline 5.1.1(v)). Null for earlier sign-ins.
ALTER TABLE "OAuthIdentity" ADD COLUMN "appleRefreshToken" TEXT;
