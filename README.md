# Healthcare API

TypeScript API for a single hospital, `Uniklikum X`. The API is built with Bun, Elysia, SQLite, and Drizzle ORM.

The service uses `/v1` endpoints, JSON request/response bodies, snake_case fields, top-level `data` response envelopes, cursor pagination, and RFC 9457 Problem Details errors.

## Quick Start

```bash
bun install
bun run db:reset
bun run dev
```

The API listens on:

```text
http://localhost:3000
```

Useful commands:

| Command | Description |
| --- | --- |
| `bun run dev` | Start API in watch mode |
| `bun run start` | Start API once |
| `bun test` | Run tests |
| `bun run typecheck` | Run TypeScript checks |
| `bun run db:seed` | Add/update German mock seed data without clearing existing data |
| `bun run db:reset` | Clear all app tables, reset IDs, then reseed |

The default database file is `healthcare.sqlite`. Override it with:

```bash
DB_FILE_NAME=other.sqlite bun run db:reset
```

## Docker

Build and run:

```bash
docker build -t healthcare-api .
docker run --rm -p 3000:3000 -v healthcare-data:/data healthcare-api
```

The container listens on `PORT`, defaults to `3000`, and stores SQLite at `/data/healthcare.sqlite` by default.

To seed a running-compatible database volume:

```bash
docker run --rm -v healthcare-data:/data healthcare-api bun src/reset-db.ts
```

## Common Rules

All successful single-resource responses are wrapped:

```json
{
  "data": {
    "id": "pat_Berlin000001"
  }
}
```

All list responses are paginated:

```json
{
  "data": [],
  "pagination": {
    "self": "/v1/patients?page_size=20",
    "has_more": false
  }
}
```

