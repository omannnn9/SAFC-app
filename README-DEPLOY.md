# Deployment Guide — SA FC (South Africa Football Community)

> **Current architecture:** TanStack Start (React 19 SSR) on **Google Cloud Run**, fronted by a
> global HTTPS load balancer at **southafricafc.com**, with a **self-hosted Supabase** stack on a
> Compute Engine VM. Continuous deployment runs through **GitHub Actions** on every push to `main`.
>
> The previous Vercel + Lovable Cloud setup is retired. This document is the source of truth.

---

## 1. Architecture Summary

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 19 + Tailwind CSS | Cloud Run (served by SSR app) |
| Router / SSR | TanStack Start | Cloud Run container |
| Server functions | `createServerFn` + API routes | Same Cloud Run container |
| Database / Auth / Storage | Self-hosted Supabase (Postgres, GoTrue, PostgREST, Realtime) | Compute Engine VM `supabase-1` |
| Payments | Stripe (live) | Stripe-hosted Checkout + Customer Portal |
| External data | API-Football, football-data.org, NewsAPI | Called from server functions only |
| CDN / TLS | Global external HTTPS load balancer + Google-managed cert | GCP |
| CI/CD | GitHub Actions → Cloud Run (keyless via Workload Identity Federation) | GitHub + GCP |

### GCP coordinates

| Item | Value |
|---|---|
| Project | `safc-prod` |
| Cloud Run region | `africa-south1` (Johannesburg) |
| Cloud Run service | `safc-web` |
| Artifact Registry repo | `africa-south1-docker.pkg.dev/safc-prod/safc` |
| Public domain | `southafricafc.com` (+ `www`) |
| Supabase VM | `supabase-1`, zone `africa-south1-a` |
| Supabase API URL | `https://34.35.110.246.sslip.io` |
| Supabase project ref | `safc-selfhosted` |

---

## 2. Continuous Deployment (the normal path)

Deployment is automatic. **Push to `main` and GitHub Actions does the rest** — see
`.github/workflows/deploy.yml`:

1. `typecheck` job — `npm ci` + `npx tsc --noEmit`.
2. `deploy` job — authenticates to GCP via **Workload Identity Federation** (no stored keys),
   builds the Docker image, pushes to Artifact Registry, deploys to Cloud Run, then runs a smoke
   test against `/`, `/membership`, and `/login` (must all return `200`).

> **Server secrets are NOT set by the workflow.** They live on the Cloud Run service and are
> preserved across deploys. Only the public `VITE_*` client config is baked into the image at build
> time (anon key + URL — public by design). See §4 to change a server secret.

To trigger a deploy without a code change: GitHub → Actions → **Deploy to Cloud Run** → *Run workflow*.

---

## 3. First-time Infrastructure Bootstrap

Only needed once (already done for `safc-prod`). `deploy/deploy.sh` provisions everything: enables
APIs, creates the Artifact Registry repo, builds + deploys the first image, reserves a global IP,
and stands up the HTTPS load balancer + managed certificate for `southafricafc.com`.

```bash
BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX bash deploy/deploy.sh
```

After it prints `LB_IP`, point the domain's DNS **A record** (`@` and `www`) at that IP. The
Google-managed cert validates automatically once DNS resolves (can take up to ~30 min).

---

## 4. Environment Variables

### Client-visible — baked into the browser bundle at build time

Set as Docker build args (the workflow + `deploy/deploy.sh` already pass these):

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` | `https://34.35.110.246.sslip.io` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Self-hosted anon JWT (public by design) |
| `VITE_SUPABASE_PROJECT_ID` | `safc-selfhosted` |

### Server-only — live on the Cloud Run service, never exposed to the browser

