# Hospital Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clinic, employee, appointment type, and appointment resources to the existing Elysia/SQLite healthcare API.

**Architecture:** Extend the current vertical slice in place: contract tests drive OpenAPI/protobuf updates, Drizzle schema/migration additions, repository methods, serializers, validators, and Elysia routes. Keep internal integer primary keys private and expose only prefixed public nano IDs. Cursor tokens must derive from public IDs, never internal integer IDs. Preserve the existing `/v1`, plural-resource, snake_case JSON, response-envelope, cursor-pagination, and Problem Details patterns.

**Tech Stack:** Bun, TypeScript, Elysia, Drizzle ORM, SQLite, bun:test, OpenAPI 3.1, protobuf.

---

## Best-Practice Constraints

- Follow `api-event-guidelines`: `/v1` URL versioning, plural resource names, kebab-case path segments, snake_case JSON/query fields, top-level `data` envelopes, RFC 9457 Problem Details, cursor pagination for list endpoints, `Location` headers on `201 Created`, and public prefixed nano IDs.
- Do not expose internal integer IDs in API responses, URLs, or cursor payloads.
- Generated `created_at` and `updated_at` values are Europe/Berlin local date-time strings with an explicit offset, for example `2026-07-09T14:00:00.000+02:00` or `2026-01-15T13:00:00.000+01:00`.
- Appointment `scheduled_date` and `scheduled_time` values are Berlin-local values. Do not add request timezone fields or timezone query parameters.
- Do not validate `current_capacity <= max_capacity`; only validate that both capacity fields are integers.
- Write failing tests before implementation changes for each task.
- Keep changes additive. Do not rename existing patient/social-security-number fields or routes.
- Use focused commits after each passing task.

## File Map

- Modify `test/api.test.ts`: add contract tests for clinics, employees, appointment types, appointments, missing references, pagination, and capacity behavior.
- Modify `src/db/schema.ts`: add Drizzle tables and relations for `clinics`, `employees`, `appointmentTypes`, and `appointments`.
- Modify `src/db/migrate.ts`: add SQLite `CREATE TABLE IF NOT EXISTS` statements and indexes.
- Modify `src/api/time.ts`: use a shared Europe/Berlin timestamp helper for generated `created_at` and `updated_at` values.
- Modify `src/api/validation.ts`: add create-input validators for the four new resources plus integer/time helpers.
- Modify `src/api/serializers.ts`: add resource serializers and lightweight patient reference serializer for appointment responses.
- Modify `src/repositories/healthcare.ts`: add create/list/get methods and joins for the new resources.
- Modify `src/app.ts`: register new `/v1` routes and wire validators, repository calls, serializers, `Location` headers, and Problem Details.
- Modify `openapi.yaml`: add paths, request schemas, response schemas, and path/query parameter docs.
- Modify `protocol/healthcare/v1/healthcare.proto`: add corresponding messages without changing existing field numbers.

## Task 1: Clinic Contract And API

**Files:**
- Modify: `test/api.test.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrate.ts`
- Modify: `src/api/validation.ts`
- Modify: `src/api/serializers.ts`
- Modify: `src/repositories/healthcare.ts`
- Modify: `src/app.ts`
- Modify: `openapi.yaml`
- Modify: `protocol/healthcare/v1/healthcare.proto`

- [ ] **Step 1: Write failing clinic tests**

Add tests that create a clinic, read it by ID, list clinics, and accept `current_capacity > max_capacity`.

```ts
async function createClinic(input = {
  name: "Cardiology",
  current_capacity: 42,
  max_capacity: 12,
}) {
  const response = await request("/v1/clinics", {
    method: "POST",
    body: JSON.stringify(input),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data;
}

test("creates clinics without comparing current and max capacity", async () => {
  const response = await request("/v1/clinics", {
    method: "POST",
    body: JSON.stringify({
      name: "Cardiology",
      current_capacity: 42,
      max_capacity: 12,
    }),
  });

  expect(response.status).toBe(201);
  expect(response.headers.get("location")).toMatch(
    /^\/v1\/clinics\/cli_[A-Za-z0-9]{12}$/,
  );

  const body = (await response.json()) as { data: Record<string, unknown> };
  expect(body).toEqual({
    data: {
      id: expect.stringMatching(/^cli_[A-Za-z0-9]{12}$/),
      name: "Cardiology",
      current_capacity: 42,
      max_capacity: 12,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    },
  });
  expect(body.data).not.toHaveProperty("internal_id");
});

test("reads clinics by public id", async () => {
  const clinic = await createClinic();

  const response = await request(`/v1/clinics/${clinic.id}`);
  const body = (await response.json()) as { data: { id: string } };

  expect(response.status).toBe(200);
  expect(body.data.id).toBe(clinic.id);
});

test("lists clinics with cursor pagination", async () => {
  await createClinic({ name: "Cardiology", current_capacity: 1, max_capacity: 2 });

  const response = await request("/v1/clinics?page_size=20");
  const body = (await response.json()) as {
    data: unknown[];
    pagination: Record<string, unknown>;
  };

  expect(response.status).toBe(200);
  expect(body.data).toHaveLength(1);
  expect(body.pagination).toEqual({
    self: "/v1/clinics?page_size=20",
    has_more: false,
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test`

