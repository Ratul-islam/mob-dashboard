# Anura Traffic Dashboard

A private dashboard for Anura traffic quality data:

- **Backend** (this folder): Fastify + MySQL (Drizzle ORM). Handles sign-in, user accounts, and a caching proxy to the [Anura Reporting API](https://docs.anura.io/api). The Anura token never reaches the browser.
- **Frontend** (`frontend/`): Next.js dashboard with live breakdown tables, a daily trend, and a raw row explorer.

## Features

**Accounts**
- One **root** user is created from `.env` on first start.
- Root creates accounts for other people, gets a one-time temporary password to hand over, and can disable, reset or delete accounts.
- Everyone can change their own name, email and password. Anyone signed in with a temporary password must set a new one first; the API enforces this too.
- Sessions use a short-lived access token held in memory plus a rotating refresh token in an httpOnly cookie. Changing a password or email signs out other sessions.
- Forgot password sends an emailed 6-digit code (needs SMTP).

**Live dashboard** (Anura `/direct/*` endpoints, auto-refresh from 15s to 5 min)
- Totals: requests, non-suspect, suspect with rate, and mobile.
- Daily trend covering 14 or 31 days, with a chart view and a table view.
- Breakdown tables: sources and campaigns, geography (country → region → city), networks, connections, device types, devices (manufacturer → model), browsers (→ version), and operating systems (→ version).
- In every table:
  - server-side sorting (shift-click to sort by up to 3 columns);
  - search;
  - pagination;
  - drill-down with breadcrumbs;
  - per-column show/hide;
  - optional Anura **rate** and **rule set** columns;
  - CSV export.
- Filter by date range (UTC; presets up to a month, custom ranges up to 31 days), instance, source and campaign. Clicking a source row filters the whole dashboard.
- Anura's breakdown tables and source/campaign lists only accept 7 days per request. For longer ranges the API fetches 7-day pieces, adds them up, and does the sorting, search and paging itself.
- **Customize**: show, hide and reorder every panel. This is saved per browser.

**Raw data** (Anura `/raw/*` endpoints)
- Row-level data (IP, user agent, rule sets, invalid traffic type, device ID…) is only available from Anura as *raw data reports*. Anura builds these on request, usually within seconds.
- Request a report (optionally with Anura-side filters). The API waits for it and **imports it into MySQL automatically**. "Fetch today's rows" and an optional auto-sync interval keep today's data fresh.
- Explorer features:
  - value breakdowns (click a value to filter);
  - an hourly suspect/non-suspect chart;
  - search across all columns;
  - custom filters;
  - sorting and paging;
  - column show/hide;
  - a detail view for each row.
- Each report uses at least one of the account's daily Anura processing minutes (360 by default). The page shows how many are left.

## Requirements

- Node.js 20+ (tested on 22)
- MySQL 5.5 or newer. Tables are created and migrated automatically on startup. On local MySQL the database is created too; hosted databases must already exist.

## Setup

```bash
# Backend
npm install
cp .env.example .env        # then fill it in (see below)
npm run dev                 # http://localhost:8000

# Frontend (second terminal)
cd frontend
npm install
cp .env.example .env.local  # BACKEND_URL=http://localhost:8000
npm run dev                 # http://localhost:3000
```

Sign in at http://localhost:3000 with `ROOT_EMAIL` / `ROOT_PASSWORD`.

### Backend `.env`

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `mysql://USER:PASSWORD@HOST:3306/DATABASE`. URL-encode special characters in the password. |
| `DB_POOL_SIZE` | no | Max DB connections (default 5). Lower it if your host caps connections per user. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_PASS_RESET_SECRET` | yes | Long random strings, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ROOT_NAME`, `ROOT_EMAIL`, `ROOT_PASSWORD` | first start | Creates the root user only if none exists. A password under 8 characters must be changed at first sign-in. |
| `ANURA_API_TOKEN` | yes | From https://dashboard.anura.io/api |
| `ANURA_INSTANCE_ID` | recommended | Default instance for the dashboard and raw reports |
| `ANURA_BODY_FORMAT` | no | `auto` (default), `json` or `form` |
| `ANURA_CACHE_TTL_SECONDS` | no | Server-side cache for live data (default 15) |
| `CORS_ORIGIN` | no | Only needed if a browser calls the API directly instead of through Next |
| `COOKIE_SECURE` | no | Defaults to `true` in production. Needs HTTPS. |
| `SMTP_*` | no | Needed for "forgot password". Without SMTP, dev mode logs the code instead. |

## Production

```bash
npm run build && npm start                     # run from the project root (migrations live in ./drizzle)
cd frontend && npm run build && npm start      # set BACKEND_URL at build time
```

Put both behind HTTPS. The frontend proxies `/api/v1/*` to the backend, so the browser only talks to Next.js.

Raw report import and auto-import run in the background of the API process, so run the backend as a long-lived Node server. On serverless hosts (e.g. `vercel.json`), background imports may be cut off.

## Project structure

```
src/
  application.ts, server.ts, vercel.ts
  config/          env (config.ts), MySQL + migrations (db.ts)
  plugins/         jwt + auth guards, security (helmet, cors, cookies, rate limit), error handler
  modules/
    auth/          login, refresh, logout, password reset
    user/          user table + root-only user management  (/api/v1/user)
    account/       the signed-in user's own profile/password (/api/v1/account)
    anura/         Anura client, live reports, raw report import + queries (/api/v1/anura)
    otp/, notification/
drizzle/           SQL migrations (generate with `npx drizzle-kit generate` after changing *.model.ts)
frontend/          Next.js app
```
