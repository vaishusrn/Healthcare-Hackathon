# Floor-Plan Frontend Rewrite — Wave 2 Spec

Date: 2026-07-10
Status: Draft (design). Detailed plan authored after Wave 1 lands so the
renderer can be iterated visually against the real scaled dataset.
Parent design: `docs/superpowers/specs/2026-07-10-floorplan-rewrite-and-scale-design.md`
Depends on Wave 1 (backend) endpoints: `/v1/ops/summary`, `/v1/ops/floors`, `/v1/ops/floors/detail`.

## Purpose

Replace the current "nested boxes" 2D view with a real architectural **floor
plan** — a central **spine corridor** with **double-loaded ward corridors**
(standardized rooms lining both sides, with slight size jitter), secretariat
(0-bed) rooms, a nurse station, and service cores — that **fills its container**
and is navigable **Building ▸ Floor**. At ~11k beds the browser can no longer
hold the whole hospital, so Overview reads **aggregate** KPIs and **one floor's**
detail from the new endpoints instead of `fetchAll`-ing every row.

## Non-negotiable realities (from the scaled data)

- **Never `fetchAll` beds/patients/visits.** 64k patients ≈ 640 requests; a
  floor is ~100–200 beds. Overview uses `/ops/summary` for KPIs and
  `/ops/floors/detail` for exactly the floor on screen.
- **Render one floor at a time.** A floor's wards (a handful) render as SVG;
  hospital-wide totals come from `/ops/summary`.

## Data layer (`src/lib/api/*`)

New 5s-polled hooks (replace the Overview's `useBeds/useStations/useRooms/...`):

```ts
useOpsSummary(date: string): UseQueryResult<OpsSummary>
  // GET /v1/ops/summary?date=YYYY-MM-DD
useFloors(): UseQueryResult<FloorSummary[]>
  // GET /v1/ops/floors  → [{ building, level, label, ward_count, bed_total, occupied, occupancy_pct }]
useFloorDetail(building: string, level: number): UseQueryResult<FloorDetail>
  // GET /v1/ops/floors/detail?building=<>&level=<>
  //   FloorDetail = { wards: { id, name, station_type, department,
  //     rooms: { id, name, room_type, bed_capacity, current_capacity,
  //       beds: { id, status, room, patient? }[] }[] }[] }
```

Types added to `src/lib/api/types.ts`: `OpsSummary`, `FloorSummary`,
`FloorDetail` (+ nested `FloorWard`/`FloorRoom`/`FloorBed`), snake_case matching
the backend serializers.

## Floor-layout engine (`src/lib/floor-layout.ts`, new, pure + tested)

`computeFloorPlan(floor: FloorDetail): FloorPlanGeometry` — deterministic
(same input → identical geometry). Produces, in a fixed SVG coordinate space that
**fills the container** (viewBox scaled to the card, `preserveAspectRatio`):

- **Spine corridor** down/across the floor; **branch corridors** per ward.
- Each ward = a **double-loaded corridor**: standardized room modules on both
  sides, small deterministic size jitter (±~8%) so it reads as real but tidy
  ("approx same flooring, little room differences").
- **SECRETARIAT rooms** rendered distinctly (office hatch, no bed dots, 0 beds).
- **Nurse station** (Stationszimmer) + **service cores** (Treppe/Aufzug/WC) at
  corridor junctions.
- Beds placed inside patient rooms as status dots (green/amber/red), each
  carrying `{ id, status, room, ward, department, patient? }` for the inspector.
- Output: `{ walls, corridors, wardZones, rooms, beds, labels, bounds }` — the
  renderer is dumb; all geometry is here and unit-tested (room counts, no bed in
  a secretariat, corridors connect, geometry within bounds, determinism).

## Renderer (`src/components/floor-plan/*`)

- `HospitalFloorPlan` (rewrite): SVG that **fills the card** (responsive
  viewBox), draws corridors/walls/wards/rooms/beds/labels from
  `FloorPlanGeometry`. Building + Floor selectors (from `useFloors`), a bed
  legend, and a per-floor summary chip. Click/hover a bed → `BedInspector`
  (room, ward, department, status, patient if occupied).
- Loading/empty/error states (a floor with no wards → friendly empty).

## Overview wiring (`src/routes/overview.tsx`)

- KPI rail ← `useOpsSummary(DEMO_TODAY)` (occupied/free/reserved, capacity %,
  active in/out, appts today, staff on shift, patients total). No
  whole-hospital model is ever built in the browser.
- `building`/`level` state drives `useFloorDetail`; default to the first floor
  from `useFloors`. Alerts/staffing cards unchanged.
- 3D scene (optional, secondary): extrude the same `FloorDetail` (or hide behind
  a toggle) — reuse the geometry from `computeFloorPlan` where possible.

## Other pages (de-`fetchAll`)

- **Logistics / Patients / Employees:** KPI numbers from `/ops/summary`; tables
  fetch page 1 + cursor (server-side pagination) instead of every row. Patients
  table shows a page at a time with a "load more"/next-cursor control; a search
  box can be added later (out of scope now).

## Testing

- Pure `floor-layout` engine: determinism, room/corridor/bed counts match the
  input floor, no bed inside a secretariat room, geometry within bounds, "fills
  container" (bounds match the target viewBox).
- Hook wiring smoke (mock fetch) + a controller-driven **headless-Chrome visual
  pass** (screenshots per building/floor) during execution — this is why the
  detailed plan is written after Wave 1: iterate the renderer against real data.

## Out of scope (Wave 2)

- Whole-hospital single-screen render; hand-authored geometry; auth; patient
  search UI; mobile layout.

## CONFIRMED live contracts (Wave 1 shipped — use verbatim)

```
GET /v1/ops/summary?date=YYYY-MM-DD → { data: {
  beds:{ total, free, reserved, occupied, occupancy_pct },
  capacity:{ current, max, pct },
  visits:{ active, active_inpatient, active_outpatient, discharged },
  patients:{ total }, employees:{ total }, departments:{ total }, wards:{ total },
  appointments_on_date } }

GET /v1/ops/floors → { data: [ { building, level, label, ward_count,
  bed_total, occupied, occupancy_pct } ] }        // ~70 entries, level 0 = EG

GET /v1/ops/floors/detail?building=<>&level=<> → { data: {
  building, level, label,
  wards: [ { id, name, station_type, department,
    rooms: [ { id, name, room_type, bed_capacity, current_capacity,
      beds: [ { id, status, room, patient?: { first_name, last_name, patient_number } } ] } ] } ] } }
  // SECRETARIAT rooms: room_type "SECRETARIAT", beds: []. 404 if floor empty; 422 bad params.
  // `building` must be URL-encoded (en-dash: "Haus 1 – Bettenhaus"). `level` is 0-indexed.
```

Decisions locked: floor identity = `building` (string) + `level` (int, 0=EG);
keep the 3D scene as an optional secondary card (2D floor plan is primary).
