-- One account per person: emails are compared by the mailbox they deliver to, not their spelling.
-- Not expressible in schema.prisma, so it lives here only.

-- The mailbox an address delivers to: lowercase, trimmed, "+tag" dropped; Gmail also ignores dots
-- and treats googlemail.com as gmail.com. "R.andy+kids@GoogleMail.com" -> "randy@gmail.com".
CREATE FUNCTION email_key(email text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT CASE WHEN domain IN ('gmail.com', 'googlemail.com')
    THEN replace(local, '.', '') || '@gmail.com'
    ELSE local || '@' || domain END
  FROM (SELECT split_part(substring(e FROM '^(.*)@[^@]*$'), '+', 1) AS local,
               substring(e FROM '@([^@]*)$') AS domain
        FROM (SELECT lower(btrim(email)) AS e) n) parts
$$;

-- A second sign-up for the same mailbox fails here even if two requests race past the app's check
CREATE UNIQUE INDEX "User_email_key_unique" ON "User" (email_key(email));

-- Emails are stored normalized, so exact-match lookups (sign in, social linking) always find them
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK (email = lower(btrim(email)));
