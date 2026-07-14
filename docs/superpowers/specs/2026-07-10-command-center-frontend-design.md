# Uniklikum X Command Center — Frontend Design

Date: 2026-07-10
Status: Approved (design), pending implementation plan
Scope: **Frontend only. No backend changes.**

## Purpose

Build a hospital "command center" dashboard for `Uniklikum X` on top of the
existing Bun/Elysia/SQLite healthcare API. It is primarily a **display**
surface for live operational information, used in presentations. It must look
polished, enterprise-grade, and consistent, and it must **auto-refresh every 5
seconds** so it feels live on a big screen.

Four operational domains plus a 3D overview:

- **Overview** — a true 3D view of the hospital (the centerpiece).
- **Logistics** — capacity, stations, rooms, beds.
- **Patients** — visits and appointments.
- **Employees** — staff directory.
- **Financial** — revenue/costs (no backend data exists; fully mocked).

## Hard constraints

1. **Do not modify the backend.** No new endpoints, no CORS changes, no schema
   changes. Real data is read through a Vite dev proxy. Everything the backend
   does not have is mocked in the frontend with **MSW**.
2. **5-second polling** on every data-driven page (TanStack Query
   `refetchInterval: 5000`).
3. Use the **TanStack** ecosystem (Query, Router, Table).
4. Use **shadcn/ui** initialized with preset `b67feOKh72` and the Vite template.
5. **Light enterprise** visual theme.

## Backend facts the frontend relies on

The API is a clean five-level hierarchy, all read via cursor-paginated
`GET /v1/...` list endpoints (`page_size` up to 100; a single request returns
all rows at current seed scale):

```
Uniklikum X → 12 Departments → 24 Stations (INTENSIVE/NORMAL) → 48 Rooms → 96 Beds
```

Relevant real endpoints and their live signals:

| Domain | Real endpoints | Live signal |
| --- | --- | --- |
| Logistics | `/departments`, `/stations`, `/rooms`, `/beds` | Bed `status` FREE/RESERVED/OCCUPIED; dept `current_capacity`/`max_capacity`; room `bed_capacity`/`current_capacity` |
| Patients | `/patients`, `/patient-visits`, `/appointments`, `/appointment-types` | Visit `status` ACTIVE/DISCHARGED, `visit_type` INPATIENT/OUTPATIENT; appointments by date |
| Employees | `/employees` | Name, position, department (24 staff / 12 depts) |
| Financial | none | Only `insurance_type` STATUTORY/PRIVATE on SSNs |

Response conventions: top-level `data` envelope; list responses add
`pagination` (`self`, `next?`, `prev?`, `has_more`); snake_case fields;
Europe/Berlin local timestamps; RFC 9457 Problem Details on error.
`POST /v1/database-seeds` resets and reseeds the whole hospital (used by the
"Reseed demo data" button — an existing endpoint, not a backend change).

Notable gaps handled in the frontend, not the backend:

- No financial data → mocked.
- No aggregate/stats endpoints → aggregates computed client-side from real lists.
- No 3D geometry/coordinates → layout synthesized deterministically from the hierarchy.
- No employee shift/on-call state and no alert feed → mocked (command-center feel).

## Tech stack

- **Vite + React + TypeScript**, scaffolded via the shadcn Vite template and
  preset `b67feOKh72`.
- **Tailwind + shadcn/ui**, light theme.
- **TanStack Query** — fetching + 5s polling.
- **TanStack Router** — typesafe routing.
- **TanStack Table** — data grids.
- **react-three-fiber + @react-three/drei + three** — the 3D hospital.
- **MSW (Mock Service Worker)** — mocks the not-yet-real endpoints. Real
  `/v1/*` requests bypass MSW (`onUnhandledRequest: 'bypass'`) and hit the Bun
  API through the Vite proxy.
- **shadcn charts (Recharts under the hood)** — 2D charts, consistent with the
  preset.

## Architecture

```
frontend/
  src/
    main.tsx                 # bootstraps MSW (dev), QueryClient, Router
    routes/                  # TanStack Router
      __root.tsx             # AppShell (sidebar + top bar + live clock)
      index.tsx              # Overview (3D hero + KPI rail)
      logistics.tsx
      patients.tsx
      employees.tsx
      financial.tsx
    lib/
      api/
        client.ts            # base fetch, data-envelope unwrap, fetchAll pagination
        types.ts             # API response types (mirror OpenAPI shapes)
        queries.ts           # typed useXxx hooks with 5s refetchInterval
      hospital-model.ts      # PURE: (departments, stations, rooms, beds) -> scene tree + coords
      kpis.ts                # PURE: aggregations over real lists
    mocks/
      handlers.ts            # MSW handlers for /v1/financial/* and /v1/ops/*
      generators.ts          # deterministic mock data (seeded from real payer mix)
      browser.ts             # setupWorker
    components/
      layout/                # AppShell, Sidebar, TopBar, LiveBadge, PollingIndicator, ReseedButton
      kpi/                   # KpiTile, CapacityBar, StatusDot
      three/                 # HospitalScene, DepartmentFloor, RoomBlock, BedInstances, SceneControls, BedInspector, Fallback2D
      tables/                # DataTable wrapper + column defs
      charts/                # shadcn chart wrappers
    styles/
```

