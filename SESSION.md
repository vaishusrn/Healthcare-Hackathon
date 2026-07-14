# Session Handover

Date: 2026-07-10  
Repo: `/Users/yz/dev/github.com/yzaimoglu/hackathon-healthcare`  
Branch: `main`

## Current State

This repository contains a TypeScript healthcare API for a single hospital named `Uniklikum X`. It uses Bun, Elysia, SQLite, and Drizzle ORM.

The latest committed and pushed commit is:

```text
aa43174 Add healthcare appointment API and Docker deployment
```

There is new local work on top of that commit. It has been implemented and verified, but it has not been committed yet.

Current modified files:

```text
README.md
openapi.yaml
protocol/healthcare/v1/healthcare.proto
src/api/serializers.ts
src/api/validation.ts
src/app.ts
src/db/migrate.ts
src/db/schema.ts
src/db/seed.ts
src/repositories/healthcare.ts
src/reset-db.ts
src/seed.ts
test/api.test.ts
test/migrate.test.ts
test/seed.test.ts
SESSION.md
frontend/README.md
frontend/src/mocks/handlers.ts
```

## User Requirements Implemented

The user requested the hospital model to use `department` instead of `clinic`. Public API naming, database naming, OpenAPI, protobuf, tests, serializers, validation, seed data, and README have been updated accordingly.

The user also requested this hierarchy:

```text
Department -> Stations -> Rooms -> Beds
```

Implemented model rules:

- Departments represent hospital departments such as `Kardiologie`, `Radiologie`, and `Zentrale Notaufnahme`.
- Stations belong directly to a department.
- Rooms belong directly to both a department and station.
- Beds belong directly to a department and station.
- Beds may optionally be assigned to a room.
- Room `bed_capacity` is calculated from all beds assigned to the room.
- Room `current_capacity` is calculated from assigned beds with status `OCCUPIED`.
- No validation was added for `current_capacity > max_capacity` on departments, per user request.
- Patient visits were added to model active and discharged visits with `INPATIENT` or `OUTPATIENT` visit type.
- `INPATIENT` visits intentionally carry only `department_id`; `station_id`, `room_id`, and `bed_id` must be omitted or null.
- Each patient visit has a 7 digit `patient_number`; it is unique among active visits only and may be reused after discharge.
- Legacy SQLite databases with `clinics` and `clinic_id` are migrated into `departments` and `department_id` compatibility columns.

## API Guidelines

The API was kept aligned with `/Users/yz/dev/github.com/fertigai/skills/skills/api-event-guidelines` as used earlier in the session:

- `/v1` endpoint namespace
- snake_case JSON fields
- top-level `data` envelope for successful single-resource responses
- `pagination` envelope for list responses
- RFC 9457 style Problem Details for errors
- stable resource-oriented URIs
- cursor pagination on list endpoints
- Europe/Berlin-only appointment date and time behavior

## New And Renamed Endpoints

Seed endpoint:

```text
POST /v1/database-seeds
```

Department endpoints:

```text
POST /v1/departments
GET  /v1/departments
GET  /v1/departments/:department_id
```

Station endpoints:

```text
POST /v1/stations
GET  /v1/stations
GET  /v1/stations/:station_id
```

Room endpoints:

```text
POST /v1/rooms
GET  /v1/rooms
GET  /v1/rooms/:room_id
```

Bed endpoints:

```text
POST /v1/beds
GET  /v1/beds
GET  /v1/beds/:bed_id
```

Patient visit endpoints:

```text
POST /v1/patient-visits
GET  /v1/patient-visits
GET  /v1/patient-visits/:patient_visit_id
```

Financial dashboard endpoints:

```text
GET  /v1/financial/summary
GET  /v1/financial/revenue-trend?days=30
GET  /v1/financial/by-department
GET  /v1/financial/invoices
```

Operations dashboard endpoints:

```text
GET  /v1/ops/alerts
GET  /v1/ops/staffing
```

Existing appointment, appointment type, employee, patient, and social security number endpoints remain in place, but now use department terminology where relevant.

## Important Response Shapes

Employees now return only the department name as `department`:

```json
{
  "data": {
    "id": "emp_Berlin000001",
    "first_name": "Anna",
    "last_name": "Weber",
    "position": "Oberarzt",
    "department": "Kardiologie"
  }
}
```

Appointment types now return only the department name as `department`:

```json
{
  "data": {
    "id": "aty_Berlin000001",
    "name": "Kardiologische Kontrolle",
    "department": "Kardiologie",
    "default_duration_minutes": 30
  }
}
```

Rooms include calculated capacities:

```json
{
  "data": {
    "id": "roo_Berlin000001",
    "name": "K-101",
    "room_type": "SINGLE_ROOM_STANDARD",
    "department": "Kardiologie",
    "station": "Kardiologie Intensiv",
    "bed_capacity": 2,
    "current_capacity": 1
  }
}
```

Beds include optional `room`:

```json
{
  "data": {
    "id": "bed_Berlin000001",
    "bed_type": "INTENSIVE_CARE",
    "status": "OCCUPIED",
    "material": "STANDARD",
    "department": "Kardiologie",
    "station": "Kardiologie Intensiv",
    "room": "K-101"
  }
}
```