List query params:

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page_size` | integer | `20` | Min `1`, max `100` |
| `cursor` | string | none | Opaque cursor from `pagination.next` |

Generated `created_at` and `updated_at` timestamps are Europe/Berlin local date-time strings with an explicit offset, for example `2026-07-09T10:00:00.000+02:00`. Appointment `scheduled_date` and `scheduled_time` are Berlin-local values. No other timezone is supported.

Errors use Problem Details:

```json
{
  "type": "https://api.fertig.ai/problems/invalid-input",
  "title": "Invalid Input",
  "status": 422,
  "detail": "scheduled_time must use HH:mm format",
  "instance": "/v1/appointments"
}
```

## TL;DR Endpoints

| Method | Endpoint | Params | Body |
| --- | --- | --- | --- |
| `GET` | `/v1/health` | none | none |
| `POST` | `/v1/database-seeds` | none | none |
| `GET` | `/v1/financial/summary` | none | none |
| `GET` | `/v1/financial/revenue-trend` | `days` | none |
| `GET` | `/v1/financial/by-department` | none | none |
| `GET` | `/v1/financial/invoices` | `cursor`, `page_size` | none |
| `GET` | `/v1/ops/alerts` | none | none |
| `GET` | `/v1/ops/staffing` | none | none |
| `GET` | `/v1/ops/summary` | `date` | none |
| `GET` | `/v1/ops/floors` | none | none |
| `GET` | `/v1/ops/floors/detail` | `building`, `level` | none |
| `POST` | `/v1/social-security-numbers` | none | `number`, `health_insurance_provider`, `insurance_type` |
| `GET` | `/v1/social-security-numbers` | `cursor`, `page_size` | none |
| `GET` | `/v1/social-security-numbers/{social_security_number_id}` | `social_security_number_id` path param | none |
| `POST` | `/v1/patients` | none | `gender`, `first_name`, `last_name`, `birth_date`, `birthplace`, `social_security_number_id`, `telephone_number`, `accepted_gdpr` |
| `GET` | `/v1/patients` | `cursor`, `page_size` | none |
| `GET` | `/v1/patients/{patient_id}` | `patient_id` path param | none |
| `POST` | `/v1/departments` | none | `name`, `current_capacity`, `max_capacity` |
| `GET` | `/v1/departments` | `cursor`, `page_size` | none |
| `GET` | `/v1/departments/{department_id}` | `department_id` path param | none |
| `POST` | `/v1/stations` | none | `name`, `station_type`, `department_id`, `building`, `floor` |
| `GET` | `/v1/stations` | `cursor`, `page_size` | none |
| `GET` | `/v1/stations/{station_id}` | `station_id` path param | none |
| `POST` | `/v1/rooms` | none | `name`, `room_type`, `department_id`, `station_id` |
| `GET` | `/v1/rooms` | `cursor`, `page_size` | none |
| `GET` | `/v1/rooms/{room_id}` | `room_id` path param | none |
| `POST` | `/v1/beds` | none | `bed_type`, `status`, `material`, `department_id`, `station_id`, `room_id` |
| `GET` | `/v1/beds` | `cursor`, `page_size` | none |
| `GET` | `/v1/beds/{bed_id}` | `bed_id` path param | none |
| `POST` | `/v1/patient-visits` | none | `patient_number`, `visit_type`, `status`, `patient_id`, `department_id`, `station_id`, `room_id`, `bed_id`, `started_date`, `started_time`, `ended_date`, `ended_time` |
| `GET` | `/v1/patient-visits` | `cursor`, `page_size` | none |
| `GET` | `/v1/patient-visits/{patient_visit_id}` | `patient_visit_id` path param | none |
| `POST` | `/v1/patient-movements/available-beds` | none | `patient_number`, `target_department_id` |
| `POST` | `/v1/patient-movements` | none | `patient_number`, `target_bed_id` |
| `POST` | `/v1/patient-movements/completions` | none | `patient_number` |
| `POST` | `/v1/employees` | none | `first_name`, `last_name`, `position`, `department_id` |
| `GET` | `/v1/employees` | `cursor`, `page_size` | none |
| `GET` | `/v1/employees/{employee_id}` | `employee_id` path param | none |
| `POST` | `/v1/appointment-types` | none | `name`, `department_id`, `default_duration_minutes` |
| `GET` | `/v1/appointment-types` | `cursor`, `page_size`, `department_id` | none |
| `GET` | `/v1/appointment-types/{appointment_type_id}` | `appointment_type_id` path param | none |
| `GET` | `/v1/appointment-types/{appointment_type_id}/slots` | `appointment_type_id`, `start`, `end`, `limit` | none |
| `POST` | `/v1/appointments/bookings` | none | `health_insurance_number`, `birth_date`, `appointment_type_id`, `scheduled_date`, `scheduled_time` |
| `POST` | `/v1/appointments/cancellations` | none | `health_insurance_number`, `birth_date`, `appointment_type_id`, `scheduled_date`, `scheduled_time` |
| `POST` | `/v1/appointments/reschedules` | none | `health_insurance_number`, `birth_date`, `appointment_type_id`, `from_scheduled_date`, `from_scheduled_time`, `to_scheduled_date`, `to_scheduled_time` |
| `POST` | `/v1/appointments/searches` | none | `health_insurance_number`, `birth_date` |
| `POST` | `/v1/appointments` | none | `scheduled_date`, `scheduled_time`, `linked_patient_id`, `appointment_type_id` |
| `GET` | `/v1/appointments` | `cursor`, `page_size` | none |
| `GET` | `/v1/appointments/{appointment_id}` | `appointment_id` path param | none |

## Resources

### Database Seeds

Reset all app tables and seed the German `Uniklikum X` mock data:

```bash
curl -X POST http://localhost:3000/v1/database-seeds
```

This returns seeded table counts and resets IDs back to the deterministic seeded IDs listed below.

### Financial Dashboard

Financial endpoints provide deterministic dashboard data derived from seeded departments and patients.

```bash
curl http://localhost:3000/v1/financial/summary
curl 'http://localhost:3000/v1/financial/revenue-trend?days=30'
curl http://localhost:3000/v1/financial/by-department
curl 'http://localhost:3000/v1/financial/invoices?page_size=20'
```

`/v1/financial/invoices` uses the same cursor pagination envelope as other list endpoints. Invoice `status` is `PAID`, `OPEN`, or `OVERDUE`.

### Operations Dashboard

Operations endpoints provide alerts, staffing, aggregate KPIs, and building/floor navigation for command-center views.

```bash
curl http://localhost:3000/v1/ops/alerts
curl http://localhost:3000/v1/ops/staffing
curl 'http://localhost:3000/v1/ops/summary?date=2026-07-10'
curl http://localhost:3000/v1/ops/floors
curl 'http://localhost:3000/v1/ops/floors/detail?building=Haus%201%20%E2%80%93%20Bettenhaus&level=0'
```

Alert `severity` is `INFO`, `WARNING`, or `CRITICAL`. Staffing rows include `department`, `on_shift`, `on_call`, and `total`.

`/v1/ops/summary` returns hospital-wide KPIs computed entirely via SQL aggregation, safe at full seeded scale: `beds` (`total`/`free`/`reserved`/`occupied`/`occupancy_pct`), `capacity` (`current`/`max`/`pct`), `visits` (`active`/`active_inpatient`/`active_outpatient`/`discharged`), `patients.total`, `employees.total`, `departments.total`, `wards.total`, and `appointments_on_date`.

| Param | Type | Notes |
| --- | --- | --- |
| `date` | string | Optional `YYYY-MM-DD`. Filters `appointments_on_date` to that date; omit to count all appointments. |

`/v1/ops/floors` lists one entry per seeded `(building, level)` pair with SQL-computed ward/bed rollups: `building`, `level`, `label`, `ward_count`, `bed_total`, `occupied`, `occupancy_pct`. `level` is 0-indexed (`0` = ground floor, `label` `"EG"`; `1` = `"1. OG"`, `2` = `"2. OG"`, and so on).

`/v1/ops/floors/detail` returns one floor's wards -> rooms -> beds, including the active `INPATIENT` occupant (if any) for each `OCCUPIED` bed:

| Param | Type | Notes |
| --- | --- | --- |
| `building` | string | Required, must exactly match a seeded station `building` |
| `level` | integer | Required, non-negative, 0-indexed |

Returns `404` when no station matches the given `building`/`level` pair.

### Social Security Numbers

Create:

```bash
curl -X POST http://localhost:3000/v1/social-security-numbers \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "DESV200001",
    "health_insurance_provider": "Techniker Krankenkasse",
    "insurance_type": "STATUTORY"
  }'
