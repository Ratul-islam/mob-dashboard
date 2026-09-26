# Frontend

Next.js dashboard for the Anura Traffic Dashboard. See the [main README](../README.md) for the full setup.

```bash
npm install
cp .env.example .env.local   # BACKEND_URL=http://localhost:8000
npm run dev                  # http://localhost:3000
```

All `/api/v1/*` requests are proxied to `BACKEND_URL` (see `next.config.ts`), so the refresh-token cookie stays first-party and no CORS setup is needed.

- `src/app/(app)/`: signed-in pages (dashboard, raw data, users, account)
- `src/components/`: UI kit (`ui.tsx`), dashboard panels, charts, raw explorer
- `src/lib/`: API client with token refresh, auth context, React Query hooks
