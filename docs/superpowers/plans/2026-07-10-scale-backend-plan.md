# Realistic Uniklinikum Backend — Implementation Plan (Wave 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Scale the backend to a realistic large German Universitätsklinikum (≈34 departments, 1,000 employees, 64,324 patients, 13,241 active visits, ~11,000 beds across ~10 buildings/~7 floors), add building/floor + secretariat modeling, flip the model so inpatients occupy beds, and expose aggregate + floor-scoped endpoints — so the frontend never fetches raw rows at scale.

**Architecture:** Deterministic, batched seed (chunked transactional inserts, internal id = insertion index+1 after sequence reset). New `/v1/ops/summary`, `/v1/ops/floors`, `/v1/ops/floors/detail` endpoints computed with SQL aggregates. Design spec: `docs/superpowers/specs/2026-07-10-floorplan-rewrite-and-scale-design.md`.

**Tech Stack:** Bun, Elysia, SQLite (bun:sqlite), Drizzle ORM. Tests: `bun test`.

## Global Constraints

- **Determinism:** the seed MUST NOT use `Math.random()`/`Date.now()`/argless `new Date()`. Use a seeded PRNG (`mulberry32`) and index-derived values. `now = "2026-07-09T10:00:00.000+02:00"`.
- **Insertion:** clear all app tables + reset `sqlite_sequence`, then insert in dependency order with **chunked multi-row inserts inside ONE transaction**; NO per-row `.returning()`. Internal ids are therefore `arrayIndex + 1` per table — build `publicId → internalId` maps from that, no id queries.
- **SQLite variable cap:** chunk size = `Math.floor(30000 / columnCount)` rows per INSERT.
- **API conventions:** `/v1` prefix, snake_case JSON, top-level `data` envelope, `pagination` for lists, RFC 9457 Problem Details, `422` on unknown query params, Europe/Berlin timestamps. Do NOT break the already-added `department_id` filter on `/v1/appointment-types` or the existing `/v1/financial/*` + `/v1/ops/{alerts,staffing}` endpoints.
- **Reseed contract:** `db:reset` deletes+recreates the sqlite file, so new columns/CHECKs apply cleanly. Reseed target < 10s.
- **Public id scheme:** deterministic, e.g. `pat_Berlin000001…064324`, `dep_Berlin0001…0034`, `sta_…`, `roo_…`, `bed_…`, `emp_…`, `ssn_…`, `pvi_…`, `aty_…`, `app_…` (12-char suffix, zero-padded).
- **Scale targets** (tunable constants, assert with tolerance in tests where noted): departments 34, buildings 10, wards ~360, rooms ~7,200, beds ~11,000 (occupied ~9,270 = active inpatients, reserved ~600, rest free), employees 1,000, patients 64,324, active visits 13,241 (~9,270 INPATIENT with a bed + ~3,971 OUTPATIENT without), appointment types ~100, appointments ~5,000.

---

## Task 1: Schema, migration, serializer — building/floor, SECRETARIAT, inpatient-bed flip

**Files:**
- Modify: `src/db/schema.ts`, `src/db/migrate.ts`, `src/api/serializers.ts`, `openapi.yaml`, `protocol/healthcare/v1/healthcare.proto`
- Test: `test/migrate.test.ts` (exists), `test/api.test.ts`

**Interfaces produced:**
- `stations` table + `StationRow` gain `building: string`, `floor: number`.
- `roomTypes` includes `"SECRETARIAT"`.
- `StationResource` gains `building: string; floor: number`; `serializeStation(row, department)` emits them.
- patient_visits CHECK: INPATIENT ⇒ station+room+bed all set; OUTPATIENT ⇒ all null.

- [ ] **Step 1: schema.ts** — in `stationTypes`/`roomTypes` region add SECRETARIAT; in `stations` table add columns.

