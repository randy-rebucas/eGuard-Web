# Community

A forum for parents in the web app (`/community`). Parents ask questions and share what works; the eGuard team posts
announcements. Children never see it.

Code: `src/lib/forum.ts` (service), `src/lib/forum-shared.ts` (constants the browser needs), `src/app/actions/forum.ts`,
`src/app/(app)/community/*`, `src/components/forum/*`; staff: `src/app/actions/console-forum.ts`,
`src/app/console/(signed-in)/community/page.tsx`. Tests: `src/lib/test/forum.test.ts`.

## Rollout

Everything is behind the `community` feature flag (console › Feature flags). The migration creates it **off**. While it's
off for a family, the nav item is hidden and every `/community` page is a 404.

## Who can do what

| | Read | Post, reply, edit own, Helpful | Report |
|---|---|---|---|
| Parent, email not verified | ✓ | – | – |
| Verified, no community name yet | ✓ | picks a name and accepts the rules first | ✓ |
| Verified with a name | ✓ | ✓ | ✓ |
| Muted by staff | ✓ | – until `mutedUntil` | – |

Announcements (`staffOnly` topic) take posts only from staff, through the console.

## Privacy

- Parents appear only by their **handle** (`ForumProfile.handle`). Their name, email and family are never shown, and
  that includes staff in the console.
- Handles can't look like emails or phone numbers, or claim to be eGuard.
- Before posting, text is checked for the parent's **own children's first names**, phone numbers, emails and street
  addresses. The parent is warned once and can choose "Post anyway" (`PRIVACY_CODE`).
- Plain text only: nothing is rendered as HTML or as a link.

## Moderation

- Posts go live at once.
- Parents report with a reason. **3 open reports** from different parents hide a post until staff decide.
- Console › Community has three views:
  - **Reports:** hide or unhide, dismiss, delete, and mute the author for 1/7/30/365 days or unmute.
  - **Recent posts:** hide, pin, lock, and reply as the eGuard team.
  - **Post as eGuard:** announcements.
- Every staff action goes to the staff audit log (`community.*`).
- When staff hide or delete a post, its author gets an in-app notice.

## Notifications

A thread's author and everyone who replies follow it (`ForumSubscription`); a parent can unfollow. A new reply, or an
`@handle` mention, tells them in three ways:

- **In-app:** Community › Notifications, with an unread badge in the nav.
- **Email:** when both `User.notifyEmail` and `ForumProfile.notifyReplies` are on (Settings › Notifications ›
  Community), at most **one per thread per hour**.
- **Push:** when `User.notifyPush` is on.

Delivery runs in `after()` and never fails the post.

## Data rights and retention

- **Account export:** includes the parent's own profile, threads, replies and Helpful-vote count (`exportForum`).
- **Account deletion** (`eraseForUsers`): the parent's threads and replies are emptied. Placeholders stay as
  "Deleted member" so other parents' replies still read in order. Their profile, votes, follows and notices go with
  the user row.
- **Maintenance** (`purgeForum`, daily):
  - hidden posts are emptied 30 days after they were hidden;
  - deleted threads with nothing left in them are removed;
  - read notices are removed after 90 days.

## Limits

These are per parent (`LIMITS` in `src/lib/rate-limit.ts`):

| Action | Limit |
|---|---|
| New threads | 5 per hour |
| Replies and edits | 30 per hour |
| Helpful votes | 120 per hour |
| Reports | 20 per day |
| Name changes | 5 per day |

## Not yet

- Search uses Postgres full-text (`'simple'` config) with no index. Add a GIN expression index once there are many
  thousands of threads.
- There is no mobile API yet. The service is ready for one under `api/mobile/v1/community`.
