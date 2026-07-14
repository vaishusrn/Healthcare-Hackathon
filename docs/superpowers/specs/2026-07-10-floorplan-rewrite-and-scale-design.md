# Realistic Uniklinikum Seed + 2D Floor-Plan Rewrite — Design

Date: 2026-07-10
Status: Approved (direction), pending implementation plan
Branch: `feat/floorplan-scale` (base commit `c863c21`)

## Purpose

Turn the demo hospital into a believable large German **Universitätsklinikum**
and replace the current "nested boxes" 2D view with a real architectural
**floor plan** (corridor-based wards) that fills its container. The dataset
grows to a scale (64k patients, 13k active, ~11k beds) that the current
"fetch every row and compute in the browser" approach cannot handle, so this
also introduces server-side **aggregate** and **floor-scoped** endpoints.

## Locked decisions (tunable via seed constants)

| Dimension | Target |
| --- | --- |
| Departments (Kliniken/Institute) | ~34 realistic German uni-clinic departments |
| Buildings (Häuser) | ~10 |
| Floors per building | EG + 1.–6. OG (~7 levels) |
| Wards (Stationen) | ~360 (each on one floor of one building, one department) |
| Rooms | ~7,200 (per ward: ~18 patient rooms + 1–2 secretariat/office + nurse station) |
| Staffed beds | ~11,000 |
| Occupied beds | ~9,270 (= active inpatients) → ~84% occupancy; remainder RESERVED/FREE |
| Employees | 1,000 |
| Patients | 64,324 |
| Active visits | 13,241 = ~9,270 INPATIENT (in beds) + ~3,971 OUTPATIENT |
| Appointment types | ~3 per department (~100) |
| Appointments | ~5,000 across a date range around 2026-07-10 |

- **Floor-plan view granularity:** one **floor** per view (its several wards,
  each a double-loaded corridor off a central spine) — this satisfies "more
  corridors" and stays legible (~100–200 beds on screen). Navigation:
  **Building ▸ Floor**.
- **Inpatient/bed model is flipped** to be realistic: an **INPATIENT** active
  visit occupies a bed (station+room+bed); an **OUTPATIENT** visit does not.
  An `OCCUPIED` bed corresponds to an active inpatient.

## Current state (what exists on `c863c21`)

- `frontend/src/lib/hospital-model.ts` — `computeLayout()` builds a whole-hospital
  layout: floors (4 depts/floor), one central corridor, top/bottom wings,
  stations stacked, rooms in grids, beds as points, plus 3D positions.
- `frontend/src/components/floor-plan/hospital-floor-plan.tsx` — SVG renderer
  (grid, outer wall, single corridor, Treppe/Aufzug cores, dept/station/room
  rects, bed dots, floor switcher, legend).
- `frontend/src/components/three/*` — 3D scene extruding the same floor.
- Overview = KPI rail + 2D plan (primary) + alerts + 3D below. Shared
  `frontend/src/lib/status-colors.ts`.
- Every page still `fetchAll`s all rows (breaks at the new scale).
- Backend: departments → stations → rooms → beds → patient_visits; no
  building/floor; `INPATIENT` visits are forbidden a bed (to be flipped).

## Backend changes

### Schema / migration (`src/db/schema.ts`, `src/db/migrate.ts`)

- `stations`: add `building TEXT NOT NULL` and `floor INTEGER NOT NULL` (level;
  0 = EG). A ward's location. Rooms/beds inherit location from their station.
- `room_type` enum: add `SECRETARIAT` (office; carries 0 beds). Existing types
  keep.
- Flip the patient_visits CHECK: an `INPATIENT` visit MUST have
  station+room+bed; an `OUTPATIENT` visit MUST NOT. (Currently the opposite.)
  Update the `migrateLegacyClinicSchema` path is unaffected; the CHECK is
  rewritten in the `CREATE TABLE` for a fresh DB (reseed recreates the file).

### Serializers (`src/api/serializers.ts`)

- `Station` gains `building: string`, `floor: number`.
- (Rooms/beds keep name-based references; floor/building derivable via station.)

### Seed (`src/db/seed.ts`) — realistic, deterministic, **batched**

- A curated list of ~34 German Uniklinikum departments (Kardiologie,
  Herzchirurgie, Neurologie, Neurochirurgie, Hämatologie/Onkologie,
  Gastroenterologie, Nephrologie, Pneumologie, Endokrinologie, Rheumatologie,
  Infektiologie, Dermatologie, Augenheilkunde, HNO, MKG-Chirurgie, Urologie,
  Frauenheilkunde/Geburtshilfe, Kinder- und Jugendmedizin, Kinderchirurgie,
  Orthopädie/Unfallchirurgie, Allgemein-/Viszeralchirurgie, Gefäßchirurgie,
  Thoraxchirurgie, Psychiatrie, Psychosomatik, Radiologie, Neuroradiologie,
  Nuklearmedizin, Strahlentherapie, Anästhesiologie/Intensivmedizin, ZNA,
  Palliativmedizin, Geriatrie, Transfusionsmedizin, …).
- ~10 buildings with themed names (Bettenhaus, Herzzentrum, Frauen-/Kinderklinik,
  Kopfklinik, Chirurgie, Onkologisches Zentrum, …); ~7 floors each; wards
  distributed so each department owns several wards, ICUs cluster sensibly.
- Ward naming: `Station <letter><level><nn>` / `<Dept-Kürzel> ITS`; ward type
  INTENSIVE/NORMAL. Room numbers like `H3-2.14`. Secretariat rooms named
  `Sekretariat <Dept>` / `Stationszimmer` with 0 beds.