```

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `number` | string | Unique, free-form; seeded numbers use the dash-free `DESV<digits>` scheme, for example `DESV100001` |
| `health_insurance_provider` | string | German insurance provider name |
| `insurance_type` | enum | `STATUTORY` or `PRIVATE` |

### Patients

Create:

```bash
curl -X POST http://localhost:3000/v1/patients \
  -H 'Content-Type: application/json' \
  -d '{
    "gender": "FEMALE",
    "first_name": "Lena",
    "last_name": "Schneider",
    "birth_date": "1988-04-12",
    "birthplace": "Berlin",
    "social_security_number_id": "ssn_Berlin000001",
    "telephone_number": "+493012345001",
    "accepted_gdpr": true
  }'
```

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `gender` | enum | `FEMALE`, `MALE`, `NON_BINARY`, `UNKNOWN` |
| `birth_date` | string | `YYYY-MM-DD` |
| `social_security_number_id` | string | Existing `ssn_...` ID |
| `accepted_gdpr` | boolean | Required |

### Departments

In this API, `departments` are hospital departments of `Uniklikum X`, for example `Kardiologie`, `Radiologie`, or `Zentrale Notaufnahme`.

Create:

```bash
curl -X POST http://localhost:3000/v1/departments \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Kardiologie",
    "current_capacity": 37,
    "max_capacity": 40
  }'