### Boundaries

- **`lib/api`** is the only module that performs HTTP. Both real and MSW routes
  go through it, so components are agnostic to what is mocked. `fetchAll` walks
  `pagination.next` until `has_more` is false.
- **`lib/hospital-model.ts`** is pure and deterministic: same input → same
  coordinates, so the 3D scene does not jitter across polls. Unit-tested for
  correct counts and stable layout.
- **`lib/kpis.ts`** is pure; unit-tested for aggregation math.
- **`components/three/*`** render the scene graph only; no data fetching inside.
- **`mocks/*`** are isolated and deletable once the backend implements the
  contract below.

## The 3D Overview (centerpiece)

- **Layout synthesis** (`hospital-model.ts`): each of the 12 departments becomes
  a floor/wing block; its stations split the block; rooms lay out in a grid; each
  room holds its beds (2 in seed data). Coordinates are derived deterministically
  from stable public IDs / index order.
- **Rendering**: stylized cutaway building. Beds rendered via instanced meshes
  (`<Instances>`) for performance (96 now, headroom for more). Bed color = status
  (green FREE / amber RESERVED / red OCCUPIED). Department blocks tint by
  utilization (`current_capacity / max_capacity`).
- **Interaction**: OrbitControls (drag-rotate, scroll-zoom). Hover a bed/room →
  tooltip. Click a bed → `BedInspector` side panel showing room, station,
  department, bed type, material, status, and the active patient visit mapped to
  that bed (if any). Click a floor → focus/filter that department.
- **Live**: bed statuses refetch every 5s; changed beds animate a soft color
  transition. A "LIVE" pulse and last-updated timestamp sit in a corner overlay.
- **Theme**: light studio background/soft shadows to match the light enterprise
  theme; colored beds pop against the light building.
- **Robustness**: wrapped in `<Suspense>`; a 2D isometric CSS/SVG fallback
  renders if WebGL is unavailable, so a presentation never shows a blank canvas.

## Pages

| Route | Content | Data |
| --- | --- | --- |
| `/` Overview | 3D hospital + KPI rail (beds occ/free/res, capacity %, active in/outpatients, appointments today, staff on duty, open alerts) + live alerts ticker | Real + MSW (alerts, staffing) |
| `/logistics` | Department capacity bars, station INTENSIVE/NORMAL split, bed-status matrix, room occupancy table (`bed_capacity` vs `current_capacity`), filter by department | Real |
| `/patients` | Active-visits board (in/outpatient, active/discharged) by department, today's appointment schedule, patient directory table | Real |
| `/employees` | Staff directory table, headcount-by-department chart, mocked on-shift/on-call overlay | Real + MSW |
| `/financial` | Revenue today/MTD, payer mix (seeded from the real STATUTORY/PRIVATE split), cost breakdown, revenue trend chart, outstanding invoices table, revenue by department | MSW (full) |

## MSW "v-next" contract

Mocked now, implementable by the backend later against the **same conventions**
(`data` envelope, snake_case, cursor pagination on lists):

- `GET /v1/financial/summary` → revenue_today, revenue_mtd, outstanding, payer_mix {statutory, private}, cost totals.
- `GET /v1/financial/revenue-trend?days=30` → daily revenue/cost series.
- `GET /v1/financial/by-department` → per-department revenue and cost.
- `GET /v1/financial/invoices` → paginated invoices (status, amount, payer, department).
- `GET /v1/ops/alerts` → live operational alert feed (capacity warnings, code events); polled every 5s.
- `GET /v1/ops/staffing` → on-shift / on-call counts per department.

Financial figures are seeded deterministically and, where possible, correlated
to real data (payer mix from the real insurance split; revenue scaled by real
occupancy and appointment volume) so the mock stays plausible and stable.

## Data & polling strategy

- One `QueryClient`; defaults `refetchInterval: 5000`, `staleTime: 4000`,
  `refetchOnWindowFocus: true`. Query keys per resource; the 3D scene and the
  Logistics page share the beds query cache.
- Errors are non-blocking: keep the last good data, show a subtle "reconnecting"
  state, no full-screen error on a transient poll failure.
- Top bar: live clock, polling/last-updated indicator, manual pause/refresh, and
  a **"Reseed demo data"** button that calls the existing
  `POST /v1/database-seeds` to reset the hospital live during a demo.

## Dev wiring

- Vite `server.proxy`: `/v1` → `http://localhost:3000`.
- MSW intercepts only the mock routes; all other `/v1/*` requests bypass to the
  proxy. MSW runs in dev only.
- Run: backend `bun run dev` (port 3000) + `cd frontend && bun run dev`
  (Vite). A convenience script may be documented in the frontend README.

## Testing

- TDD the pure modules: `hospital-model` (counts, deterministic/stable layout),
  `kpis` (aggregation math), mock `generators` (shape matches the contract,
  determinism).
- Component smoke tests optional at hackathon pace.

## Out of scope (YAGNI)

- Authentication / authorization.
- Write flows beyond the reseed button (no create/edit UIs).
- Mobile/responsive polish (target is a large presentation screen).
- Internationalization (domain text is German from the data; UI chrome is English).
- Any backend modification.
```