```ts
export const roomTypes = [
  "GROUP_ROOM",
  "SINGLE_ROOM_STANDARD",
  "SINGLE_ROOM_INFECTIOUS",
  "SINGLE_ROOM_AIRLOCK",
  "SECRETARIAT",
] as const;
```
In `export const stations = sqliteTable("stations", { … })` add after `stationType`:
```ts
    building: text("building").notNull(),
    floor: integer("floor").notNull(),
```

- [ ] **Step 2: migrate.ts** — update the `stations` CREATE TABLE to include the columns (with defaults so an ALTER path is safe), update the `rooms` room_type CHECK to include `'SECRETARIAT'`, flip the `patient_visits` CHECK, and add an idempotent ALTER for existing DBs.

In `CREATE TABLE IF NOT EXISTS stations (…)` add:
```sql
      building TEXT NOT NULL DEFAULT 'Haus 1',
      floor INTEGER NOT NULL DEFAULT 0,
```
In `rooms` CHECK change the IN list to include `'SECRETARIAT'`.
In `patient_visits`, replace the visit_type location CHECK block with:
```sql
      CHECK (
        (visit_type = 'INPATIENT' AND station_id IS NOT NULL AND room_id IS NOT NULL AND bed_id IS NOT NULL)
        OR
        (visit_type = 'OUTPATIENT' AND station_id IS NULL AND room_id IS NULL AND bed_id IS NULL)
      ),
```
(Keep the `patient_number` GLOB check and the status/ended-date check.) After the `CREATE TABLE` statements, add an idempotent guard for pre-existing DBs (mirrors `columnExists` usage already in the file):
```ts
  if (tableExists(db, "stations")) {
    if (!columnExists(db, "stations", "building")) {
      db.run(sql.raw(`ALTER TABLE stations ADD COLUMN building TEXT NOT NULL DEFAULT 'Haus 1'`));
    }
    if (!columnExists(db, "stations", "floor")) {
      db.run(sql.raw(`ALTER TABLE stations ADD COLUMN floor INTEGER NOT NULL DEFAULT 0`));
    }
  }
```

- [ ] **Step 3: serializers.ts** — `StationResource` + `serializeStation`.

```ts
export type StationResource = {
  id: string; name: string; station_type: string; department: string;
  building: string; floor: number;
  created_at: string; updated_at: string;
};
```
```ts
export function serializeStation(row: StationRow, department: DepartmentRow): StationResource {
  return {
    id: row.publicId, name: row.name, station_type: row.stationType,
    department: department.name, building: row.building, floor: row.floor,
    created_at: row.createdAt, updated_at: row.updatedAt,
  };
}
```

- [ ] **Step 4: openapi.yaml + proto** — add `building` (string) and `floor` (integer) to the `Station` schema `required` + `properties`; add `SECRETARIAT` to the `RoomType` enum. Mirror in `protocol/healthcare/v1/healthcare.proto` (`Station` message: `string building`, `int32 floor` with next field numbers; `RoomType` enum add `ROOM_TYPE_SECRETARIAT`).

- [ ] **Step 5: Write failing test** — `test/api.test.ts`, an inpatient visit now REQUIRES a bed and an outpatient REJECTS one. Add a station-shape test for building/floor. (createStation helper must pass building/floor — see Step 6.)

```ts
test("station response includes building and floor", async () => {
  const department = await createDepartment();
  const station = await createStation(department.id); // helper updated in Step 6
  const res = await request(`/v1/stations/${station.id}`);
  const body = (await res.json()) as { data: { building: string; floor: number } };
  expect(res.status).toBe(200);
  expect(typeof body.data.building).toBe("string");
  expect(typeof body.data.floor).toBe("number");
});
```

- [ ] **Step 6: Fix the createStation validation + input path** — `station_type`/name unchanged, but station creation must accept `building` + `floor`. Update `src/api/validation.ts` `validateStationInput` to parse `building: requiredString(...)`, `floor: requiredInteger(...)`, add them to `stationFields`; update `src/app.ts` POST `/v1/stations` to pass them to `repository.createStation`; update `repository.createStation` to persist them; update the `createStation` test helper to send `building: "Haus 1", floor: 0`. Update `openapi.yaml` `CreateStationRequest` accordingly.