```

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Department name |
| `current_capacity` | integer | No validation against `max_capacity` |
| `max_capacity` | integer | Capacity limit |

### Stations

Stations (wards) belong directly to a department and sit on a `building`/`floor` slot used by the floor-plan navigation endpoints (`/v1/ops/floors`, `/v1/ops/floors/detail`).

```bash
curl -X POST http://localhost:3000/v1/stations \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Kardiologie Intensiv",
    "station_type": "INTENSIVE",
    "department_id": "dep_Berlin000001",
    "building": "Haus 1 – Bettenhaus",
    "floor": 3
  }'
```

`station_type` is `INTENSIVE` or `NORMAL`. `building` is an optional string (defaults to `"Haus 1"`); `floor` is an optional non-negative integer (defaults to `0`, the ground floor).

### Rooms

Rooms belong directly to both a department and a station. `bed_capacity` is calculated from all beds assigned to the room. `current_capacity` is calculated from occupied beds assigned to the room.

```bash
curl -X POST http://localhost:3000/v1/rooms \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "K-101",
    "room_type": "SINGLE_ROOM_STANDARD",
    "department_id": "dep_Berlin000001",
    "station_id": "sta_Berlin000001"
  }'
```

`room_type` is `GROUP_ROOM`, `SINGLE_ROOM_STANDARD`, `SINGLE_ROOM_INFECTIOUS`, `SINGLE_ROOM_AIRLOCK`, or `SECRETARIAT`. `SECRETARIAT` rooms are ward station offices and never carry beds, so `bed_capacity` and `current_capacity` are always `0`.

### Beds

Beds belong directly to a department and station. `room_id` can be `null` when a bed is not assigned to a room.

```bash
curl -X POST http://localhost:3000/v1/beds \
  -H 'Content-Type: application/json' \
  -d '{
    "bed_type": "INTENSIVE_CARE",
    "status": "FREE",
    "material": "STANDARD",
    "department_id": "dep_Berlin000001",
    "station_id": "sta_Berlin000001",
    "room_id": "roo_Berlin000001"
  }'
```

`bed_type` is `INTENSIVE_CARE` or `STANDARD`. `status` is `FREE`, `RESERVED`, or `OCCUPIED`. `material` is `BARIATRIC`, `ELEVATING_LEG_REST`, `PRESSURE_ULCER`, or `STANDARD`.

### Patient Visits

Patient visits track hospital stays or outpatient contacts with a 5 digit `patient_number` for that visit. The number is unique only among active visits and can be reused after discharge.

```bash
curl -X POST http://localhost:3000/v1/patient-visits \
  -H 'Content-Type: application/json' \
  -d '{
    "patient_number": "12345",
    "visit_type": "INPATIENT",
    "status": "ACTIVE",
    "patient_id": "pat_Berlin000001",
    "department_id": "dep_Berlin000001",
    "station_id": "sta_Berlin000001",
    "room_id": "roo_Berlin000002",
    "bed_id": "bed_Berlin000003",
    "started_date": "2026-07-10",
    "started_time": "08:15"
  }'
```

`visit_type` is `INPATIENT` or `OUTPATIENT`. `status` is `ACTIVE` or `DISCHARGED`. Per the current model, an `INPATIENT` visit occupies a bed: it must include `station_id`, `room_id`, and `bed_id`, and that bed is marked `OCCUPIED`. An `OUTPATIENT` visit must not include `station_id`, `room_id`, or `bed_id`; it carries only the department location. At most one `ACTIVE` `INPATIENT` visit may reference a given `bed_id` (enforced by a partial unique DB index). `DISCHARGED` visits must include `ended_date` and `ended_time`.

### Patient Movements

Find free beds in a target department for an active patient visit:

```bash
curl -X POST http://localhost:3000/v1/patient-movements/available-beds \
  -H 'Content-Type: application/json' \
  -d '{
    "patient_number": "12345",
    "target_department_id": "dep_Berlin000001"
  }'