Never give these a `VITE_` prefix; they are read via `process.env.*` inside server functions only.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Self-hosted Supabase API URL |
| `SUPABASE_PUBLISHABLE_KEY` | Anon key (server-side reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — full DB access; treat as a secret |
| `STRIPE_SECRET_KEY` | Stripe **live** secret key (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the `/api/stripe/webhook` endpoint |
| `STRIPE_PRICE_BASIC_MONTHLY` | Price ID — SA FC Basic, monthly |
| `STRIPE_PRICE_BASIC_ANNUAL` | Price ID — SA FC Basic, annual |
| `STRIPE_PRICE_PREMIUM_MONTHLY` | Price ID — SA FC Premium, monthly |
| `STRIPE_PRICE_PREMIUM_ANNUAL` | Price ID — SA FC Premium, annual |
| `STRIPE_PRICE_FOUNDER_MONTHLY` | Price ID — Founding Member, monthly |
| `STRIPE_PRICE_FOUNDER_ANNUAL` | Price ID — Founding Member, annual |
| `API_FOOTBALL_KEY` | API-Football (live scores / fixtures) |
| `FOOTBALL_DATA_API_KEY` | football-data.org |
| `NEWS_API_KEY` | NewsAPI (article feed) |

To update a server secret on Cloud Run:

```bash
gcloud run services update safc-web \
  --project safc-prod --region africa-south1 \
  --update-env-vars STRIPE_WEBHOOK_SECRET=whsec_xxx
```

(Existing env vars are preserved; only the listed keys change.)

---

## 5. Stripe Configuration

- **Mode:** live. Currency **ZAR**.
- **Membership tiers & pricing** (annual ≈ 2 months free; see `src/lib/tiers.ts`):

  | Tier | Monthly | Annual |
  |---|---|---|
  | SA FC Basic | R49 | R490 |
  | SA FC Premium | R99 | R990 |
  | Founding Member — Starting XI (cap **111**) | R299 | R2,990 |

- **Webhook:** endpoint `https://southafricafc.com/api/stripe/webhook`, subscribed to
  `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Its signing secret is
  `STRIPE_WEBHOOK_SECRET`.
- **Branding:** Checkout shows **SA FC** (set per-session via `branding_settings` in
  `src/lib/billing.functions.ts`).
- **Dashboard-only items (set manually in Stripe → Settings):** enable customer receipt emails
  (Successful payments + Refunds) and set the public business name to **SA FC** with support site
  `southafricafc.com`. These can't be set via API.

Local Stripe testing uses test-mode keys/price IDs and `stripe listen` (its printed secret becomes
`STRIPE_WEBHOOK_SECRET` locally).

---

## 6. Auth & Email (self-hosted Supabase / GoTrue)

- Auth runs in the GoTrue container on the `supabase-1` VM (`/opt/supabase`).
- **SMTP:** Gmail via Google Workspace, authenticated as `di@thirdculture.world` (app password).
  - `GOTRUE_SMTP_SENDER_NAME=SA FC`
  - `GOTRUE_SMTP_ADMIN_EMAIL=noreply@southafricafc.com` (alias of `di@`; Gmail may rewrite the
    `From` to `di@` until the alias send-as propagates).
- After editing `/opt/supabase/.env` on the VM, apply with:

  ```bash
  gcloud compute ssh supabase-1 --project safc-prod --zone africa-south1-a \
    --account di@thirdculture.world \
    --command "cd /opt/supabase && sudo docker compose up -d auth"
  ```

> When running `gcloud` against `safc-prod`, pass `--account di@thirdculture.world` if your active
> gcloud account is a different service account.

---

## 7. Local Development

```bash
npm install
set -a && . ./.env && set +a && npm run dev
```

`.env` (gitignored) holds local values. **Do not quote values** — quotes break SSR env parsing.
Sourcing `.env` explicitly is required so values are available during SSR, not just to Vite.

---

## 8. Post-deploy Verification

The CI smoke test covers `/`, `/membership`, `/login`. For a manual pass after a release:

| Route | Expected |
|---|---|
| `GET /` | Home loads |
| `GET /membership` | Tiers + monthly/annual toggle load |
| `GET /login` | Login page loads |
| `GET /signup` | Signup page loads |
| `GET /news` | News feed loads |
| `GET /community` | Community feed loads |
| `GET /events` | Events list loads |
| `GET /movement` | Movement page loads |
| `GET /news/<slug>` | Dynamic article loads |
| Hard refresh on any of the above | `200`, not `404` (SSR routing) |
| Checkout → membership purchase | Redirects to Stripe, returns to `/membership` |
| Password reset email | Delivered with **SA FC** sender |

---

## 9. Routing Rules

- File-based routing (`src/routes/`). See `src/routes/README.md` for conventions.
- `src/routeTree.gen.ts` is auto-generated — never edit by hand; add/remove routes by
  creating/deleting files in `src/routes/`.
- Keep `createServerFn`, auth, and SSR intact — do **not** convert to a static SPA.
- Server-only secrets must never carry a `VITE_` prefix.
