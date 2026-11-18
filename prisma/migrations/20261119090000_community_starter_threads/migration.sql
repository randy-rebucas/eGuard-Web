-- Community starter threads (lib/forum, docs/features/community.md › Starter threads): one per topic from the eGuard
-- team, so Community doesn't open empty. `staffAuthorId` 'system' shows as "eGuard team" (authorOf); it isn't a
-- staff account. Fixed ids and ON CONFLICT keep this safe to run again; staff can edit, hide or unpin them later.

INSERT INTO "ForumThread" ("id", "categoryId", "staffAuthorId", "title", "body", "pinned", "locked", "lastActivityAt", "createdAt")
SELECT v.id, c.id, 'system', v.title, v.body, v.pinned, v.locked, v.at, v.at
FROM (VALUES
  ('ft_start_welcome', 'announcements', true, true, TIMESTAMP '2026-11-19 09:06:00',
   'Welcome to eGuard Community: start here',
   'Welcome! Community is a place for parents to help each other keep kids safe and happy online. Ask questions, share what works in your home, and hear news from the eGuard team.

A few things to know:

- Only parents can see Community. Children never do.
- Other parents see only your community name, never your real name, email or anything about your family.
- Keep your family private: please don''t post your children''s names, photos, schools, addresses or phone numbers. Say "my 9-year-old" instead of a name.
- Be kind. Everyone here is doing their best.
- No selling or advertising.
- If you see something that breaks these rules, tap Report. Our team reviews every report.
- If a child is in danger, contact the authorities first.

Not sure where to begin? Say hello in "Getting started & setup", or ask your first question in any topic. Follow a thread to hear about new replies.

We''re glad you''re here.
The eGuard team'),

  ('ft_start_hello', 'getting-started', true, false, TIMESTAMP '2026-11-19 09:05:00',
   'Say hello: introduce yourself',
   'New here? Tell us a little about your family, without names or places, please.

For example:
- How many kids, and roughly how old?
- What made you start using eGuard?
- What''s one thing you''d like to get right this year?

Reply below and welcome the next parent who joins.'),

  ('ft_start_setup', 'getting-started', false, false, TIMESTAMP '2026-11-19 09:04:00',
   'Setup tips: what helped you get eGuard running?',
   'Pairing a phone, adding the browser extension, choosing the first settings: what went smoothly for you, and what would you tell a parent just starting?

Stuck on something? Ask here, and check the Help Center too. For account or billing problems, contact support from Settings › Support so we can look at your account.'),

  ('ft_start_screen_time', 'screen-time', true, false, TIMESTAMP '2026-11-19 09:03:00',
   'What screen time rules actually work in your home?',
   'Daily limits, tech-free dinners, a charging spot outside the bedroom, more time on weekends...

Which rules have stuck in your family, and which ones didn''t? Share what you tried and how your kids took it. Different ages need different rules, so mention roughly how old they are.'),

  ('ft_start_apps_games', 'apps-games', true, false, TIMESTAMP '2026-11-19 09:02:00',
   'Which apps and games do you allow, and why?',
   'Roblox, Minecraft, YouTube, TikTok, Mobile Legends... every family draws the line somewhere different.

Which apps and games have you allowed, blocked, or allowed with conditions? What helped you decide? Tips on in-app settings and chat controls are very welcome.'),

  ('ft_start_online_safety', 'online-safety', true, false, TIMESTAMP '2026-11-19 09:01:00',
   'How do you talk to your kids about staying safe online?',
   'Strangers in game chats, scams, sharing photos, what to do when something feels wrong: these talks are hard to start.

How did you bring it up with your kids? What words worked for their age? If you use a family agreement, how did you make it together?'),

  ('ft_start_ideas', 'feature-ideas', true, false, TIMESTAMP '2026-11-19 09:00:00',
   'What should eGuard do next? Share your ideas',
   'We read every idea. Tell us what would make eGuard more useful for your family: a feature you miss, something that''s hard to find, or a problem you wish we''d solve.

One idea per reply makes it easier for others to mark the ones they agree with as Helpful.')
) AS v(id, slug, pinned, locked, at, title, body)
JOIN "ForumCategory" c ON c.slug = v.slug
ON CONFLICT ("id") DO NOTHING;