```

Response shape:

```json
{
  "data": {
    "available_bed": true,
    "available_rooms": [
      {
        "id": "roo_Berlin000001",
        "name": "Zimmer 101",
        "department": "Kardiologie",
        "station": "Normalstation",
        "room_type": "SINGLE_ROOM_STANDARD",
        "bed_capacity": 2,
        "current_capacity": 1,
        "available_beds": [
          {
            "id": "bed_Berlin000001",
            "bed_type": "STANDARD",
            "material": "STANDARD"
          }
        ]
      }
    ]
  }
}
```

Reserve a target bed and move the active visit there. If the patient currently has a bed, the old bed is set to `FREE`; the target bed is set to `RESERVED`.

```bash
curl -X POST http://localhost:3000/v1/patient-movements \
  -H 'Content-Type: application/json' \
  -d '{
    "patient_number": "12345",
    "target_bed_id": "bed_Berlin000001"
  }'
```

Finish the movement after the patient arrives. This changes the reserved bed to `OCCUPIED`.

```bash
curl -X POST http://localhost:3000/v1/patient-movements/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "patient_number": "12345"
  }'
```

### Employees

Employees link to a department through `department_id`. Responses return only the department name as `department`.

Create:

```bash
curl -X POST http://localhost:3000/v1/employees \
  -H 'Content-Type: application/json' \
  -d '{
    "first_name": "Anna",
    "last_name": "Müller",
    "position": "Chefärztin",
    "department_id": "dep_Berlin000001"
  }'
```

Response shape:

```json
{
  "data": {
    "id": "emp_Berlin000001",
    "first_name": "Anna",
    "last_name": "Müller",
    "position": "Chefärztin",
    "department": "Kardiologie",
    "created_at": "2026-07-09T10:00:00.000+02:00",
    "updated_at": "2026-07-09T10:00:00.000+02:00"
  }
}
```

### Appointment Types

Appointment types link to a department.

Create:

```bash
curl -X POST http://localhost:3000/v1/appointment-types \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Kardiologisches Erstgespräch",
    "department_id": "dep_Berlin000001",
    "default_duration_minutes": 45
  }'
```

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Appointment type name |
| `department_id` | string | Existing `dep_...` ID |
| `default_duration_minutes` | integer | Must be positive |

Responses return only the department name as `department`.

Filter the list to a single department with the optional `department_id` query
parameter. A `department_id` that does not exist returns `404`.

```bash
curl 'http://localhost:3000/v1/appointment-types?department_id=dep_Berlin000001&page_size=100'
```

Available slots:

```bash
curl 'http://localhost:3000/v1/appointment-types/aty_Berlin000001/slots?start=2026-07-10T08:00&end=2026-07-10T17:00&limit=100'
```

Slot query params:

| Param | Type | Notes |
| --- | --- | --- |
| `start` | string | Required Berlin-local `YYYY-MM-DDTHH:mm` |
| `end` | string | Required Berlin-local `YYYY-MM-DDTHH:mm`; must be after `start` |
| `limit` | integer | Optional, default `100`, max `500` |

### Appointments

Appointments link one patient to one appointment type. The appointment type determines the department.

Create:

```bash
curl -X POST http://localhost:3000/v1/appointments \
  -H 'Content-Type: application/json' \
  -d '{
    "scheduled_date": "2026-07-10",
    "scheduled_time": "08:30",
    "linked_patient_id": "pat_Berlin000001",
    "appointment_type_id": "aty_Berlin000001"
  }'
```

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `scheduled_date` | string | Berlin-local date, `YYYY-MM-DD` |
| `scheduled_time` | string | Berlin-local time, `HH:mm`, `00:00` through `23:59` |
| `linked_patient_id` | string | Existing `pat_...` ID |
| `appointment_type_id` | string | Existing `aty_...` ID |

### Appointment Bookings

Bookings validate a patient by insurance number and birth date before creating an appointment.

```bash
curl -X POST http://localhost:3000/v1/appointments/bookings \
  -H 'Content-Type: application/json' \
  -d '{
    "health_insurance_number": "DESV100001",
    "birth_date": "1988-04-12",
    "appointment_type_id": "aty_Berlin000001",
    "scheduled_date": "2026-07-10",
    "scheduled_time": "08:30"
  }'
