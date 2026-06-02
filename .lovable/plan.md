# Bafana Supporters Club — Full PWA Build Plan

Extend the existing homepage into a complete mobile-first PWA with auth, content modules, and premium subscriptions. Maintain the Modern Minimalist Premium design system (SA green/gold/black, Inter Tight + Inter).

## Phase 1 — Backend Foundation (Lovable Cloud)

Enable Lovable Cloud and create schema:
- `profiles` (id → auth.users, full_name, phone, country, premium boolean, premium_until)
- `user_roles` + `app_role` enum + `has_role()` security definer (admin/user)
- `players` (name, position, club, jersey_number, caps, goals, photo_url, bio, stats jsonb)
- `matches` (opponent, kickoff, venue, competition, home boolean, home_score, away_score, status)
- `news_articles` (title, slug, category, excerpt, body, cover_url, published_at, author_id)
- `bookmarks` (user_id, article_id)
- `subscriptions` (user_id, status, plan, current_period_end)
- `payments` (user_id, amount, status, provider_ref) — tokenized only

RLS on all tables, GRANTs to authenticated/service_role, public read on players/matches/news.

Seed sample data (squad of ~23 players, 4–6 fixtures, 6 news articles).

## Phase 2 — Auth System

- Email/password + Google sign-in (via Lovable broker)
- `/login`, `/signup` (Full name, email, password, phone, country=ZA), `/forgot-password`, `/reset-password`
- `_authenticated` layout route with redirect guard
- Root `onAuthStateChange` listener for cache invalidation
- `auth-attacher` wired in `src/start.ts`

## Phase 3 — App Shell & Navigation

- Sticky bottom nav: Home / News / Squad / Fixtures / Premium
- Top bar with logo + profile avatar (links to /profile)
- Mobile-first; desktop gets centered max-width container
- PWA manifest only (no service worker per Lovable PWA policy) — installable

## Phase 4 — Feature Routes

```
/                  Home (refined: countdown, announcement, CTA, quick stats, featured player, news strip)
/news              News feed with category filters (Team/Match/Player/Supporter)
/news/$slug        Article page + bookmark button
/squad             Player grid + position filter
/squad/$id         Player profile (photo, stats, bio)
/fixtures          Upcoming + past tabs
/fixtures/$id      Match detail (lineups, highlights placeholder)
/premium           Bafana Premium Pass landing + checkout CTA
/_authenticated/profile   Profile, membership status, digital card w/ QR, payment history
/_authenticated/checkout  Stripe checkout (seamless Stripe payments)
/login /signup /forgot-password /reset-password
```

Server fns (`*.functions.ts`) for: getNews, getArticle, getPlayers, getPlayer, getFixtures, getMatch, toggleBookmark, getProfile, getSubscriptionStatus.

## Phase 5 — Premium Subscription

- Single plan: **Bafana Premium Pass** (monthly)
- Lovable seamless Stripe payments (`enable_stripe_payments`)
- Subscription gate util: `requirePremium()` server-side, `<PremiumGate>` UI
- Premium badge on profile + digital card

## Phase 6 — Notifications (PWA-ready stub)

- In-app notifications bell + dropdown (DB-backed `notifications` table)
- Browser push placeholder (no SW per Lovable policy unless user requests)

## Design tokens (already in styles.css)

Extend with: bottom nav surface, premium gold gradient, match-card variants (home/away), badge styles.

---

## Scope check before I start

This is a very large build (~30+ files, ~6 DB tables, auth, payments). I'll proceed in this order so you can review along the way:

1. **Cloud + DB schema + seed data**
2. **Auth + app shell + bottom nav**
3. **Home / News / Squad / Fixtures** (read-only modules)
4. **Profile + Premium (Stripe enable + checkout)**
5. **Bookmarks + notifications + polish**

I'll skip the admin portal in this pass (you can request it after — it's another large module). Notifications will be in-app only (no native push — requires service worker which conflicts with Lovable's preview).

Confirm and I'll begin with Phase 1.