- ~11,000 beds: patient rooms 1–2 beds (some 3–4 group rooms). Bed status set so
  ~9,270 OCCUPIED, a slice RESERVED, rest FREE.
- 64,324 patients + 64,324 SSNs from German name pools (deterministic index
  combination); 1,000 employees with realistic positions (Chefarzt/-ärztin,
  Oberarzt, Assistenzarzt, Pflegefachkraft, Stationsleitung, MTRA, …).
- 13,241 active visits: ~9,270 INPATIENT each pinned to a distinct OCCUPIED bed;
  ~3,971 OUTPATIENT (no bed); plus discharged history.
- ~100 appointment types (~3/dept), ~5,000 appointments.
- **Performance:** generate all rows in memory, insert with **chunked
  multi-row `INSERT` inside a single transaction** (no per-row
  `.returning().get()`), resolving foreign keys via precomputed
  publicId→internalId maps (deterministic id assignment or one post-insert
  id query per table). Target reseed < ~10s.

### New endpoints (`src/app.ts`, `src/repositories/healthcare.ts`, `openapi.yaml`)

1. `GET /v1/ops/summary?date=YYYY-MM-DD` → hospital-wide KPIs computed with SQL
   `COUNT`/`GROUP BY` (never row-by-row in the app):
   `{ data: { beds:{total,free,reserved,occupied,occupancy_pct},
   capacity:{current,max,pct}, visits:{active,active_inpatient,
   active_outpatient,discharged}, patients:{total}, employees:{total},
   departments:{total}, wards:{total}, appointments_on_date } }`.
2. `GET /v1/ops/floors` → navigation tree, light: buildings → floors with
   `{ building, level, label, ward_count, bed_total, occupied, occupancy_pct }`.
3. `GET /v1/ops/floors/detail?building=<>&level=<>` → one floor's full structure
   for rendering: `wards[] → rooms[] (incl. secretariat, room_type, bed_capacity,
   current_capacity) → beds[] (id, status, room, patient summary if occupied)`.
   Bounded (~150 beds). This is the floor-plan render source.
- All follow existing conventions (`data` envelope, snake_case, Problem Details,
  `422` on unknown query params). `proto` updated for the new shared response
  messages.

## Frontend changes

### Data layer (`src/lib/api/*`)

- New hooks: `useOpsSummary(date)`, `useFloors()`, `useFloorDetail(building, level)`
  — all 5s-polled. These **replace `fetchAll` on the Overview**.
- Logistics / Patients / Employees pages stop `fetchAll`-ing large resources:
  KPI numbers come from `useOpsSummary`; tables fetch **page 1 + cursor**
  (server-side pagination) rather than every row.

### Floor-plan rewrite (`src/lib/floor-layout.ts` new, `components/floor-plan/*`)

- New pure layout engine that takes **one floor's** `{ wards → rooms → beds }`
  and produces an architectural plan: a **central spine corridor** with
  **branch corridors** per ward, each ward a **double-loaded corridor** —
  standardized room modules on both sides with slight size jitter,
  **secretariat/office rooms (0 beds)** interleaved, a **nurse station**, and
  **service cores** (Treppe/Aufzug/WC). Deterministic. Rooms colored/annotated;
  beds as status dots. **Fills the container** (responsive viewBox, no dead
  space).
- Renderer: SVG that scales to the card; hover/click a bed → inspector (room,
  ward, department, status, patient if occupied). Building ▸ Floor selectors.
- The 3D scene extrudes the same single-floor layout (kept as a secondary
  card, optional toggle).

### Overview wiring (`src/routes/overview.tsx`)

- KPI rail ← `useOpsSummary`. Building/Floor state drives `useFloorDetail`.
  Alerts/staffing unchanged. No whole-hospital layout is ever built in the
  browser.

## Testing

- Backend: seed produces the target counts (assert approximate totals);
  `/ops/summary` numbers reconcile with row counts on a small in-memory seed;
  `/ops/floors` + `/floors/detail` shapes; the flipped inpatient/bed CHECK
  (INPATIENT requires bed, OUTPATIENT rejects bed). Update existing
  patient-visit tests to the new rule.
- Frontend: pure `floor-layout` engine (determinism, room/corridor counts,
  secretariat rooms present, fills bounds); KPI mapping.
- Perf smoke: reseed time and one floor-detail response size.

## Phasing (for the plan)

1. Backend schema + serializers + inpatient-bed flip (+ migrate/tests).
2. Backend realistic batched seed at scale.
3. Backend endpoints: `/ops/summary`, `/ops/floors`, `/ops/floors/detail`.
4. Frontend data hooks + Overview KPI rail on aggregates.
5. Frontend floor-layout engine (pure, tested).
6. Frontend floor-plan renderer + Building/Floor nav (fills container).
7. 3D scene adapted to single-floor detail; inspector.
8. Logistics/Patients/Employees pages de-`fetchAll` (server pagination).

## Out of scope / non-goals

- Real per-bed geometry authored by hand; layout stays synthesized (but from
  the richer building/floor/ward data).
- Auth, write flows beyond existing reseed/appointments.
- Rendering the whole hospital's beds at once (never — always one floor).

## Risks

- **Seed performance** at ~230k rows — mitigated by chunked transactional
  inserts (must avoid per-row returning). Verify reseed < ~10s.
- **Migration of an old DB** — reseed deletes/recreates the sqlite file
  (`db:reset`), so the new CHECK/columns apply cleanly; document it.
- **Frontend regressions** where pages assumed full client-side datasets — the
  de-`fetchAll` step must keep KPIs correct via aggregates.