```

Booking conflicts return `409` when the requested appointment type/date/time is already occupied.

### Appointment Cancellations

Cancellations validate the patient with insurance number and birth date, then remove the matching appointment for the given appointment type/date/time.

```bash
curl -X POST http://localhost:3000/v1/appointments/cancellations \
  -H 'Content-Type: application/json' \
  -d '{
    "health_insurance_number": "DESV100001",
    "birth_date": "1988-04-12",
    "appointment_type_id": "aty_Berlin000001",
    "scheduled_date": "2026-07-10",
    "scheduled_time": "08:30"
  }'
```

### Appointment Reschedules

Reschedules validate the patient, find the existing appointment by the `from_...` date/time fields, and move it to the `to_...` date/time fields.

```bash
curl -X POST http://localhost:3000/v1/appointments/reschedules \
  -H 'Content-Type: application/json' \
  -d '{
    "health_insurance_number": "DESV100001",
    "birth_date": "1988-04-12",
    "appointment_type_id": "aty_Berlin000001",
    "from_scheduled_date": "2026-07-10",
    "from_scheduled_time": "08:30",
    "to_scheduled_date": "2026-07-10",
    "to_scheduled_time": "09:15"
  }'
```

Reschedule conflicts return `409` when the target appointment type/date/time is already occupied.

### Patient Appointment Searches

Patients can retrieve their appointments by providing insurance number and birth date.

```bash
curl -X POST http://localhost:3000/v1/appointments/searches \
  -H 'Content-Type: application/json' \
  -d '{
    "health_insurance_number": "DESV100001",
    "birth_date": "1988-04-12"
  }'
```

Response items include `employee`, `department`, `appointment_type`, `scheduled_date`, and `scheduled_time`.

## Seeded IDs

`bun run db:reset` seeds a single hospital, `Uniklikum X`, at realistic scale. After it runs, useful seeded IDs and counts include:

| Resource | Example IDs | Count |
| --- | --- | --- |
| Departments | `dep_Berlin000001` through `dep_Berlin000034` | 34 |
| Stations (wards) | `sta_Berlin000001` through `sta_Berlin000400` | 400 |
| Rooms | `roo_Berlin000001` through `roo_Berlin007221` | 7,221 |
| Beds | `bed_Berlin000001` through `bed_Berlin011244` | 11,244 |
| Patients | `pat_Berlin000001` through `pat_Berlin064324` | 64,324 |
| Employees | `emp_Berlin000001` through `emp_Berlin001000` | 1,000 |
| Appointment types | `aty_Berlin000001` through `aty_Berlin000102` | ~102 |
| Appointments | `app_Berlin000001` through `app_Berlin005000` | 5,000 |
| Social security numbers | `ssn_Berlin000001` through `ssn_Berlin064324`, `number` values like `DESV100001` (dash-free) | 64,324 |
| Patient visits | `pvi_Berlin000001` through `pvi_Berlin019241` | 19,241 total; 13,241 active (9,270 `INPATIENT` + 3,971 `OUTPATIENT`) and 6,000 `DISCHARGED` |

Every active `INPATIENT` visit occupies exactly one `OCCUPIED` bed (11,244 beds seeded, 9,270 occupied), so `beds.occupied` from `/v1/ops/summary` equals `visits.active_inpatient`.

## Status Codes

| Status | Meaning |
| --- | --- |
| `200` | Successful read/list |
| `201` | Resource created; `Location` header points to the new resource |
| `404` | Resource or linked resource was not found |
| `409` | Unique constraint conflict |
| `422` | Validation error |

## Full Contract

The full OpenAPI contract is in [openapi.yaml](openapi.yaml). Shared protobuf messages are in [protocol/healthcare/v1/healthcare.proto](protocol/healthcare/v1/healthcare.proto).