Expected: clinic tests fail with `404` route not found or missing implementation.

- [ ] **Step 3: Update schema and migration**

In `src/db/schema.ts`, add:

```ts
export const clinics = sqliteTable(
  "clinics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    currentCapacity: integer("current_capacity").notNull(),
    maxCapacity: integer("max_capacity").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("clinics_public_id_unique").on(table.publicId),
    index("clinics_created_at_id_idx").on(table.createdAt, table.id),
  ],
);
```

Add `clinics` to the exported `schema` object and export `ClinicRow` / `NewClinicRow` types.

In `src/db/migrate.ts`, add:

```sql
CREATE TABLE IF NOT EXISTS clinics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  current_capacity INTEGER NOT NULL,
  max_capacity INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

Add index `clinics_created_at_id_idx`.

- [ ] **Step 4: Add validation and serialization**

In `src/api/validation.ts`, add:

```ts
export type CreateClinicInput = {
  name: string;
  current_capacity: number;
  max_capacity: number;
};

export function validateClinicInput(input: unknown): CreateClinicInput {
  const body = objectBody(input);

  return {
    name: requiredString(body, "name"),
    current_capacity: requiredInteger(body, "current_capacity"),
    max_capacity: requiredInteger(body, "max_capacity"),
  };
}

function requiredInteger(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer`);
  }

  return value;
}
```

In `src/api/serializers.ts`, add `ClinicResource` and:

```ts
export function serializeClinic(row: ClinicRow): ClinicResource {
  return {
    id: row.publicId,
    name: row.name,
    current_capacity: row.currentCapacity,
    max_capacity: row.maxCapacity,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}
```

- [ ] **Step 5: Add repository methods**

In `src/repositories/healthcare.ts`, import `clinics`, update `publicId()` to accept `"cli"`, and add:

```ts
createClinic(input: CreateClinic) {
  const now = berlinTimestamp();

  return db.insert(clinics).values({
    publicId: publicId("cli"),
    name: input.name,
    currentCapacity: input.currentCapacity,
    maxCapacity: input.maxCapacity,
    createdAt: now,
    updatedAt: now,
  }).returning().get();
},

listClinics(afterPublicId: string | undefined, pageSize: number) {
  const cursorRow = afterPublicId ? this.getClinic(afterPublicId) : undefined;

  if (afterPublicId && !cursorRow) {
    return { data: [], nextPublicId: undefined };
  }

  const rows = db.select().from(clinics)
    .where(cursorRow ? gt(clinics.id, cursorRow.id) : undefined)
    .orderBy(clinics.id)
    .limit(pageSize + 1)
    .all();

  return pageRows(rows, pageSize, (row) => row.publicId);
},

getClinic(publicId: string) {
  return db.select().from(clinics)
    .where(eq(clinics.publicId, publicId))
    .get();
},
```

- [ ] **Step 6: Add Elysia routes**

In `src/app.ts`, import `validateClinicInput` and `serializeClinic`. Add:

```ts
.post("/v1/clinics", ({ body, request, set }) => {
  const instance = new URL(request.url).pathname;
  const parsed = withValidation(() => validateClinicInput(body), instance, set);

  if (!parsed.ok) return parsed.response;

  const created = repository.createClinic({
    name: parsed.value.name,
    currentCapacity: parsed.value.current_capacity,
    maxCapacity: parsed.value.max_capacity,
  });

  set.status = 201;
  set.headers.Location = `/v1/clinics/${created.publicId}`;

  return { data: serializeClinic(created) };
})
```

Add `GET /v1/clinics` using `parsePageParams`, `decodeCursor`, `repository.listClinics`, and `paginationFor`.

Cursor payloads must encode public IDs, for example `{ "public_id": "cli_a7Xk2pQ9mR1z" }`, and must not expose internal integer IDs.

Add `GET /v1/clinics/:clinic_id` using `repository.getClinic`, returning `404` Problem Details with detail `Clinic was not found`.

- [ ] **Step 7: Update OpenAPI and protobuf**

In `openapi.yaml`, add `/v1/clinics` and `/v1/clinics/{clinic_id}` plus schemas:

- `Clinic`
- `CreateClinicRequest`
- `ClinicResponse`
- `ClinicListResponse`

In `protocol/healthcare/v1/healthcare.proto`, add `Clinic`, `CreateClinicRequest`, `ClinicResponse`, and `ClinicListResponse`.

- [ ] **Step 8: Run checks**

Run: `bun test`

Expected: all existing tests and clinic tests pass.

Run: `bun run typecheck`

Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add test/api.test.ts src/db/schema.ts src/db/migrate.ts src/api/validation.ts src/api/serializers.ts src/repositories/healthcare.ts src/app.ts openapi.yaml protocol/healthcare/v1/healthcare.proto
git commit -m "feat: add clinic API"
```

## Task 2: Employee Contract And API

**Files:**
- Modify: `test/api.test.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrate.ts`
- Modify: `src/api/validation.ts`
- Modify: `src/api/serializers.ts`
- Modify: `src/repositories/healthcare.ts`
- Modify: `src/app.ts`
- Modify: `openapi.yaml`
- Modify: `protocol/healthcare/v1/healthcare.proto`

- [ ] **Step 1: Write failing employee tests**

Add tests for creating an employee linked to a clinic, reading by ID, listing, and missing clinic errors.

```ts
async function createEmployee(clinicId: string) {
  const response = await request("/v1/employees", {
    method: "POST",
    body: JSON.stringify({
      first_name: "Maya",
      last_name: "Singh",
      position: "CARDIOLOGIST",
      clinic_id: clinicId,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data;
}

test("creates employees linked to clinics", async () => {
  const clinic = await createClinic();

  const response = await request("/v1/employees", {
    method: "POST",
    body: JSON.stringify({
      first_name: "Maya",
      last_name: "Singh",
      position: "CARDIOLOGIST",
      clinic_id: clinic.id,
    }),
  });

  expect(response.status).toBe(201);
  expect(response.headers.get("location")).toMatch(
    /^\/v1\/employees\/emp_[A-Za-z0-9]{12}$/,
  );

  const body = (await response.json()) as { data: Record<string, unknown> };
  expect(body.data).toEqual({
    id: expect.stringMatching(/^emp_[A-Za-z0-9]{12}$/),
    first_name: "Maya",
    last_name: "Singh",
    position: "CARDIOLOGIST",
    clinic,
    created_at: expect.any(String),
    updated_at: expect.any(String),
  });
});

test("returns problem details when employee clinic does not exist", async () => {
  const response = await request("/v1/employees", {
    method: "POST",
    body: JSON.stringify({
      first_name: "Maya",
      last_name: "Singh",
      position: "CARDIOLOGIST",
      clinic_id: "cli_abc123ABC456",
    }),
  });

  const body = await response.json();

  expect(response.status).toBe(404);
  expect(response.headers.get("content-type")).toContain("application/problem+json");
  expect(body).toEqual({
    type: "https://api.fertig.ai/problems/not-found",
    title: "Not Found",
    status: 404,
    detail: "Clinic was not found",
    instance: "/v1/employees",
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test`

Expected: employee tests fail with `404` route not found or missing implementation.

- [ ] **Step 3: Add schema and migration**

In `src/db/schema.ts`, add `employees` table:

```ts
export const employees = sqliteTable(
  "employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    position: text("position").notNull(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("employees_public_id_unique").on(table.publicId),
    index("employees_clinic_id_idx").on(table.clinicId),
    index("employees_created_at_id_idx").on(table.createdAt, table.id),
  ],
);
```

Add relations, exported schema entries, row types, and matching SQL in `src/db/migrate.ts`.

- [ ] **Step 4: Add validation and serialization**

Add `CreateEmployeeInput`, `validateEmployeeInput`, `EmployeeResource`, and `serializeEmployee(row, clinic)`.

`position` remains a string in this iteration; it is not an enum because the user did not define an authoritative position list.

- [ ] **Step 5: Add repository methods**

Add `createEmployee`, `listEmployees`, and `getEmployee` using joins to return `{ employee, clinic }`.

Missing clinic behavior:

```ts
const clinic = this.getClinic(input.clinicPublicId);
if (!clinic) return undefined;
```

- [ ] **Step 6: Add Elysia routes**

Add:

- `POST /v1/employees`
- `GET /v1/employees`
- `GET /v1/employees/:employee_id`

Use `404` Problem Details with detail `Clinic was not found` for missing linked clinic and `Employee was not found` for reads.

- [ ] **Step 7: Update OpenAPI and protobuf**

Add paths and schemas/messages for:

- `Employee`
- `CreateEmployeeRequest`
- `EmployeeResponse`
- `EmployeeListResponse`

- [ ] **Step 8: Run checks**

Run: `bun test`

Expected: all tests pass.

Run: `bun run typecheck`

Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add test/api.test.ts src/db/schema.ts src/db/migrate.ts src/api/validation.ts src/api/serializers.ts src/repositories/healthcare.ts src/app.ts openapi.yaml protocol/healthcare/v1/healthcare.proto
git commit -m "feat: add employee API"
```

## Task 3: Appointment Type Contract And API

**Files:**
- Modify: `test/api.test.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrate.ts`
- Modify: `src/api/validation.ts`
- Modify: `src/api/serializers.ts`
- Modify: `src/repositories/healthcare.ts`
- Modify: `src/app.ts`
- Modify: `openapi.yaml`
- Modify: `protocol/healthcare/v1/healthcare.proto`

- [ ] **Step 1: Write failing appointment type tests**

```ts
async function createAppointmentType(clinicId: string) {
  const response = await request("/v1/appointment-types", {
    method: "POST",
    body: JSON.stringify({
      name: "Initial Consultation",
      clinic_id: clinicId,
      default_duration_minutes: 30,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data;
}

test("creates appointment types linked to clinics", async () => {
  const clinic = await createClinic();

  const response = await request("/v1/appointment-types", {
    method: "POST",
    body: JSON.stringify({
      name: "Initial Consultation",
      clinic_id: clinic.id,
      default_duration_minutes: 30,
    }),
  });

  expect(response.status).toBe(201);
  expect(response.headers.get("location")).toMatch(
    /^\/v1\/appointment-types\/aty_[A-Za-z0-9]{12}$/,
  );

  const body = (await response.json()) as { data: Record<string, unknown> };
  expect(body.data).toEqual({
    id: expect.stringMatching(/^aty_[A-Za-z0-9]{12}$/),
    name: "Initial Consultation",
    clinic,
    default_duration_minutes: 30,
    created_at: expect.any(String),
    updated_at: expect.any(String),
  });
});
```

Also add tests for missing clinic and invalid `default_duration_minutes`.

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test`

Expected: appointment type tests fail with route not found or missing implementation.

- [ ] **Step 3: Add schema and migration**

Add `appointmentTypes` table:

```ts
export const appointmentTypes = sqliteTable(
  "appointment_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    clinicId: integer("clinic_id").notNull().references(() => clinics.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    defaultDurationMinutes: integer("default_duration_minutes").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("appointment_types_public_id_unique").on(table.publicId),
    index("appointment_types_clinic_id_idx").on(table.clinicId),
    index("appointment_types_created_at_id_idx").on(table.createdAt, table.id),
  ],
);
```

Add SQL migration and relations.

- [ ] **Step 4: Add validation and serialization**

Add:

```ts
export function validateAppointmentTypeInput(input: unknown) {
  const body = objectBody(input);
  return {
    name: requiredString(body, "name"),
    clinic_id: requiredString(body, "clinic_id"),
    default_duration_minutes: requiredPositiveInteger(
      body,
      "default_duration_minutes",
    ),
  };
}
```

Add `requiredPositiveInteger`.

Add `serializeAppointmentType(row, clinic)`.

- [ ] **Step 5: Add repository methods**

Add `createAppointmentType`, `listAppointmentTypes`, and `getAppointmentType`.

Update `publicId()` to accept `"aty"`.

- [ ] **Step 6: Add Elysia routes**

Add:

- `POST /v1/appointment-types`
- `GET /v1/appointment-types`
- `GET /v1/appointment-types/:appointment_type_id`

Use `404` details `Clinic was not found` and `Appointment type was not found`.

- [ ] **Step 7: Update OpenAPI and protobuf**

Add paths and schemas/messages for:

- `AppointmentType`
- `CreateAppointmentTypeRequest`
- `AppointmentTypeResponse`
- `AppointmentTypeListResponse`

- [ ] **Step 8: Run checks**

Run: `bun test`

Expected: all tests pass.

Run: `bun run typecheck`

Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add test/api.test.ts src/db/schema.ts src/db/migrate.ts src/api/validation.ts src/api/serializers.ts src/repositories/healthcare.ts src/app.ts openapi.yaml protocol/healthcare/v1/healthcare.proto
git commit -m "feat: add appointment type API"
```

## Task 4: Appointment Contract And API

**Files:**
- Modify: `test/api.test.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrate.ts`
- Modify: `src/api/validation.ts`
- Modify: `src/api/serializers.ts`
- Modify: `src/repositories/healthcare.ts`
- Modify: `src/app.ts`
- Modify: `openapi.yaml`
- Modify: `protocol/healthcare/v1/healthcare.proto`

- [ ] **Step 1: Write failing appointment tests**

Add helper:

```ts
async function createPatient() {
  const socialSecurityNumber = await createSocialSecurityNumber();
  const response = await request("/v1/patients", {
    method: "POST",
    body: JSON.stringify({
      gender: "FEMALE",
      first_name: "Ada",
      last_name: "Lovelace",
      birth_date: "1815-12-10",
      birthplace: "London",
      social_security_number_id: socialSecurityNumber.id,
      telephone_number: "+491701234567",
      accepted_gdpr: true,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data;
}
```

Add tests:

```ts
test("creates appointments linked to patients and appointment types", async () => {
  const clinic = await createClinic();
  const patient = await createPatient();
  const appointmentType = await createAppointmentType(clinic.id);

  const response = await request("/v1/appointments", {
    method: "POST",
    body: JSON.stringify({
      scheduled_date: "2026-07-10",
      scheduled_time: "14:30",
      linked_patient_id: patient.id,
      appointment_type_id: appointmentType.id,
    }),
  });

  expect(response.status).toBe(201);
  expect(response.headers.get("location")).toMatch(
    /^\/v1\/appointments\/app_[A-Za-z0-9]{12}$/,
  );

  const body = (await response.json()) as { data: Record<string, unknown> };
  expect(body.data).toEqual({
    id: expect.stringMatching(/^app_[A-Za-z0-9]{12}$/),
    scheduled_date: "2026-07-10",
    scheduled_time: "14:30",
    patient: {
      id: patient.id,
    },
    appointment_type: appointmentType,
    created_at: expect.any(String),
    updated_at: expect.any(String),
  });
});
```

Also add tests for:

- `GET /v1/appointments/{appointment_id}`
- `GET /v1/appointments?page_size=1` cursor pagination with two appointments
- missing patient returns `404` detail `Patient was not found`
- missing appointment type returns `404` detail `Appointment type was not found`
- invalid `scheduled_time` returns `422` Problem Details

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test`

Expected: appointment tests fail with route not found or missing implementation.

- [ ] **Step 3: Add schema and migration**

Add `appointments` table:

```ts
export const appointments = sqliteTable(
  "appointments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    scheduledDate: text("scheduled_date").notNull(),
    scheduledTime: text("scheduled_time").notNull(),
    patientId: integer("patient_id").notNull().references(() => patients.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    appointmentTypeId: integer("appointment_type_id")
      .notNull()
      .references(() => appointmentTypes.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("appointments_public_id_unique").on(table.publicId),
    index("appointments_patient_id_idx").on(table.patientId),
    index("appointments_appointment_type_id_idx").on(table.appointmentTypeId),
    index("appointments_scheduled_date_idx").on(table.scheduledDate),
    index("appointments_created_at_id_idx").on(table.createdAt, table.id),
  ],
);
```

Add migration SQL and relations.

- [ ] **Step 4: Add validation and serialization**

Add:

```ts
const isoTimePattern = /^\d{2}:\d{2}$/;

export function validateAppointmentInput(input: unknown) {
  const body = objectBody(input);
  const scheduledDate = requiredString(body, "scheduled_date");
  const scheduledTime = requiredString(body, "scheduled_time");

  if (!isoDatePattern.test(scheduledDate)) {
    throw new Error("scheduled_date must use YYYY-MM-DD format");
  }

  if (!isoTimePattern.test(scheduledTime)) {
    throw new Error("scheduled_time must use HH:mm format");
  }

  return {
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    linked_patient_id: requiredString(body, "linked_patient_id"),
    appointment_type_id: requiredString(body, "appointment_type_id"),
  };
}
```

If stricter time validation is desired, reject values outside `00:00` through `23:59`.

Add a lightweight `serializePatientReference(patient)` for appointment responses:

```ts
export function serializePatientReference(row: PatientRow) {
  return {
    id: row.publicId,
  };
}
```

Use this consistently in appointment responses. Do not expose internal IDs or social security number details inside appointment `patient`.

Add `serializeAppointment(row, patient, appointmentType, clinic)`.

- [ ] **Step 5: Add repository methods**

Add `createAppointment`, `listAppointments`, and `getAppointment`.

Creation flow:

1. Resolve `linked_patient_id` through existing `getPatient(publicId)`.
2. Resolve `appointment_type_id` through `getAppointmentType(publicId)`.
3. Insert appointment with internal `patient.id` and `appointmentType.id`.
4. Return joined appointment, patient, appointment type, and clinic for serialization.

List/get queries should join:

- `appointments`
- `patients`
- `appointment_types`
- `clinics`

Update `publicId()` to accept `"app"`.

- [ ] **Step 6: Add Elysia routes**

Add:

- `POST /v1/appointments`
- `GET /v1/appointments`
- `GET /v1/appointments/:appointment_id`

For list filters, implement at least the base cursor-paginated list. Optional filters from the spec (`patient_id`, `clinic_id`, `scheduled_date`) may be deferred unless tests are added for them.

Use these Problem Details:

- `Patient was not found`
- `Appointment type was not found`
- `Appointment was not found`

- [ ] **Step 7: Update OpenAPI and protobuf**

Add paths and schemas/messages for:

- `Appointment`
- `CreateAppointmentRequest`
- `AppointmentResponse`
- `AppointmentListResponse`

Represent `scheduled_date` and `scheduled_time` as strings in REST/protobuf for now, matching the existing patient `birth_date` pattern.

Treat `scheduled_date` and `scheduled_time` as Europe/Berlin local values. Do not add timezone fields to the request, response, OpenAPI schema, or protobuf message.

- [ ] **Step 8: Run checks**

Run: `bun test`

Expected: all tests pass.

Run: `bun run typecheck`

Expected: exit code 0.

- [ ] **Step 9: Commit**

```bash
git add test/api.test.ts src/db/schema.ts src/db/migrate.ts src/api/validation.ts src/api/serializers.ts src/repositories/healthcare.ts src/app.ts openapi.yaml protocol/healthcare/v1/healthcare.proto
git commit -m "feat: add appointment API"
```

## Task 5: Contract Consistency And Final Verification

**Files:**
- Modify: `openapi.yaml`
- Modify: `protocol/healthcare/v1/healthcare.proto`
- Modify: any implementation file only if consistency gaps are found

- [ ] **Step 1: Review REST naming**

Check:

- URLs use `/v1`.
- URL resources are plural.
- Path segments are kebab-case: `appointment-types`.
- Path params are snake_case: `appointment_type_id`.
- JSON/request/query fields are snake_case.
- Response bodies are top-level objects with `data`, plus `pagination` for lists.

- [ ] **Step 2: Review OpenAPI response codes**

For every new route, verify documented statuses:

- `200`
- `201`
- `404` where linked/read resources can be missing
- `409` where unique conflicts can happen
- `422` where validation can fail
- `500` only if the existing spec pattern documents it

- [ ] **Step 3: Review protobuf compatibility**

Verify no existing message field numbers changed. New messages should be appended and use snake_case protobuf field names matching REST JSON names.

- [ ] **Step 4: Run full verification**

Run:

```bash
bun test
bun run typecheck
```

Expected:

- `bun test`: all tests pass, 0 failures.
- `bun run typecheck`: `tsc --noEmit` exits 0.

- [ ] **Step 5: Inspect git status**

Run: `git status --short`

Expected: only intentional tracked changes remain.

- [ ] **Step 6: Commit final cleanup if needed**

If Task 5 changed files:

```bash
git add openapi.yaml protocol/healthcare/v1/healthcare.proto src test
git commit -m "chore: align hospital scheduling contracts"
```
