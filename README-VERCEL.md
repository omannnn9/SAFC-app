# Vercel Deployment Guide — Bafana Supporters Club

> **Scope:** Deploy the existing TanStack Start + Supabase full-stack app to Vercel **without** converting it to a static SPA. Server functions, auth, and API-key security remain intact.

---

## 1. Prerequisites

- A **GitHub account**
- A **Vercel account**
- Your **API-Football** key (from [dashboard.api-football.com](https://dashboard.api-football.com))
- Your **NewsAPI** key (from [newsapi.org](https://newsapi.org))

---

## 2. Export Code to GitHub

1. In the Lovable editor, click the **(+) menu → GitHub → Connect project**.
2. Authorize the Lovable GitHub App.
3. Click **Create Repository**.
4. Lovable will push the full codebase to a new GitHub repo and keep it in sync.

> **Important:** You will edit `vite.config.ts` on a **dedicated branch** (see Step 3). Do **not** change the default branch — Lovable’s live preview relies on the Cloudflare target.

---

## 3. Create the Vercel Branch

In your local clone or on GitHub:

```bash
git checkout -b vercel
git push -u origin vercel
```

All Vercel-specific changes go on this branch. The `main` branch stays compatible with Lovable’s Cloudflare preview.

---

## 4. Replace `vite.config.ts` for Vercel

On the `vercel` branch, overwrite `vite.config.ts` with this direct TanStack Start config:

```ts
import { defineConfig } from "@tanstack/react-start/config";

export default defineConfig({
  tanstackStart: {
    target: "vercel",
    server: { entry: "server" },
  },
});
```

**Why this change is required:**
- `@lovable.dev/vite-tanstack-config` bundles the Cloudflare Workers target by default (needed for Lovable preview).
- Vercel requires `target: "vercel"` so TanStack Start generates the correct serverless functions and routing in `.vercel/output`.

> Do **not** install `@tanstack/react-start/config` separately — it is already a transitive dependency. If the build fails with a missing module, run `npm install`.

---

## 5. Vercel Project Settings

Create a new project in Vercel and import the GitHub repo.

| Setting | Value |
|---|---|
| **Framework Preset** | `Other` |
| **Build Command** | `npm run build` |
| **Output Directory** | *(leave blank)* |
| **Install Command** | `npm install` |
| **Node Version** | `20.x` (or later) |
| **Production Branch** | `vercel` |

**Why leave Output Directory blank:**
TanStack Start’s Vercel target writes its own output to `.vercel/output` and generates `.vercel/output/config.json` automatically. Setting a custom output directory breaks the serverless function routing.

---

## 6. Environment Variables

Add these in **Vercel → Project Settings → Environment Variables**.

### Server-only (never exposed to the browser)

| Variable | Source / How to get it |
|---|---|
| `SUPABASE_URL` | Your Lovable Cloud database URL (e.g. `https://xlgwmqmaeodhhkzuvqze.supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` | Your Lovable Cloud anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Lovable Cloud → Settings → API → Service Role Key** (treat as a secret) |
| `API_FOOTBALL_KEY` | Your API-Football dashboard key |
| `NEWS_API_KEY` | Your NewsAPI dashboard key |

### Client-visible (prefixed with `VITE_`)

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as `SUPABASE_PUBLISHABLE_KEY` |
| `VITE_SUPABASE_PROJECT_ID` | The project ID portion of the Supabase URL (e.g. `xlgwmqmaeodhhkzuvqze`) |

> **Security note:** The `SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`, and `NEWS_API_KEY` must **never** have a `VITE_` prefix. They are read via `process.env.*` inside server functions only. TanStack Start bundles them into the serverless function, not the client JS.

---

## 7. Supabase Auth Configuration

If you use email/password or OAuth (e.g. Google) sign-in, add your Vercel production URL to the Supabase Auth redirect allow list.

1. Go to **Lovable Cloud → Authentication → URL Configuration**.
2. Under **Redirect URLs**, add:
   - `https://<your-vercel-domain>.vercel.app/auth/callback`
   - `https://<your-custom-domain.com>/auth/callback` (if you add a custom domain later)
3. Under **Site URL**, set your production root: `https://<your-vercel-domain>.vercel.app`

---

## 8. Deploy

1. Push the `vercel` branch to GitHub.
2. Vercel will auto-deploy if you linked the branch.
3. If deploying manually: **Vercel Dashboard → Project → Deployments → Redeploy**.

---

## 9. Verification Checklist

Test these immediately after the first successful deploy:

| Route | Expected Result |
|---|---|
| `GET /` | Home page loads, no 404 |
| `GET /news` | News section loads |
| `GET /squad` | Squad list loads |
| `GET /fixtures` | Fixtures list loads |
| `GET /premium` | Premium page loads |
| `GET /login` | Login page loads |
| `GET /register` | Registration page loads |
| `GET /news/some-slug` | Dynamic news article loads |
| `GET /squad/af-123` | Dynamic player detail loads |
| **Hard refresh** on any of the above | Returns 200, not 404 |
| Server function call (e.g. fixtures data) | Returns JSON with match data |
| Google OAuth flow | Redirects correctly and logs user in |

---

## 10. Important Rules

| ❌ Do NOT | ✅ Do this instead |
|---|---|
| Add a `vercel.json` with rewrite rules | Let TanStack Start generate `.vercel/output/config.json` automatically |
| Prefix API keys with `VITE_` | Keep `API_FOOTBALL_KEY` and `NEWS_API_KEY` server-only |
| Convert the app to a static SPA | Keep `createServerFn`, auth, and SSR — that’s why the architecture is safe |
| Edit `src/routeTree.gen.ts` directly | Add/remove routes by creating/deleting files in `src/routes/` |
| Merge the `vercel` branch into `main` | Keep `main` for Lovable preview; use `vercel` branch only for Vercel |

---

## 11. Troubleshooting

### Build fails with "Cannot find module `@tanstack/react-start/config`"
Run `npm install` in the Vercel build settings or locally. The package is a transitive dependency but may need explicit resolution in some lockfiles.

### 404 on refresh or direct URL access
This means the Vercel target did not generate the serverless routing correctly. Verify:
- `vite.config.ts` has `target: "vercel"`
- Output Directory in Vercel settings is **blank**
- You are on the `vercel` branch, not `main`

### API data is missing
Check Vercel **Function Logs** for errors. Most commonly:
- `API_FOOTBALL_KEY` or `NEWS_API_KEY` is not set
- `SUPABASE_SERVICE_ROLE_KEY` is missing (required for the cache layer)

### Auth redirects to localhost or wrong domain
Update the **Site URL** and **Redirect URLs** in Lovable Cloud Authentication settings (Step 7).

---

## 12. Architecture Summary

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 19 + Tailwind CSS | Vercel Edge / Serverless |
| Router / SSR | TanStack Start (Vercel target) | Vercel |
| Server Functions | `createServerFn` | Vercel Serverless Functions |
| Database / Auth | Lovable Cloud (Supabase) | Managed |
| API Calls | API-Football, NewsAPI | Called from server functions only |
| Caching | Supabase `api_cache` table | Managed |

---

*Last updated: 2026-06-02*
