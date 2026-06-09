## Web Push Notifications

Browser/PWA push notifications with five trigger types. Delivered via the standard Web Push protocol (works on desktop Chrome/Firefox/Edge, Android, and iOS 16.4+ when installed to Home Screen).

### What you'll get

1. **Notification bell** in the app header — users tap once to enable notifications, browser asks permission, done. A second tap unsubscribes.
2. **A `/notifications` settings page** (under account) to toggle individual categories: kick-off, goals, full-time, squad, articles.
3. **Five automatic triggers**:
   - **Kick-off starting** — fires 15 min before kickoff (cron every 5 min)
   - **Goal scored** — fires when API-Football score changes during a live match (cron every 30s while a Bafana match is live)
   - **Full-time result** — fires when match status flips to FT
   - **Squad announced** — admin-triggered button on the squad page (sends to all subscribers)
   - **New article published** — cron every 10 min detects new articles vs the `seen_articles` table

### Technical bits

- **VAPID keys** auto-generated on first server boot and persisted to a new `app_config` table — no manual secret setup needed.
- **Service worker** at `/sw.js` handles `push` event and click-through to relevant route (`/fixtures/$id`, `/news/$slug`, etc.).
- **Web push delivery** done manually via fetch + JWT (ES256 signed with `jose`) — no Node-only `web-push` package, fully Worker-compatible.
- **New tables**:
  - `push_subscriptions` (user_id, endpoint UNIQUE, p256dh, auth, prefs jsonb, created_at)
  - `notification_log` (dedup_key PK, sent_at) — prevents duplicate sends (e.g. same goal fired twice)
  - `match_state` (fixture_id PK, status, home_score, away_score) — for goal/FT diffing
  - `seen_articles` (url PK, title, published_at) — for new-article detection
  - `app_config` (key PK, value jsonb) — stores VAPID keypair
- **Cron jobs** (pg_cron + pg_net) call `/api/public/hooks/*` routes:
  - `/api/public/hooks/match-poll` every 30s
  - `/api/public/hooks/kickoff-reminder` every 5 min
  - `/api/public/hooks/article-poll` every 10 min
- **Files added** (~12):
  - `public/sw.js` — service worker
  - `src/lib/push.server.ts` — VAPID, encryption, fetch-based send
  - `src/lib/push.functions.ts` — subscribe/unsubscribe/sendToAll server fns
  - `src/lib/vapid.server.ts` — keypair generation + persistence
  - `src/components/NotificationBell.tsx` — header bell button
  - `src/routes/_authenticated/notifications.tsx` — preferences page
  - `src/routes/api/public/hooks/match-poll.ts`
  - `src/routes/api/public/hooks/kickoff-reminder.ts`
  - `src/routes/api/public/hooks/article-poll.ts`
  - + migration, manifest update (add `gcm_sender_id` not needed), admin "Send squad alert" button

### Caveats

- **iOS**: only fires when the user has added the app to their Home Screen (Apple's restriction, not ours).
- **Goal detection lag**: API-Football is ~30–60s behind broadcast, so notifications arrive a minute after the actual goal — same as every football app.
- **30s polling cost**: only active when a Bafana match is currently live (between kickoff and FT). Off the rest of the time, so it's cheap.
- **Admin role**: "Send squad alert" button only shows for users with `admin` role (you can grant yourself via SQL or I can add a quick admin grant).

Proceed?
