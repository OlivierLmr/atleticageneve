# Deployment Guide — Atletica Genève

## Live URLs

- **Frontend**: https://atleticageneve.pages.dev
- **API**: https://atletica-api.olivier-lemer.workers.dev

## Infrastructure

| Service | Provider | Details |
|---------|----------|---------|
| API | Cloudflare Workers | `atletica-api` worker |
| Frontend | Cloudflare Pages | `atleticageneve` project |
| Database | Cloudflare D1 | `atletica-db` (ID: `3b02051e-27b6-487b-acda-7b9224f74bee`, region: EEUR) |
| Emails | Console stub (dev) | Emails are logged in-memory and visible on the home page. Replace with Resend for production. |

## Test Credentials

### Collaborators / Committee (username + password login at `/auth/login`)

| Role | Username | Password | Name |
|------|----------|----------|------|
| Collaborator | `pierre` | `atletica2026` | Pierre Dupont |
| Collaborator | `sophie` | `atletica2026` | Sophie Martin |
| Committee | `admin` | `atletica2026` | Jean Président |

### Managers (magic link login at `/auth/magic-link`)

| Email | Name | Organization |
|-------|------|--------------|
| m.magnani@athletesgroup.it | Marcello Magnani | Athletes Group |
| j.smith@trackmanagement.com | John Smith | Track Management |
| k.berg@nordicathletics.no | Kari Berg | Nordic Athletics |
| a.mueller@swissrunning.ch | Anna Mueller | Swiss Running |
| p.jones@globaltrack.co.uk | Peter Jones | Global Track |

> Magic links are not actually emailed — the link appears in the dev email log on the home page. Copy the verification URL from there.

### Athletes

Athletes don't have pre-seeded login credentials. To test the athlete portal:
1. Go to `/signup` and register a new athlete with an email address
2. A magic link will appear in the dev email log on the home page
3. Click the link to verify and access the athlete portal

## Prerequisites

```bash
npx wrangler login
```

## First Deploy

### 1. Database — create, migrate, seed

```bash
# Only needed once — already done
# npx wrangler d1 create atletica-db

npx wrangler d1 migrations apply atletica-db --remote
npx wrangler d1 execute atletica-db --remote --file=src/api/db/seed.sql
```

### 2. Pages project — create

```bash
# Only needed once — already done
# npx wrangler pages project create atleticageneve --production-branch=main
```

### 3. API — deploy Worker

```bash
npx wrangler deploy src/api/index.ts
```

### 4. Frontend — build and deploy Pages

```bash
VITE_API_URL=https://atletica-api.olivier-lemer.workers.dev npm run build:web
npx wrangler pages deploy dist --project-name=atleticageneve --commit-dirty=true
```

## Redeployment

```bash
# API only
npm run deploy:api

# Frontend only (builds with correct API URL automatically)
npm run deploy:web

# Both
npm run deploy:api && npm run deploy:web

# Database migrations (when schema changes)
npx wrangler d1 migrations apply atletica-db --remote
```

## Architecture Notes

- **API base URL**: controlled by `VITE_API_URL` env var at build time (defaults to empty string for local dev)
- **CORS**: configured in `src/api/index.ts` — allows any `localhost` origin in dev + the production domain
- **Magic link URLs**: derived from the `Origin` request header, so they automatically point to the correct frontend
- **SPA routing**: `public/_redirects` ensures all routes serve `index.html` on Cloudflare Pages

## Useful Commands

```bash
# Check D1 database contents
npx wrangler d1 execute atletica-db --remote --command="SELECT count(*) FROM user"

# Tail worker logs (live)
npx wrangler tail atletica-api

# List D1 databases
npx wrangler d1 list
```