Patient visits include the visit number, type/status, patient reference, department, optional station/room/bed, and Berlin-local start/end date and time:

```json
{
  "data": {
    "id": "pvi_Berlin000001",
    "patient_number": "7000001",
    "visit_type": "INPATIENT",
    "status": "ACTIVE",
    "patient": {
      "id": "pat_Berlin000001",
      "first_name": "Lena",
      "last_name": "Schneider",
      "birth_date": "1988-04-12"
    },
    "department": "Kardiologie",
    "station": null,
    "room": null,
    "bed": null,
    "started_date": "2026-07-01",
    "started_time": "07:15",
    "ended_date": null,
    "ended_time": null
  }
}
```

## Enums

Station types:

```text
INTENSIVE
NORMAL
```

Room types:

```text
GROUP_ROOM
SINGLE_ROOM_STANDARD
SINGLE_ROOM_INFECTIOUS
SINGLE_ROOM_AIRLOCK
```

Bed types:

```text
INTENSIVE_CARE
STANDARD
```

Bed statuses:

```text
FREE
RESERVED
OCCUPIED
```

Bed materials:

```text
BARIATRIC
ELEVATING_LEG_REST
PRESSURE_ULCER
STANDARD
```

Patient visit types:

```text
INPATIENT
OUTPATIENT
```

Patient visit statuses:

```text
ACTIVE
DISCHARGED
```

Financial invoice statuses:

```text
PAID
OPEN
OVERDUE
```

Operational alert severities:

```text
INFO
WARNING
CRITICAL
```

## Seed Data

The seed data is German and logically represents `Uniklikum X`.

Seed endpoint:

```bash
curl -X POST http://localhost:3000/v1/database-seeds
```

Seed behavior:

- Clears app tables.
- Resets deterministic seeded IDs.
- Reseeds German mock data.

Expected summary:

```json
{
  "data": {
    "hospital_name": "Uniklikum X",
    "reset": true,
    "summary": {
      "social_security_numbers": 24,
      "patients": 24,
      "departments": 12,
      "stations": 24,
      "rooms": 48,
      "beds": 96,
      "patient_visits": 30,
      "employees": 24,
      "appointment_types": 24,
      "appointments": 32
    }
  }
}
```

CLI seed commands:

```bash
bun run db:seed
bun run db:reset
```

## Validation Rules Added

Station creation:

- `department_id` must reference an existing department.

Room creation:

- `department_id` must reference an existing department.
- `station_id` must reference an existing station.
- The station must belong to the provided department.
- Invalid parent combination returns 422 Problem Details.

Bed creation:

- `department_id` must reference an existing department.
- `station_id` must reference an existing station.
- The station must belong to the provided department.
- `room_id` is optional and nullable.
- If `room_id` is provided, the room must exist.
- If `room_id` is provided, the room must belong to the provided department and station.
- Invalid parent combination returns 422 Problem Details.

Patient visit creation:

- `patient_number` must be a 7 digit string.
- `status` is `ACTIVE` or `DISCHARGED`.
- `visit_type` is `INPATIENT` or `OUTPATIENT`.
- `INPATIENT` visits must not include `station_id`, `room_id`, or `bed_id`.
- `room_id` requires `station_id`.
- `bed_id` requires `station_id` and `room_id`.
- `ACTIVE` visits must not include `ended_date` or `ended_time`.
- `DISCHARGED` visits must include `ended_date` and `ended_time`.
- These invariants are enforced both at the API validation layer and by SQLite `CHECK` constraints.

## Verification Already Run

The following verification commands were run successfully after the latest implementation:

```bash
bun test
bun run typecheck
git diff --check
```

Observed result:

```text
80 pass, 0 fail
431 expect calls
8 test files
typecheck clean
frontend typecheck clean
frontend build clean, with Vite large chunk warning
diff whitespace check clean
```

A final scan for stale public `clinic` terminology was also run:

```bash
rg -n "clinic|Clinic|clinics|department department" src test openapi.yaml protocol README.md || true
```

It returned no matches.

## Files Worth Reviewing First

Core model and persistence:

- `src/db/schema.ts`
- `src/db/migrate.ts`
- `src/repositories/healthcare.ts`
- `src/db/seed.ts`

HTTP layer:

- `src/app.ts`
- `src/api/validation.ts`
- `src/api/serializers.ts`

Contracts and docs:

- `openapi.yaml`
- `protocol/healthcare/v1/healthcare.proto`
- `README.md`
- `SESSION.md`

Tests:

- `test/api.test.ts`
- `test/migrate.test.ts`
- `test/seed.test.ts`

## Notes For Next Session

Before committing or pushing the current local changes, rerun:

```bash
bun run typecheck
bun test
git diff --check
```

The `run-tests-before-commit` skill should be used before any commit or push.

Potential next actions:

- Commit the uncommitted department/station/room/bed, patient visit, seed endpoint, financial/ops dashboard, frontend MSW bypass, and migration compatibility changes.
- Push the commit to `origin/main` if the user still wants direct main updates.
- Optionally run the API locally with `bun run dev` and hit `POST /v1/database-seeds` for a manual smoke test.
