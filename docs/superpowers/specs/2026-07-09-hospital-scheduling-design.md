# Hospital Scheduling API Design

Date: 2026-07-09

## Context

The existing healthcare API is a TypeScript Elysia service using SQLite through Drizzle ORM. It already exposes `/v1` REST resources for patients and social security numbers, with OpenAPI and protobuf contracts, snake_case JSON, public nano IDs, response envelopes, cursor pagination, and RFC 9457 Problem Details errors.

This design extends the API with hospital organization and scheduling resources:

- clinics
- employees
- appointment types
- appointments

The design follows the fertig.ai API event guidelines for REST naming, payload shape, public identifiers, status codes, pagination, and contract-first documentation.

## Goals

- Model clinics as organizational units that own appointment types and employees.
- Model employees as staff members assigned to one clinic.
- Model appointment types as clinic-specific scheduling templates with a default duration.
- Model appointments as patient-linked scheduled events using a date and time.
- Keep this iteration additive and small enough to implement cleanly in the existing API.

## Non-Goals

- Do not validate `current_capacity > max_capacity` yet. Capacity fields are stored and returned, but their operational meaning is reserved for a later workflow.
- Do not assign employees to appointments yet.
- Do not implement room scheduling, shifts, admission/discharge, encounters, diagnoses, prescriptions, billing, or audit logs yet.
- Do not add authentication or multi-tenancy in this iteration.
- Do not publish NATS events in this iteration.

## Data Model

All tables keep internal integer primary keys and expose only public nano IDs in API responses. Timestamps use `created_at` and `updated_at`.

Generated timestamps are Europe/Berlin local date-time strings with an explicit offset, for example `2026-07-09T14:00:00.000+02:00` in summer and `2026-01-15T13:00:00.000+01:00` in winter. The API does not accept timezone parameters or timezone fields.

### clinics

Public ID prefix: `cli_`

Fields:

- `id` internal integer primary key
- `public_id` unique public identifier
- `name`
- `current_capacity`
- `max_capacity`
- `created_at`
- `updated_at`

Notes:

- No validation will compare `current_capacity` and `max_capacity` in this iteration.

### employees

Public ID prefix: `emp_`

Fields:

- `id` internal integer primary key
- `public_id` unique public identifier
- `first_name`
- `last_name`
- `position`
- `clinic_id` internal foreign key to `clinics.id`
- `created_at`
- `updated_at`

Relationship:

- Many employees belong to one clinic.

### appointment_types

Public ID prefix: `aty_`

Fields:

- `id` internal integer primary key
- `public_id` unique public identifier
- `name`
- `clinic_id` internal foreign key to `clinics.id`
- `default_duration_minutes`
- `created_at`
- `updated_at`

Relationship:

- Many appointment types belong to one clinic.

### appointments

Public ID prefix: `app_`

Fields:

- `id` internal integer primary key
- `public_id` unique public identifier
- `scheduled_date`
- `scheduled_time`
- `patient_id` internal foreign key to `patients.id`
- `appointment_type_id` internal foreign key to `appointment_types.id`
- `created_at`
- `updated_at`

Relationships:

- Many appointments belong to one patient.
- Many appointments use one appointment type.
- The appointment's clinic is derived through its appointment type.

Scheduling fields are Berlin-local values. `scheduled_date` and `scheduled_time` do not carry timezone information and are interpreted only in `Europe/Berlin`.

## REST API

All routes are under `/v1`, use plural resources, return top-level JSON objects, and use Problem Details for errors.

### Clinics

- `POST /v1/clinics`
- `GET /v1/clinics`
- `GET /v1/clinics/{clinic_id}`

Create request:

```json
{
  "name": "Cardiology",
  "current_capacity": 12,
  "max_capacity": 30
}
```

Response envelope:

```json
{
  "data": {
    "id": "cli_a7Xk2pQ9mR1z",
    "name": "Cardiology",
    "current_capacity": 12,
    "max_capacity": 30,
    "created_at": "2026-07-09T14:00:00.000+02:00",
    "updated_at": "2026-07-09T14:00:00.000+02:00"
  }
}
```

### Employees

- `POST /v1/employees`
- `GET /v1/employees`
- `GET /v1/employees/{employee_id}`

Create request:

```json
{
  "first_name": "Maya",
  "last_name": "Singh",
  "position": "CARDIOLOGIST",
  "clinic_id": "cli_a7Xk2pQ9mR1z"
}
```

Response includes the linked clinic object:

```json
{
  "data": {
    "id": "emp_a7Xk2pQ9mR1z",
    "first_name": "Maya",
    "last_name": "Singh",
    "position": "CARDIOLOGIST",
    "clinic": {
      "id": "cli_a7Xk2pQ9mR1z",
      "name": "Cardiology",
      "current_capacity": 12,
      "max_capacity": 30,
      "created_at": "2026-07-09T14:00:00.000+02:00",
      "updated_at": "2026-07-09T14:00:00.000+02:00"
    },
    "created_at": "2026-07-09T14:00:00.000+02:00",
    "updated_at": "2026-07-09T14:00:00.000+02:00"
  }
}
```

### Appointment Types

- `POST /v1/appointment-types`
- `GET /v1/appointment-types`
- `GET /v1/appointment-types/{appointment_type_id}`

Create request:

```json
{
  "name": "Initial Consultation",
  "clinic_id": "cli_a7Xk2pQ9mR1z",
  "default_duration_minutes": 30
}
```

Response includes the linked clinic object.

### Appointments

- `POST /v1/appointments`
- `GET /v1/appointments`
- `GET /v1/appointments/{appointment_id}`

Create request:

```json
{
  "scheduled_date": "2026-07-10",
  "scheduled_time": "14:30",
  "linked_patient_id": "pat_a7Xk2pQ9mR1z",
  "appointment_type_id": "aty_a7Xk2pQ9mR1z"
}
```

Response includes the linked patient and appointment type. The appointment type includes its linked clinic.

```json
{
  "data": {
    "id": "app_a7Xk2pQ9mR1z",
    "scheduled_date": "2026-07-10",
    "scheduled_time": "14:30",
    "patient": {
      "id": "pat_a7Xk2pQ9mR1z"
    },
    "appointment_type": {
      "id": "aty_a7Xk2pQ9mR1z",
      "name": "Initial Consultation",
      "default_duration_minutes": 30,
      "clinic": {
        "id": "cli_a7Xk2pQ9mR1z",
        "name": "Cardiology"
      }
    },
    "created_at": "2026-07-09T14:00:00.000+02:00",
    "updated_at": "2026-07-09T14:00:00.000+02:00"
  }
}
```

Later optional subresource:

- `GET /v1/patients/{patient_id}/appointments`

This is intentionally not required for the first implementation if the top-level appointment list can filter by `patient_id`.

## Query Parameters

List endpoints support existing cursor pagination:

- `cursor`
- `page_size`

Appointments may also support:

- `patient_id`
- `clinic_id`
- `scheduled_date`

These query parameters are snake_case and optional. The API does not accept timezone query parameters.

## Validation And Errors

Validation rules:

- Required strings must be non-empty.
- Capacity fields must be integers if provided in clinic creation.
- `default_duration_minutes` must be a positive integer.
- `scheduled_date` must use `YYYY-MM-DD` and is interpreted in `Europe/Berlin`.
- `scheduled_time` must use `HH:mm` and is interpreted in `Europe/Berlin`.
- Timezone request fields and parameters are not accepted.
- Foreign key public IDs must reference existing resources.

Status codes:

- `201 Created` for successful creates, with `Location` header.
- `200 OK` for reads and lists.
- `404 Not Found` when a referenced or requested resource does not exist.
- `409 Conflict` for unique constraint conflicts.
- `422 Unprocessable Entity` for validation failures.
- `500 Internal Server Error` for unexpected failures, with generic Problem Details.

All errors use `application/problem+json`.

## OpenAPI And Protobuf

The OpenAPI contract will add schemas and paths for:

- `Clinic`
- `CreateClinicRequest`
- `ClinicResponse`
- `ClinicListResponse`
- `Employee`
- `CreateEmployeeRequest`
- `EmployeeResponse`
- `EmployeeListResponse`
- `AppointmentType`
- `CreateAppointmentTypeRequest`
- `AppointmentTypeResponse`
- `AppointmentTypeListResponse`
- `Appointment`
- `CreateAppointmentRequest`
- `AppointmentResponse`
- `AppointmentListResponse`

The protobuf contract will add corresponding messages in `fertigai.healthcare.v1`. Existing field numbers in current messages will not be changed. Generated API timestamp fields are strings carrying the Europe/Berlin offset rather than UTC-only timestamp values.

## Testing Plan

Tests should be written before implementation and should cover:

- Creating and reading a clinic.
- Creating an employee linked to a clinic.
- Creating an appointment type linked to a clinic.
- Creating an appointment linked to an existing patient and appointment type.
- Listing appointments with cursor pagination.
- Returning Problem Details for missing linked clinic, patient, or appointment type.
- Accepting clinic capacity values without validating `current_capacity <= max_capacity`.

## Future Ideas

After this scheduling model is stable, the next useful hospital API expansions are:

- employee assignment to appointments
- employee shifts and availability
- rooms and room capacity
- patient encounters and visit notes
- diagnoses and procedure codes
- prescriptions
- admission and discharge workflows
- audit log events
