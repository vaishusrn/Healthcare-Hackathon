# Floor-Plan Frontend Rewrite — Implementation Plan (Wave 2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. The renderer (Task 3) is iterated visually by the controller with headless-Chrome screenshots.

**Goal:** Replace the current 2D "nested boxes" view with a real architectural **floor plan** (central spine + double-loaded ward corridors, standardized rooms with slight jitter, secretariat/0-bed rooms, service cores) that **fills its container**, navigable **Building ▸ Floor**, fed by the new `/v1/ops/*` endpoints — and stop `fetchAll`-ing raw rows now that the hospital has 64k patients / 11k beds.

**Architecture:** Overview KPIs come from `/ops/summary`; the floor plan renders exactly one floor from `/ops/floors/detail`; navigation from `/ops/floors`. A pure `floor-layout.ts` engine turns a `FloorDetail` into SVG geometry; the renderer is dumb. Spec: `docs/superpowers/specs/2026-07-10-floorplan-frontend-wave2-spec.md` (has the exact live contracts).

**Tech:** Vite/React 19/TS6, TanStack Query (5s poll), shadcn (Base UI), SVG. Typecheck `bun run typecheck` (frontend, project refs → `tsc -b`); tests `bunx vitest run`.

## Global Constraints
- **Never `fetchAll` beds/patients/visits/rooms.** Overview uses only `useOpsSummary`, `useFloors`, `useFloorDetail`. Other pages fetch page 1 + cursor.
- Contracts are LOCKED (see spec). `level` is 0-indexed (0=EG); `building` is a string (URL-encode; en-dash "Haus 1 – Bettenhaus"). `patient?` present only on OCCUPIED beds.
- TS6: `verbatimModuleSyntax` (type-only imports), `erasableSyntaxOnly` (no enums/param-props), `noUnusedLocals/Params`. Light theme only. Proxy `/v1` → :3000 already configured.
- Status colors from `src/lib/status-colors.ts` (FREE #10b981 / RESERVED #f59e0b / OCCUPIED #f43f5e).

---

## Task 1: Types + data hooks

**Files:** Modify `frontend/src/lib/api/types.ts`, `frontend/src/lib/api/queries.ts`
**Produces:** types `OpsSummary`, `FloorSummary`, `FloorDetail` (+ `FloorWard`/`FloorRoom`/`FloorBed`/`FloorPatient`); hooks `useOpsSummary(date)`, `useFloors()`, `useFloorDetail(building, level)`.

- [ ] Add types matching the locked contracts exactly (snake_case), e.g.:
```ts
export interface OpsSummary {
  beds: { total: number; free: number; reserved: number; occupied: number; occupancy_pct: number };
  capacity: { current: number; max: number; pct: number };
  visits: { active: number; active_inpatient: number; active_outpatient: number; discharged: number };
  patients: { total: number }; employees: { total: number };
  departments: { total: number }; wards: { total: number };
  appointments_on_date: number;
}
export interface FloorSummary { building: string; level: number; label: string; ward_count: number; bed_total: number; occupied: number; occupancy_pct: number }
export interface FloorPatient { first_name: string; last_name: string; patient_number: string }
export interface FloorBed { id: string; status: BedStatus; room: string; patient?: FloorPatient }
export interface FloorRoom { id: string; name: string; room_type: string; bed_capacity: number; current_capacity: number; beds: FloorBed[] }
export interface FloorWard { id: string; name: string; station_type: string; department: string; rooms: FloorRoom[] }
export interface FloorDetail { building: string; level: number; label: string; wards: FloorWard[] }
```
- [ ] Hooks (5s poll via shared client):
```ts
export const useOpsSummary = (date: string) =>
  useQuery({ queryKey: ["ops-summary", date], queryFn: () => getData<OpsSummary>(`/v1/ops/summary?date=${date}`) });
export const useFloors = () =>
  useQuery({ queryKey: ["floors"], queryFn: () => getData<FloorSummary[]>("/v1/ops/floors") });
export const useFloorDetail = (building: string, level: number) =>
  useQuery({ queryKey: ["floor-detail", building, level], enabled: !!building,
    queryFn: () => getData<FloorDetail>(`/v1/ops/floors/detail?building=${encodeURIComponent(building)}&level=${level}`) });
```
- [ ] Typecheck clean. Commit `feat(frontend): ops-summary/floors/floor-detail types + hooks`.

---

## Task 2: Floor-layout engine (pure, TDD)

**Files:** Create `frontend/src/lib/floor-layout.ts`, `frontend/src/lib/floor-layout.test.ts`
**Produces:** `computeFloorPlan(floor: FloorDetail, opts?): FloorPlanGeometry` — deterministic; fills a fixed viewBox.

- [ ] Geometry model + algorithm (double-loaded corridors). In a fixed `VIEW_W×VIEW_H` viewBox that the SVG scales to fill the container:
  - A **central spine corridor** runs horizontally across the middle.
  - Each ward gets a **branch corridor** perpendicular to the spine; the ward's **patient rooms line both sides** (double-loaded) as standardized modules with small deterministic jitter (±~8% via an index-seeded hash, NOT Math.random). SECRETARIAT rooms render at the ward head (near the spine) with a hatch and no bed dots. A nurse-station block + service cores (Treppe/Aufzug/WC) sit at spine ends/junctions.
  - Beds are placed as status dots inside patient rooms.
  - Output:
    ```ts
    interface FloorPlanGeometry {
      viewBox: { x:0; y:0; width:number; height:number };
      walls: Rect[]; corridors: Rect[]; serviceCores: { rect: Rect; label: string }[];
      wards: { name: string; department: string; labelPos: {x:number;y:number} }[];
      rooms: { id:string; name:string; roomType:string; rect: Rect; isSecretariat:boolean; occupied:number; capacity:number }[];
      beds: { id:string; status: BedStatus; x:number; y:number; room:string; ward:string; department:string; patient?: FloorPatient }[];
    }
    ```
- [ ] Tests (deterministic; two runs deep-equal): each room in the input appears once; secretariat rooms have no beds in geometry; total bed dots === sum of input beds; all geometry within viewBox bounds; ≥1 corridor per ward; wards don't overlap.
- [ ] Commit `feat(frontend): pure double-loaded floor-plan layout engine (TDD)`.

---

## Task 3: Floor-plan renderer + Building/Floor nav  *(controller iterates visually)*

**Files:** Rewrite `frontend/src/components/floor-plan/hospital-floor-plan.tsx`; update `frontend/src/components/three/bed-inspector.tsx` if its prop type changed to `FloorBed`.
**Produces:** `<HospitalFloorPlan floors selectedFloor floorDetail selectedBedId onSelectFloor onSelectBed />` — SVG fills the card (responsive viewBox + `preserveAspectRatio="xMidYMid meet"`), renders `computeFloorPlan(floorDetail)`; Building + Floor selectors from `floors`; bed legend + per-floor occupancy chip; click/hover bed → inspector (room, ward, department, status, patient). Loading/empty/error states.
- [ ] Implement, typecheck, build. Controller then runs headless-Chrome screenshots per building/floor and iterates spacing/labels/jitter until it reads as a real, container-filling floor plan.
- [ ] Commit `feat(frontend): architectural floor-plan renderer + building/floor nav`.

---

## Task 4: Overview wiring (de-fetchAll)

**Files:** Rewrite `frontend/src/routes/overview.tsx`
- [ ] KPI rail ← `useOpsSummary(DEMO_TODAY)`. `useFloors()` → default building/floor (first entry) as state; `useFloorDetail(building, level)` feeds the plan. Remove `useBeds/useStations/useRooms/usePatientVisits` + `buildHospitalModel`/`computeLayout` (no whole-hospital model in the browser). Alerts card unchanged. `<HospitalFloorPlan>` primary; keep the 3D card only if Task 6 adapts it, else drop it.
- [ ] Typecheck + build; controller live-verifies KPIs + nav. Commit `feat(frontend): overview on aggregate + floor-scoped endpoints`.

---

## Task 5: De-`fetchAll` Logistics / Patients / Employees

**Files:** `frontend/src/routes/{logistics,patients,employees}.tsx` (+ small paginated-table helper)
- [ ] KPI numbers from `useOpsSummary`. Tables fetch page 1 + a "next" cursor (server pagination) instead of `fetchAll`. Patients: a page at a time (64k rows — never all). Employees/Logistics likewise. Keep it simple (no search UI). Typecheck + build + live check. Commit `feat(frontend): server-paginated tables + aggregate KPIs (de-fetchAll)`.

---

## Task 6 (optional): 3D scene against FloorDetail, or remove

**Files:** `frontend/src/components/three/*`, `frontend/src/lib/hospital-model.ts`
- [ ] Decide after Task 3 looks good: either adapt `HospitalScene` to extrude the single `FloorDetail` (reusing Task 2 geometry), or remove the 3D card + dead `hospital-model.ts` whole-hospital layout to avoid confusion. Commit accordingly.

---

## Self-Review
- Spec coverage: hooks/types (T1), corridor floor-plan engine (T2), container-filling renderer + nav (T3), de-fetchAll Overview (T4) + other pages (T5), 3D decision (T6). ✓
- No `fetchAll` on Overview after T4; contracts used verbatim from the locked spec.
- Renderer visual quality is controller-verified via screenshots (can't be unit-tested).
