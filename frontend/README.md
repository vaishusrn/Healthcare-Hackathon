# Uniklikum X — Command Center (frontend)

Live hospital dashboard: 3D overview + Logistics / Patients / Employees / Financial.
Reads the real API through a Vite proxy.

## Run

1. Backend (repo root): `bun run db:reset && bun run dev`  (serves :3000)
2. Frontend (this dir): `bun install && bun run dev`  (serves :5173)

Open http://localhost:5173.

## Test / typecheck

```bash
bun run test        # vitest (pure modules)
bun run typecheck   # types
```

## Notes

- Polling: every page auto-refreshes every 5s (TanStack Query).
- "Reseed demo data" (top bar) calls `POST /v1/database-seeds` to reset the hospital live.
- MSW is still initialized in dev, but no API routes are intercepted; `/v1/*`
  traffic passes through the Vite proxy to the backend.