- [ ] **Step 7: Run tests**

Run: `bun test test/api.test.ts test/migrate.test.ts`
Expected: PASS (existing station/patient-visit tests updated to the new shape/rule).

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts src/db/migrate.ts src/api/serializers.ts src/api/validation.ts src/app.ts src/repositories/healthcare.ts openapi.yaml protocol/healthcare/v1/healthcare.proto test/api.test.ts test/migrate.test.ts
git commit -m "feat(api): station building/floor, SECRETARIAT room type, inpatient-occupies-bed model"
```

---

## Task 2: Deterministic structural seed generators (departments → buildings/floors → wards → rooms → beds)

**Files:**
- Create: `src/db/seed-data.ts` (pure generators + pools), `src/db/prng.ts` (`mulberry32`)
- Test: `test/seed-data.test.ts`

**Interfaces produced (types mirror the existing `*Seed` shapes in `seed.ts`, plus `building`/`floor` on stations and `SECRETARIAT` rooms with 0 beds):**
- `mulberry32(seed: number): () => number`
- `SEED_DEPARTMENTS: { name: string; kuerzel: string }[]` (≈34 real German Uniklinik departments)
- `BUILDINGS: string[]` (≈10 themed Haus names)
- `generateStructure(): { departments: DepartmentSeed[]; stations: StationSeed[]; rooms: RoomSeed[]; beds: BedSeed[] }`
  where `StationSeed` adds `building: string; floor: number`, and rooms include SECRETARIAT rooms (0 beds).

- [ ] **Step 1: PRNG** — `src/db/prng.ts`

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 2: Data pools + structure generator** — `src/db/seed-data.ts`. Full, curated department list (≈34) and buildings (≈10). Then generate wards/rooms/beds deterministically to hit the scale targets.

Algorithm (deterministic; `rnd = mulberry32(1)`):
- `SEED_DEPARTMENTS`: 34 objects `{ name, kuerzel }` — the list in the design spec (Kardiologie/KAR, Herzchirurgie/HCH, Neurologie/NEU, Neurochirurgie/NCH, Hämatologie und Onkologie/HÄM, … Anästhesiologie und Intensivmedizin/ANI, Zentrale Notaufnahme/ZNA, Geriatrie/GER, Palliativmedizin/PAL). Enumerate all 34 explicitly.
- `BUILDINGS`: 10 names (`"Haus 1 – Bettenhaus"`, `"Haus 2 – Herzzentrum"`, `"Haus 3 – Frauen- und Kinderklinik"`, `"Haus 4 – Kopfklinik"`, `"Haus 5 – Chirurgie"`, `"Haus 6 – Onkologisches Zentrum"`, `"Haus 7 – Neurozentrum"`, `"Haus 8 – Innere Medizin"`, `"Haus 9 – Notfallzentrum"`, `"Haus 10 – Institute"`).
- Departments: map each `SEED_DEPARTMENTS[i]` → `DepartmentSeed { publicId: dep_Berlin{i+1 padded4→12}, name, currentCapacity, maxCapacity }` where max ≈ its ward bed total and current ≈ occupied (fill after beds are known, or set from a per-dept target).
- Wards: aim ~360 total. For each department assign `wardCount = 8 + Math.floor(rnd()*8)` (8–15), summing ≈ 360. Distribute wards across buildings/floors: iterate a `(building, floor)` cursor round-robin (10 buildings × 7 floors = 70 slots; ~5 wards/slot). Each ward: `StationSeed { publicId: sta_…, name: "Station "+kuerzel+" "+letter+level, stationType: (wardIndexInDept < ceil(count*0.25) ? "INTENSIVE" : "NORMAL"), departmentPublicId, building, floor }`.
- Rooms per ward: `patientRooms = 14 + Math.floor(rnd()*10)` (14–23) + `1–2` SECRETARIAT rooms + 1 `Stationszimmer` (also SECRETARIAT type, 0 beds). Room name `H{floor}-{level}.{nn}`. SECRETARIAT rooms named `Sekretariat {kuerzel}` / `Stationszimmer`.
- Beds per patient room: mostly 1–2 (`rnd()<0.15 ? (3 or 4 group) : (rnd()<0.5?1:2)`). INTENSIVE wards → bedType INTENSIVE_CARE else STANDARD. SECRETARIAT rooms → 0 beds. Sum beds ≈ 11,000 (tune the ward/room counts to land near target; test asserts within ±10%).
- Bed status: assign so ≈84% OCCUPIED, ≈5% RESERVED, rest FREE, via `rnd()` thresholds — BUT the exact OCCUPIED set is finalized in Task 3 to equal the active-inpatient count (Task 3 owns bed→visit pairing). Here, mark provisional status; Task 3 may recolor to reconcile. (Document this handoff.)

Return arrays. Keep it pure (no DB).

- [ ] **Step 3: Tests** — `test/seed-data.test.ts`: determinism (two `generateStructure()` deep-equal), counts within tolerance (departments === 34; 300 ≤ stations ≤ 420; 6000 ≤ rooms ≤ 8500; 9500 ≤ beds ≤ 12500), every ward has building+floor, ≥1 SECRETARIAT room per ward and all SECRETARIAT rooms have 0 beds, INTENSIVE wards only produce INTENSIVE_CARE beds.

- [ ] **Step 4: Run + commit**

```bash
bun test test/seed-data.test.ts
git add src/db/prng.ts src/db/seed-data.ts test/seed-data.test.ts
git commit -m "feat(seed): deterministic structural generators (buildings/floors/wards/rooms/beds)"
```

---

## Task 3: Deterministic people generators (SSNs, patients, employees, visits, appointment types, appointments)

**Files:**
- Modify: `src/db/seed-data.ts`
- Test: `test/seed-data.test.ts`

**Interfaces produced:**
- `generatePeople(structure): { socialSecurityNumbers; patients; employees; patientVisits; appointmentTypes; appointments }` — deterministic, mirroring existing `*Seed` shapes; visits split INPATIENT(bed)/OUTPATIENT(no bed); OCCUPIED beds equal active INPATIENT visits.

- [ ] **Step 1: Name pools + generators.** German first-name pools (male/female ~40 each), last-name pool (~60), city pool (~30), insurance providers (statutory ~10, private ~6), employee positions (Chefarzt/-ärztin, Oberarzt/-ärztin, Facharzt/-ärztin, Assistenzarzt/-ärztin, Pflegefachkraft, Stationsleitung, Pflegeleitung, MTRA, MTLA, Physiotherapeut:in, …). Deterministic combination by index: `firstName = pool[(i*prime1) % pool.length]`, etc.
- SSNs: 64,324 — `ssn_Berlin{i}`, `number` = **dash-free** `` `DESV${100000 + i}` `` → `"DESV100001"` (the existing `DE-SV-…` scheme minus separators — **no `-` or any separator anywhere in the number**, consistent with the main hotfix). provider by `i % providers`, insuranceType STATUTORY (~78%) / PRIVATE (~22%) by threshold.
- Patients: 64,324 — one per SSN; gender cycypled with a NON_BINARY/UNKNOWN sprinkle; birth_date deterministic across ages 0–98; birthplace from city pool; `accepted_gdpr: true`.
- Employees: 1,000 — assigned round-robin to departments; position by weighted index (more Pflegefachkraft than Chefärzt:in).
- Appointment types: ~3 per department (~100), realistic names per specialty.
- Visits: 13,241 active = pair the first ~9,270 OCCUPIED beds each to a distinct ACTIVE INPATIENT visit (patient_number unique among active, 7 digits; patient by index; station/room/bed from the bed's ward/room/bed) + ~3,971 ACTIVE OUTPATIENT visits (department only, null bed). Plus ~6,000 DISCHARGED visits (history; may reuse beds since unique constraint is active-only). **Reconcile bed status:** set exactly the beds referenced by active inpatients to OCCUPIED; leave the rest FREE/RESERVED per Task 2 thresholds. Provide the final `beds` array (with reconciled status) back so Task 4 inserts the reconciled version.
- Appointments: ~5,000 across dates 2026-07-06…2026-07-20; patient+appointment_type by index; unique per (type,date,time).

- [ ] **Step 2: Tests** — determinism; counts (patients===64324, employees===1000, active visits===13241 with active_inpatient≈9270±50 and the rest outpatient); every INPATIENT active visit has station+room+bed and references an OCCUPIED bed; every OUTPATIENT visit has null bed; OCCUPIED bed count === active INPATIENT count; appointments unique per (type,date,time).

- [ ] **Step 3: Run + commit**

```bash
bun test test/seed-data.test.ts
git add src/db/seed-data.ts test/seed-data.test.ts
git commit -m "feat(seed): deterministic people generators at scale (patients/employees/visits/appointments)"
```

---

## Task 4: Batched insertion + `resetAndSeedDatabase` rewrite (performance)

**Files:**
- Modify: `src/db/seed.ts`
- Test: `test/seed.test.ts`

**Interfaces produced:** `resetAndSeedDatabase(db)`/`seedDatabase(db)` use `generateStructure()`+`generatePeople()` and chunked transactional inserts; returns the `SeedSummary` with the new totals.

- [ ] **Step 1: Batched insert helper.** In `seed.ts`, add a generic chunked inserter that avoids per-row returning:

```ts
function insertAll<T extends Record<string, unknown>>(
  db: AppDatabase, table: SQLiteTable, rows: T[],
): void {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]).length;
  const chunkSize = Math.max(1, Math.floor(30000 / cols));
  for (let i = 0; i < rows.length; i += chunkSize) {
    db.insert(table).values(rows.slice(i, i + chunkSize) as never).run();
  }
}
```

- [ ] **Step 2: Rewrite `seedDatabase`.** **FULLY REPLACE** the legacy
  hard-coded arrays + `upsert*` helpers in `src/db/seed.ts` (the 12-dept
  `departmentSeeds`/`stationSeeds`/`roomSeeds`/`bedSeeds`/`patientSeeds`/
  `patientVisitSeeds`/etc.) — do NOT run both the old and new seed paths. Their
  `dep_/sta_/roo_/bed_Berlin…` publicIds collide 100% with `generateStructure()`,
  so keeping both would silently merge/overwrite rows. Use ONLY
  `generateStructure()` + `generatePeople()`. Then: clear tables + reset
  sequences (existing `clearDatabase`), for each table build rows with
  `createdAt/updatedAt = now`, resolving FK internal ids as
  `publicIdIndexMap.get(publicId)` where the map is `new Map(rows.map((r, i) => [r.publicId, i + 1]))` (ids are sequential because tables were just cleared + sequence reset). Insert in dependency order (SSNs, departments, stations, rooms, patients, employees, beds, patient_visits, appointment_types, appointments) via `insertAll`, wrapped in `db.transaction(() => { … })`. Return `SeedSummary` with actual lengths.

- [ ] **Step 3: Update `test/seed.test.ts`** to the new scale (assert counts with tolerance; assert reseed populates all tables; assert OCCUPIED bed count equals active inpatient count). Keep it fast (in-memory DB; the generators are deterministic so this is a real end-to-end seed).

- [ ] **Step 4: Verify perf + counts live**

```bash
bun run db:reset
```
Expected: prints the new counts (patients 64324, employees 1000, beds ≈11000, patient_visits 13241, …) and completes in well under 10s.

- [ ] **Step 5: Commit**

```bash
git add src/db/seed.ts test/seed.test.ts
git commit -m "feat(seed): batched transactional insertion + scaled resetAndSeed"
```

---

## Task 5: `GET /v1/ops/summary` (+ fix scale-broken aggregation endpoints)

**Files:**
- Modify: `src/repositories/healthcare.ts`, `src/app.ts`, `src/api/serializers.ts`, `openapi.yaml`, `protocol/healthcare/v1/healthcare.proto`
- Test: `test/api.test.ts`

**Scale-correctness fix (do this alongside `/ops/summary`):** the existing
`/v1/ops/staffing` and `/v1/financial/*` handlers in `src/app.ts` compute from
`repository.listEmployees(undefined, 100)` / `listPatients(undefined, 100)` —
**capped at 100 rows**. At 1,000 employees / 64,324 patients this undercounts
(staffing shows ~100 staff, not 1,000). Add SQL-aggregate repository methods and
switch `/ops/staffing` (per-department on-shift/on-call/total over ALL employees)
and `/financial/summary`'s `payer_mix` (STATUTORY/PRIVATE counts over ALL
patients via `GROUP BY`) to them. `financial/invoices` may stay a bounded
synthetic sample (documented), but its `payer_mix`/totals must not be capped.
Verify in Task 7 that `/ops/staffing` totals sum to 1,000.

**Interfaces produced:**
- `repository.opsSummary(dateIso?: string): { beds; capacity; visits; patients; employees; departments; wards; appointmentsOnDate }` using SQL COUNT/GROUP BY (never per-row in the app).
- Route `GET /v1/ops/summary?date=YYYY-MM-DD` → `{ data: OpsSummaryResource }`.

- [ ] **Step 1: Repository aggregates.** Add `opsSummary` using drizzle `count()`/`sql` aggregates: bed totals grouped by status; department capacity sums; visit counts grouped by status+visit_type; `count()` for patients/employees/departments/stations; appointments where `scheduledDate === date` (if provided). Return plain numbers.

- [ ] **Step 2: Route + serializer + openapi/proto.** Add `serializeOpsSummary` producing snake_case:
```ts
{ beds:{total,free,reserved,occupied,occupancy_pct},
  capacity:{current,max,pct},
  visits:{active,active_inpatient,active_outpatient,discharged},
  patients:{total}, employees:{total}, departments:{total}, wards:{total},
  appointments_on_date }
```
Route validates query params `["date"]` (422 on others); `date` optional Berlin-local date. Add `OpsSummary`/`OpsSummaryResponse` to openapi + proto.

- [ ] **Step 3: Test** — on a fresh in-memory seed, `/v1/ops/summary?date=2026-07-10` returns 200 and its counts reconcile with direct table counts (occupied === active_inpatient; patients.total === 64324 is too heavy for in-memory test — instead seed is deterministic so assert the summary equals independently computed counts from `generatePeople`, or use a small override). Keep the test fast: assert internal consistency (occupied===active_inpatient, active===active_inpatient+active_outpatient, occupancy_pct math).

- [ ] **Step 4: Commit**

```bash
git add src/repositories/healthcare.ts src/app.ts src/api/serializers.ts openapi.yaml protocol/healthcare/v1/healthcare.proto test/api.test.ts
git commit -m "feat(api): GET /v1/ops/summary aggregate KPIs"
```

---

## Task 6: `GET /v1/ops/floors` + `GET /v1/ops/floors/detail`

**Files:**
- Modify: `src/repositories/healthcare.ts`, `src/app.ts`, `src/api/serializers.ts`, `openapi.yaml`, `protocol/healthcare/v1/healthcare.proto`
- Test: `test/api.test.ts`

**Interfaces produced:**
- `repository.listFloors(): { building; level; ward_count; bed_total; occupied; occupancy_pct }[]` (grouped by building+floor).
- `repository.floorDetail(building, level): { wards: { id,name,station_type,department, rooms: { id,name,room_type,bed_capacity,current_capacity, beds: { id,status,room, patient? } [] } [] } [] } | null`.
- Routes `GET /v1/ops/floors` and `GET /v1/ops/floors/detail?building=<>&level=<>` (422 unknown params; 404 if the floor has no wards).

- [ ] **Step 1: Repository queries.** `listFloors`: `GROUP BY stations.building, stations.floor` with bed rollups via joins to beds. `floorDetail`: fetch wards on (building,level), their rooms, their beds (+ join active INPATIENT visit → patient name for occupied beds). Bounded (~150 beds).

- [ ] **Step 2: Routes + serializers + openapi/proto.** snake_case serializers; `/floors` returns `{ data: FloorSummary[] }`; `/floors/detail` returns `{ data: FloorDetail }` or 404. Validate query params. Add schemas to openapi + proto.

- [ ] **Step 3: Test** — seed a small in-memory hospital (few wards on one floor), assert `/floors` groups correctly and `/floors/detail?building=..&level=..` returns wards→rooms→beds with SECRETARIAT rooms (0 beds) present and occupied beds carrying a patient summary; unknown building/level → 404.

- [ ] **Step 4: Commit**

```bash
git add src/repositories/healthcare.ts src/app.ts src/api/serializers.ts openapi.yaml protocol/healthcare/v1/healthcare.proto test/api.test.ts
git commit -m "feat(api): GET /v1/ops/floors + /v1/ops/floors/detail"
```

---

## Task 7: Reconcile existing tests + full verification

**Files:**
- Modify: `test/api.test.ts`, `test/seed.test.ts`, `README.md`

- [ ] **Step 1:** Update any remaining patient-visit tests that assumed the old (INPATIENT-without-bed) rule to the new rule (INPATIENT requires bed, OUTPATIENT rejects). Update README endpoint list with the 3 new `/v1/ops/*` endpoints, station `building`/`floor`, `SECRETARIAT` room type, and the flipped visit/bed rule.

- [ ] **Step 2: Full suite**

Run: `bun test && bun run typecheck`
Expected: all pass, no type errors.

- [ ] **Step 3: Live verification**

```bash
bun run db:reset            # < 10s, prints scaled counts
bun run start &             # then:
curl -s "http://localhost:3000/v1/ops/summary?date=2026-07-10" | jq .data
curl -s "http://localhost:3000/v1/ops/floors" | jq '.data | length'
curl -s "http://localhost:3000/v1/ops/floors/detail?building=Haus%201%20%E2%80%93%20Bettenhaus&level=0" | jq '.data.wards | length'
```
Expected: summary shows patients 64324 / employees 1000 / beds ≈11000 / active 13241; floors lists building/floor groups; floor detail returns bounded wards→rooms→beds.

- [ ] **Step 4: Commit**

```bash
git add test/api.test.ts test/seed.test.ts README.md
git commit -m "test+docs: reconcile visit/bed rule, document ops endpoints + scale"
```

---

## Self-Review

- **Spec coverage:** schema (building/floor, SECRETARIAT) T1; inpatient-bed flip T1; realistic scaled seed T2–T4; batched perf T4; `/ops/summary` T5; `/ops/floors(/detail)` T6; docs/tests T7. ✓ (Frontend phases 4–8 are Wave 2, a separate plan.)
- **Placeholder scan:** the seed *content* (34-dept list, name pools) is specified by exact pools + deterministic algorithm + representative code — the implementer enumerates the literal pools; no logic is left vague. Insertion, id-mapping, CHECK flip, endpoint queries, and serializers are fully coded.
- **Type consistency:** `StationRow`/`StationResource` building/floor consistent across T1/T6; `insertAll`/index-id-map used consistently in T4; `opsSummary`/`floorDetail` field names match the openapi/serializer in T5/T6.
- **Known caveat:** bed-status ↔ active-inpatient reconciliation spans T2 (provisional) → T3 (final) → T4 (inserts final). T3 owns the final `beds` status; call it out in the T3 dispatch so the reconciliation isn't dropped.
