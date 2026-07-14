import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { createDatabase } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import type { AppDatabase } from "../src/db/client";

const jsonHeaders = {
  "content-type": "application/json",
  accept: "application/json",
  "x-request-id": "req_test_123",
};

let db: AppDatabase;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = createDatabase(":memory:");
  migrate(db);
  app = createApp({ db });
});

function request(path: string, init?: RequestInit) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      ...init,
      headers: {
        ...jsonHeaders,
        ...init?.headers,
      },
    }),
  );
}

async function createSocialSecurityNumber() {
  const response = await request("/v1/social-security-numbers", {
    method: "POST",
    body: JSON.stringify({
      number: `A${crypto.randomUUID()}`,
      health_insurance_provider: "Techniker Krankenkasse",
      insurance_type: "STATUTORY",
    }),
  });

  expect(response.status).toBe(201);
  const body = (await response.json()) as { data: { id: string } };

  return body.data;
}

async function createSocialSecurityNumberWithNumber(number: string) {
  const response = await request("/v1/social-security-numbers", {
    method: "POST",
    body: JSON.stringify({
      number,
      health_insurance_provider: "Techniker Krankenkasse",
      insurance_type: "STATUTORY",
    }),
  });

  expect(response.status).toBe(201);
  const body = (await response.json()) as { data: { id: string } };

  return body.data;
}

async function createDepartment(
  input = {
    name: "Cardiology",
    current_capacity: 42,
    max_capacity: 12,
  },
) {
  const response = await request("/v1/departments", {
    method: "POST",
    body: JSON.stringify(input),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string; name: string };
  }).data;
}

async function createEmployee(departmentId: string) {
  const response = await request("/v1/employees", {
    method: "POST",
    body: JSON.stringify({
      first_name: "Maya",
      last_name: "Singh",
      position: "CARDIOLOGIST",
      department_id: departmentId,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string; first_name: string };
  }).data;
}

async function createAppointmentType(departmentId: string) {
  const response = await request("/v1/appointment-types", {
    method: "POST",
    body: JSON.stringify({
      name: "Initial Consultation",
      department_id: departmentId,
      default_duration_minutes: 30,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string; name: string };
  }).data;
}

async function createStation(departmentId: string) {
  const response = await request("/v1/stations", {
    method: "POST",
    body: JSON.stringify({
      name: "Intensivstation 1",
      station_type: "INTENSIVE",
      department_id: departmentId,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string; name: string };
  }).data;
}

async function createRoom(departmentId: string, stationId: string) {
  const response = await request("/v1/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: "Zimmer 101",
      room_type: "SINGLE_ROOM_STANDARD",
      department_id: departmentId,
      station_id: stationId,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string; name: string };
  }).data;
}

async function createStationAt(
  departmentId: string,
  input: { name: string; building: string; floor: number; stationType?: string },
) {
  const response = await request("/v1/stations", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      station_type: input.stationType ?? "NORMAL",
      department_id: departmentId,
      building: input.building,
      floor: input.floor,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string; name: string; building: string; floor: number };
  }).data;
}

async function createRoomWithType(
  departmentId: string,
  stationId: string,
  name: string,
  roomType: string,
) {
  const response = await request("/v1/rooms", {
    method: "POST",
    body: JSON.stringify({
      name,
      room_type: roomType,
      department_id: departmentId,
      station_id: stationId,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string; name: string };
  }).data;
}

async function createBed(
  departmentId: string,
  stationId: string,
  roomId: string | null,
  status = "FREE",
) {
  const response = await request("/v1/beds", {
    method: "POST",
    body: JSON.stringify({
      bed_type: "INTENSIVE_CARE",
      status,
      material: "STANDARD",
      department_id: departmentId,
      station_id: stationId,
      room_id: roomId,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string };
  }).data;
}

async function createPatientVisit(input: Record<string, unknown>) {
  const response = await request("/v1/patient-visits", {
    method: "POST",
    body: JSON.stringify(input),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string; patient_number: string };
  }).data;
}

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
      telephone_number: "+4917012345",
      accepted_gdpr: true,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data;
}

async function createPatientWithInsuranceNumber(
  insuranceNumber: string,
  birthDate = "1988-04-12",
) {
  const socialSecurityNumber =
    await createSocialSecurityNumberWithNumber(insuranceNumber);
  const response = await request("/v1/patients", {
    method: "POST",
    body: JSON.stringify({
      gender: "FEMALE",
      first_name: "Lena",
      last_name: "Schneider",
      birth_date: birthDate,
      birthplace: "Berlin",
      social_security_number_id: socialSecurityNumber.id,
      telephone_number: "+493012345001",
      accepted_gdpr: true,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data;
}

async function createAppointment(patientId: string, appointmentTypeId: string) {
  return createAppointmentAt(patientId, appointmentTypeId, {
    scheduled_date: "2026-07-10",
    scheduled_time: "14:30",
  });
}

async function createAppointmentAt(
  patientId: string,
  appointmentTypeId: string,
  slot: { scheduled_date: string; scheduled_time: string },
) {
  const response = await request("/v1/appointments", {
    method: "POST",
    body: JSON.stringify({
      scheduled_date: slot.scheduled_date,
      scheduled_time: slot.scheduled_time,
      linked_patient_id: patientId,
      appointment_type_id: appointmentTypeId,
    }),
  });

  expect(response.status).toBe(201);
  return ((await response.json()) as {
    data: { id: string; scheduled_date: string; scheduled_time: string };
  }).data;
}

function decodeCursorFromNext(next: string) {
  const cursor = new URL(`http://localhost${next}`).searchParams.get("cursor");

  expect(cursor).toBeTruthy();

  return JSON.parse(
    Buffer.from(cursor as string, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

describe("healthcare api", () => {
  test("creates social security numbers using an English API and response envelope", async () => {
    const response = await request("/v1/social-security-numbers", {
      method: "POST",
      body: JSON.stringify({
        number: "A1234589",
        health_insurance_provider: "Techniker Krankenkasse",
        insurance_type: "STATUTORY",
      }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("location")).toMatch(
      /^\/v1\/social-security-numbers\/ssn_[A-Za-z0-9]{12}$/,
    );

    const body = (await response.json()) as {
      data: Record<string, unknown>;
    };

    expect(body).toEqual({
      data: {
        id: expect.stringMatching(/^ssn_[A-Za-z0-9]{12}$/),
        number: "A1234589",
        health_insurance_provider: "Techniker Krankenkasse",
        insurance_type: "STATUTORY",
        created_at: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+0[12]:00$/,
        ),
        updated_at: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+0[12]:00$/,
        ),
      },
    });
    expect(body.data.created_at).not.toMatch(/Z$/);
    expect(body.data.updated_at).not.toMatch(/Z$/);
    expect(body.data).not.toHaveProperty("internal_id");
    expect(body.data).not.toHaveProperty("krankenkasse");
  });

  test("resets and seeds German hospital mock data", async () => {
    await createDepartment({
      name: "Temporary Department",
      current_capacity: 1,
      max_capacity: 1,
    });

    const response = await request("/v1/database-seeds", {
      method: "POST",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).toEqual({
      data: {
        hospital_name: "Uniklikum X",
        reset: true,
        summary: {
          social_security_numbers: 64_324,
          patients: 64_324,
          departments: 34,
          stations: 400,
          rooms: 7_221,
          beds: 11_244,
          patient_visits: 19_240,
          employees: 1_000,
          appointment_types: 102,
          appointments: 5_000,
        },
      },
    });

    const departmentsResponse = await request("/v1/departments?page_size=10");
    const departmentsBody = (await departmentsResponse.json()) as {
      data: Array<{ name: string }>;
    };

    expect(departmentsBody.data.map((department) => department.name)).toEqual([
      "Kardiologie",
      "Herzchirurgie",
      "Neurologie",
      "Neurochirurgie",
      "Hämatologie und Onkologie",
      "Gastroenterologie",
      "Nephrologie",
      "Pneumologie",
      "Endokrinologie und Diabetologie",
      "Rheumatologie und Klinische Immunologie",
    ]);
  });

  test("returns financial summary for the dashboard", async () => {
    await request("/v1/database-seeds", { method: "POST" });

    const response = await request("/v1/financial/summary");
    const body = (await response.json()) as {
      data: {
        revenue_today: number;
        revenue_mtd: number;
        outstanding: number;
        cost_today: number;
        margin_pct: number;
        payer_mix: { statutory: number; private: number };
      };
    };

    expect(response.status).toBe(200);
    expect(body.data.revenue_today).toBeGreaterThan(0);
    expect(body.data.revenue_mtd).toBeGreaterThan(body.data.revenue_today);
    expect(body.data.outstanding).toBeGreaterThan(0);
    expect(body.data.cost_today).toBeGreaterThan(0);
    expect(body.data.margin_pct).toBeGreaterThan(0);
    expect(body.data.payer_mix.statutory + body.data.payer_mix.private).toBe(100);
  });

  test("returns financial trend and department financials", async () => {
    await request("/v1/database-seeds", { method: "POST" });

    const trendResponse = await request("/v1/financial/revenue-trend?days=7");
    const trendBody = (await trendResponse.json()) as {
      data: Array<{ date: string; revenue: number; cost: number }>;
    };
    const departmentResponse = await request("/v1/financial/by-department");
    const departmentBody = (await departmentResponse.json()) as {
      data: Array<{ department: string; revenue: number; cost: number }>;
    };

    expect(trendResponse.status).toBe(200);
    expect(trendBody.data).toHaveLength(7);
    expect(trendBody.data[0]?.date).toBe("2026-07-04");
    expect(trendBody.data.at(-1)?.date).toBe("2026-07-10");
    expect(trendBody.data.every((point) => point.revenue > point.cost)).toBe(true);
    expect(departmentResponse.status).toBe(200);
    expect(departmentBody.data).toHaveLength(34);
    expect(departmentBody.data.map((row) => row.department)).toContain(
      "Kardiologie",
    );
    expect(departmentBody.data.every((row) => row.revenue > row.cost)).toBe(true);
  });

  test("lists financial invoices with cursor pagination", async () => {
    await request("/v1/database-seeds", { method: "POST" });

    const response = await request("/v1/financial/invoices?page_size=10");
    const body = (await response.json()) as {
      data: Array<{
        id: string;
        department: string;
        payer: string;
        insurance_type: string;
        amount: number;
        status: string;
        issued_date: string;
      }>;
      pagination: { next: string; has_more: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(10);
    expect(body.data[0]).toEqual({
      id: "inv_00001",
      department: expect.any(String),
      payer: expect.any(String),
      insurance_type: expect.stringMatching(/^(STATUTORY|PRIVATE)$/),
      amount: expect.any(Number),
      status: expect.stringMatching(/^(PAID|OPEN|OVERDUE)$/),
      issued_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(body.pagination.has_more).toBe(true);
    expect(body.pagination.next).toContain("/v1/financial/invoices?");
  });

  test("returns operational alerts and staffing", async () => {
    await request("/v1/database-seeds", { method: "POST" });

    const alertsResponse = await request("/v1/ops/alerts");
    const alertsBody = (await alertsResponse.json()) as {
      data: Array<{
        id: string;
        severity: string;
        category: string;
        message: string;
        department: string;
        created_at: string;
      }>;
    };
    const staffingResponse = await request("/v1/ops/staffing");
    const staffingBody = (await staffingResponse.json()) as {
      data: Array<{
        department: string;
        on_shift: number;
        on_call: number;
        total: number;
      }>;
    };

    expect(alertsResponse.status).toBe(200);
    expect(alertsBody.data.length).toBeGreaterThan(0);
    expect(alertsBody.data.map((alert) => alert.severity)).toEqual(
      expect.arrayContaining(["INFO", "WARNING", "CRITICAL"]),
    );
    expect(staffingResponse.status).toBe(200);
    expect(staffingBody.data).toHaveLength(34);
    expect(
      staffingBody.data.every((row) => row.on_shift + row.on_call <= row.total),
    ).toBe(true);
    // Proves the Part B scale fix: per-department totals are computed via a
    // SQL GROUP BY over ALL 1,000 seeded employees, not a capped 100-row
    // sample, so they sum to the true total employee count.
    expect(
      staffingBody.data.reduce((sum, row) => sum + row.total, 0),
    ).toBe(1_000);
  });

  test("returns aggregate ops summary KPIs computed via SQL", async () => {
    await request("/v1/database-seeds", { method: "POST" });

    const response = await request("/v1/ops/summary?date=2026-07-10");
    const body = (await response.json()) as {
      data: {
        beds: {
          total: number;
          free: number;
          reserved: number;
          occupied: number;
          occupancy_pct: number;
        };
        capacity: { current: number; max: number; pct: number };
        visits: {
          active: number;
          active_inpatient: number;
          active_outpatient: number;
          discharged: number;
        };
        patients: { total: number };
        employees: { total: number };
        departments: { total: number };
        wards: { total: number };
        appointments_on_date: number;
      };
    };

    expect(response.status).toBe(200);

    const { beds, capacity, visits, patients, employees, departments, wards } =
      body.data;

    // Internal consistency, independent of the exact seeded scale.
    expect(beds.total).toBe(beds.free + beds.reserved + beds.occupied);
    expect(beds.occupied).toBe(visits.active_inpatient);
    expect(visits.active).toBe(
      visits.active_inpatient + visits.active_outpatient,
    );
    expect(beds.occupancy_pct).toBe(
      Math.round((beds.occupied / beds.total) * 1_000) / 10,
    );
    expect(capacity.pct).toBe(
      Math.round((capacity.current / capacity.max) * 1_000) / 10,
    );

    // Matches the deterministic seed scale (see task-5-brief.md context).
    expect(patients.total).toBe(64_324);
    expect(employees.total).toBe(1_000);
    expect(departments.total).toBe(34);
    expect(wards.total).toBe(400);
    expect(visits.active_inpatient).toBe(9_269);
    expect(visits.active_outpatient).toBe(3_971);
    expect(visits.discharged).toBe(6_000);
    expect(body.data.appointments_on_date).toBeGreaterThan(0);

    // Proves the `date` filter's WHERE clause actually runs: the single-date
    // count must be strictly less than the count over all 5,000 seeded
    // appointments (spread across many dates), not just "some positive number".
    const undatedResponse = await request("/v1/ops/summary");
    const undatedBody = (await undatedResponse.json()) as {
      data: { appointments_on_date: number };
    };

    expect(undatedResponse.status).toBe(200);
    expect(body.data.appointments_on_date).toBeLessThan(
      undatedBody.data.appointments_on_date,
    );
  });

  test("rejects unsupported ops summary query parameters", async () => {
    const response = await request("/v1/ops/summary?timezone=UTC");
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("timezone"),
      instance: "/v1/ops/summary",
    });
  });

  test("rejects malformed ops summary date query parameter", async () => {
    const response = await request("/v1/ops/summary?date=07-10-2026");
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("date"),
      instance: "/v1/ops/summary",
    });
  });

  test("groups floors by building and level with SQL-computed bed rollups", async () => {
    const department = await createDepartment({
      name: "Floor Test Department",
      current_capacity: 10,
      max_capacity: 20,
    });
    const building = "Test Haus – Floor Nav";

    const wardOne = await createStationAt(department.id, {
      name: "Station Floor Nav A",
      building,
      floor: 2,
    });
    const wardTwo = await createStationAt(department.id, {
      name: "Station Floor Nav B",
      building,
      floor: 2,
    });
    // Different floor within the same building -> must be a separate entry.
    await createStationAt(department.id, {
      name: "Station Floor Nav C",
      building,
      floor: 3,
    });

    const normalRoom = await createRoom(department.id, wardOne.id);
    const occupiedBed = await createBed(
      department.id,
      wardOne.id,
      normalRoom.id,
      "OCCUPIED",
    );
    await createBed(department.id, wardOne.id, normalRoom.id, "FREE");
    await createBed(department.id, wardTwo.id, null, "FREE");

    const patient = await createPatient();
    await createPatientVisit({
      patient_number: "91001",
      visit_type: "INPATIENT",
      status: "ACTIVE",
      patient_id: patient.id,
      department_id: department.id,
      station_id: wardOne.id,
      room_id: normalRoom.id,
      bed_id: occupiedBed.id,
      started_date: "2026-07-10",
      started_time: "08:00",
    });

    const response = await request("/v1/ops/floors");
    const body = (await response.json()) as {
      data: Array<{
        building: string;
        level: number;
        label: string;
        ward_count: number;
        bed_total: number;
        occupied: number;
        occupancy_pct: number;
      }>;
    };

    expect(response.status).toBe(200);

    const floorOne = body.data.find(
      (row) => row.building === building && row.level === 1,
    );
    const floorTwo = body.data.find(
      (row) => row.building === building && row.level === 2,
    );

    expect(floorOne).toEqual({
      building,
      level: 1,
      label: "1. OG",
      ward_count: 2,
      bed_total: 3,
      occupied: 1,
      occupancy_pct: 33.3,
    });
    expect(floorTwo).toEqual({
      building,
      level: 2,
      label: "2. OG",
      ward_count: 1,
      bed_total: 0,
      occupied: 0,
      occupancy_pct: 0,
    });
  });

  test("returns a floor's wards, rooms, and beds with occupant patient for floor detail", async () => {
    const department = await createDepartment({
      name: "Floor Detail Department",
      current_capacity: 10,
      max_capacity: 20,
    });
    const building = "Test Haus – Floor Detail";

    const ward = await createStationAt(department.id, {
      name: "Station Floor Detail A",
      building,
      floor: 4,
    });
    const otherWard = await createStationAt(department.id, {
      name: "Station Floor Detail B",
      building,
      floor: 4,
    });
    // Different building/floor - must not leak into the response below.
    await createStationAt(department.id, {
      name: "Station Floor Detail Elsewhere",
      building: "Other Haus",
      floor: 4,
    });

    const normalRoom = await createRoom(department.id, ward.id);
    const secretariat = await createRoomWithType(
      department.id,
      ward.id,
      "Stationszimmer Detail",
      "SECRETARIAT",
    );
    const occupiedBed = await createBed(
      department.id,
      ward.id,
      normalRoom.id,
      "OCCUPIED",
    );
    const freeBed = await createBed(department.id, ward.id, normalRoom.id, "FREE");

    const patient = await createPatient();
    await createPatientVisit({
      patient_number: "91002",
      visit_type: "INPATIENT",
      status: "ACTIVE",
      patient_id: patient.id,
      department_id: department.id,
      station_id: ward.id,
      room_id: normalRoom.id,
      bed_id: occupiedBed.id,
      started_date: "2026-07-10",
      started_time: "08:00",
    });

    const response = await request(
      `/v1/ops/floors/detail?building=${encodeURIComponent(building)}&level=3`,
    );
    const body = (await response.json()) as {
      data: {
        building: string;
        level: number;
        label: string;
        wards: Array<{
          id: string;
          name: string;
          station_type: string;
          department: string;
          rooms: Array<{
            id: string;
            name: string;
            room_type: string;
            bed_capacity: number;
            current_capacity: number;
            beds: Array<{
              id: string;
              status: string;
              room: string;
              patient?: {
                first_name: string;
                last_name: string;
                patient_number: string;
              };
            }>;
          }>;
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.data.building).toBe(building);
    expect(body.data.level).toBe(3);
    expect(body.data.label).toBe("3. OG");
    expect(body.data.wards.map((row) => row.id).sort()).toEqual(
      [ward.id, otherWard.id].sort(),
    );

    const wardData = body.data.wards.find((row) => row.id === ward.id);
    expect(wardData?.department).toBe(department.name);

    const secretariatRoom = wardData?.rooms.find(
      (room) => room.id === secretariat.id,
    );
    expect(secretariatRoom).toEqual({
      id: secretariat.id,
      name: "Stationszimmer Detail",
      room_type: "SECRETARIAT",
      bed_capacity: 0,
      current_capacity: 0,
      beds: [],
    });

    const patientRoom = wardData?.rooms.find((room) => room.id === normalRoom.id);
    expect(patientRoom?.bed_capacity).toBe(2);
    expect(patientRoom?.current_capacity).toBe(1);

    const occupiedBedData = patientRoom?.beds.find(
      (bed) => bed.id === occupiedBed.id,
    );
    expect(occupiedBedData).toEqual({
      id: occupiedBed.id,
      status: "OCCUPIED",
      room: normalRoom.name,
      patient: {
        first_name: "Ada",
        last_name: "Lovelace",
        patient_number: "91002",
      },
    });

    const freeBedData = patientRoom?.beds.find((bed) => bed.id === freeBed.id);
    expect(freeBedData).toEqual({
      id: freeBed.id,
      status: "FREE",
      room: normalRoom.name,
    });
  });

  test("returns 404 for a floor with no matching wards", async () => {
    const response = await request(
      "/v1/ops/floors/detail?building=Nonexistent%20Haus&level=0",
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Floor was not found",
      instance: "/v1/ops/floors/detail",
    });
  });

  test("rejects unsupported floor query parameters", async () => {
    const floorsResponse = await request("/v1/ops/floors?wing=A");
    const floorsBody = await floorsResponse.json();

    expect(floorsResponse.status).toBe(422);
    expect(floorsBody).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("wing"),
      instance: "/v1/ops/floors",
    });

    const detailResponse = await request(
      "/v1/ops/floors/detail?building=Haus%201&level=0&wing=A",
    );
    const detailBody = await detailResponse.json();

    expect(detailResponse.status).toBe(422);
    expect(detailBody).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("wing"),
      instance: "/v1/ops/floors/detail",
    });

    const missingLevelResponse = await request(
      "/v1/ops/floors/detail?building=Haus%201",
    );
    expect(missingLevelResponse.status).toBe(422);
  });

  test("rejects a non-integer level for floor detail", async () => {
    const response = await request(
      "/v1/ops/floors/detail?building=Haus%201&level=abc",
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("level"),
      instance: "/v1/ops/floors/detail",
    });
  });

  test("creates patients linked to an existing social security number", async () => {
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
        telephone_number: "+4917012345",
        accepted_gdpr: true,
      }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toMatch(
      /^\/v1\/patients\/pat_[A-Za-z0-9]{12}$/,
    );

    const body = (await response.json()) as {
      data: Record<string, unknown>;
    };

    expect(body.data).toEqual({
      id: expect.stringMatching(/^pat_[A-Za-z0-9]{12}$/),
      gender: "FEMALE",
      first_name: "Ada",
      last_name: "Lovelace",
      birth_date: "1815-12-10",
      birthplace: "London",
      social_security_number: socialSecurityNumber,
      telephone_number: "+4917012345",
      accepted_gdpr: true,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
    expect(body.data).not.toHaveProperty("accepted_dsgvo");
  });

  test("lists patients with cursor pagination envelope", async () => {
    const socialSecurityNumber = await createSocialSecurityNumber();

    await request("/v1/patients", {
      method: "POST",
      body: JSON.stringify({
        gender: "UNKNOWN",
        first_name: "Grace",
        last_name: "Hopper",
        birth_date: "1906-12-09",
        birthplace: "New York City",
        social_security_number_id: socialSecurityNumber.id,
        telephone_number: "+491701111111",
        accepted_gdpr: true,
      }),
    });

    const response = await request("/v1/patients?page_size=20");
    const body = (await response.json()) as {
      data: unknown[];
      pagination: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({
      self: "/v1/patients?page_size=20",
      has_more: false,
    });
  });

  test("uses the last returned row as the next cursor", async () => {
    const firstSocialSecurityNumber = await createSocialSecurityNumber();
    const secondSocialSecurityNumber = await createSocialSecurityNumber();

    await request("/v1/patients", {
      method: "POST",
      body: JSON.stringify({
        gender: "UNKNOWN",
        first_name: "Grace",
        last_name: "Hopper",
        birth_date: "1906-12-09",
        birthplace: "New York City",
        social_security_number_id: firstSocialSecurityNumber.id,
        telephone_number: "+491701111111",
        accepted_gdpr: true,
      }),
    });

    await request("/v1/patients", {
      method: "POST",
      body: JSON.stringify({
        gender: "FEMALE",
        first_name: "Katherine",
        last_name: "Johnson",
        birth_date: "1918-08-26",
        birthplace: "White Sulphur Springs",
        social_security_number_id: secondSocialSecurityNumber.id,
        telephone_number: "+4917022222",
        accepted_gdpr: true,
      }),
    });

    const firstPageResponse = await request("/v1/patients?page_size=1");
    const firstPage = (await firstPageResponse.json()) as {
      data: Array<{ first_name: string }>;
      pagination: { next: string; has_more: boolean };
    };

    expect(firstPage.data.map((patient) => patient.first_name)).toEqual([
      "Grace",
    ]);
    expect(firstPage.pagination.has_more).toBe(true);

    const secondPageResponse = await request(firstPage.pagination.next);
    const secondPage = (await secondPageResponse.json()) as {
      data: Array<{ first_name: string }>;
      pagination: { has_more: boolean };
    };

    expect(secondPage.data.map((patient) => patient.first_name)).toEqual([
      "Katherine",
    ]);
    expect(secondPage.pagination.has_more).toBe(false);
  });

  test("returns problem details for invalid enum values", async () => {
    const response = await request("/v1/social-security-numbers", {
      method: "POST",
      body: JSON.stringify({
        number: "A1234589",
        health_insurance_provider: "Techniker Krankenkasse",
        insurance_type: "gesetzlich",
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("insurance_type"),
      instance: "/v1/social-security-numbers",
    });
  });

  test("returns problem details when a patient does not exist", async () => {
    const response = await request("/v1/patients/pat_abc123ABC456");
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Patient was not found",
      instance: "/v1/patients/pat_abc123ABC456",
    });
  });

  test("creates departments without comparing current and max capacity", async () => {
    const response = await request("/v1/departments", {
      method: "POST",
      body: JSON.stringify({
        name: "Cardiology",
        current_capacity: 42,
        max_capacity: 12,
      }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toMatch(
      /^\/v1\/departments\/dep_[A-Za-z0-9]{12}$/,
    );

    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body).toEqual({
      data: {
        id: expect.stringMatching(/^dep_[A-Za-z0-9]{12}$/),
        name: "Cardiology",
        current_capacity: 42,
        max_capacity: 12,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      },
    });
    expect(body.data).not.toHaveProperty("internal_id");
  });

  test("rejects unknown department request fields", async () => {
    const response = await request("/v1/departments", {
      method: "POST",
      body: JSON.stringify({
        name: "Cardiology",
        current_capacity: 42,
        max_capacity: 12,
        timezone: "UTC",
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("timezone"),
      instance: "/v1/departments",
    });
  });

  test("rejects unsupported department create query parameters", async () => {
    const response = await request("/v1/departments?timezone=UTC", {
      method: "POST",
      body: JSON.stringify({
        name: "Cardiology",
        current_capacity: 42,
        max_capacity: 12,
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("timezone"),
      instance: "/v1/departments",
    });
  });

  test("reads departments by public id", async () => {
    const department = await createDepartment();

    const response = await request(`/v1/departments/${department.id}`);
    const body = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(department.id);
  });

  test("rejects unsupported department read query parameters", async () => {
    const department = await createDepartment();

    const response = await request(`/v1/departments/${department.id}?timezone=UTC`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("timezone"),
      instance: `/v1/departments/${department.id}`,
    });
  });

  test("lists departments with cursor pagination", async () => {
    await createDepartment({
      name: "Cardiology",
      current_capacity: 1,
      max_capacity: 2,
    });

    const response = await request("/v1/departments?page_size=20");
    const body = (await response.json()) as {
      data: unknown[];
      pagination: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({
      self: "/v1/departments?page_size=20",
      has_more: false,
    });
  });

  test("rejects unsupported department list query parameters", async () => {
    const response = await request("/v1/departments?timezone=UTC");
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("timezone"),
      instance: "/v1/departments",
    });
  });

  test("uses public cursor state when listing departments", async () => {
    const firstDepartment = await createDepartment({
      name: "Cardiology",
      current_capacity: 1,
      max_capacity: 2,
    });
    const secondDepartment = await createDepartment({
      name: "Oncology",
      current_capacity: 3,
      max_capacity: 4,
    });

    const firstPageResponse = await request("/v1/departments?page_size=1");
    const firstPage = (await firstPageResponse.json()) as {
      data: Array<{ id: string; name: string }>;
      pagination: { next: string; has_more: boolean };
    };

    expect(firstPage.data.map((department) => department.name)).toEqual([
      firstDepartment.name,
    ]);
    expect(firstPage.pagination.has_more).toBe(true);

    const cursorPayload = decodeCursorFromNext(firstPage.pagination.next);
    expect(cursorPayload).toEqual({ public_id: firstDepartment.id });
    expect(cursorPayload).not.toHaveProperty("id");

    const secondPageResponse = await request(firstPage.pagination.next);
    const secondPage = (await secondPageResponse.json()) as {
      data: Array<{ id: string; name: string }>;
      pagination: { has_more: boolean };
    };

    expect(secondPage.data).toEqual([
      expect.objectContaining({
        id: secondDepartment.id,
        name: secondDepartment.name,
      }),
    ]);
    expect(secondPage.pagination.has_more).toBe(false);
  });

  test("creates stations linked directly to departments", async () => {
    const department = await createDepartment();

    const response = await request("/v1/stations", {
      method: "POST",
      body: JSON.stringify({
        name: "Normalstation 2",
        station_type: "NORMAL",
        department_id: department.id,
      }),
    });
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toMatch(
      /^\/v1\/stations\/sta_[A-Za-z0-9]{12}$/,
    );
    expect(body.data).toEqual({
      id: expect.stringMatching(/^sta_[A-Za-z0-9]{12}$/),
      name: "Normalstation 2",
      station_type: "NORMAL",
      department: department.name,
      building: "Haus 1",
      floor: 0,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  test("station response includes building and floor", async () => {
    const department = await createDepartment();
    const station = await createStation(department.id);
    const res = await request(`/v1/stations/${station.id}`);
    const body = (await res.json()) as {
      data: { building: string; floor: number };
    };

    expect(res.status).toBe(200);
    expect(typeof body.data.building).toBe("string");
    expect(typeof body.data.floor).toBe("number");
  });

  test("creates rooms linked to stations and returns calculated capacities", async () => {
    const department = await createDepartment();
    const station = await createStation(department.id);
    const room = await createRoom(department.id, station.id);

    await createBed(department.id, station.id, room.id, "FREE");
    await createBed(department.id, station.id, room.id, "RESERVED");
    await createBed(department.id, station.id, room.id, "OCCUPIED");

    const response = await request(`/v1/rooms/${room.id}`);
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      id: room.id,
      name: "Zimmer 101",
      room_type: "SINGLE_ROOM_STANDARD",
      bed_capacity: 3,
      current_capacity: 1,
      department: department.name,
      station: station.name,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  test("creates beds with optional room assignment", async () => {
    const department = await createDepartment();
    const station = await createStation(department.id);

    const response = await request("/v1/beds", {
      method: "POST",
      body: JSON.stringify({
        bed_type: "STANDARD",
        status: "FREE",
        material: "BARIATRIC",
        department_id: department.id,
        station_id: station.id,
        room_id: null,
      }),
    });
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toMatch(
      /^\/v1\/beds\/bed_[A-Za-z0-9]{12}$/,
    );
    expect(body.data).toEqual({
      id: expect.stringMatching(/^bed_[A-Za-z0-9]{12}$/),
      bed_type: "STANDARD",
      status: "FREE",
      material: "BARIATRIC",
      department: department.name,
      station: station.name,
      room: null,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  test("creates inpatient patient visits with station room and bed context", async () => {
    const department = await createDepartment();
    const station = await createStation(department.id);
    const room = await createRoom(department.id, station.id);
    const bed = await createBed(department.id, station.id, room.id);
    const patient = await createPatient();

    const response = await request("/v1/patient-visits", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "12345",
        visit_type: "INPATIENT",
        status: "ACTIVE",
        patient_id: patient.id,
        department_id: department.id,
        station_id: station.id,
        room_id: room.id,
        bed_id: bed.id,
        started_date: "2026-07-10",
        started_time: "08:15",
      }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toMatch(
      /^\/v1\/patient-visits\/pvi_[A-Za-z0-9]{12}$/,
    );

    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body).toEqual({
      data: {
        id: expect.stringMatching(/^pvi_[A-Za-z0-9]{12}$/),
        patient_number: "12345",
        visit_type: "INPATIENT",
        status: "ACTIVE",
        patient: {
          id: patient.id,
          first_name: "Ada",
          last_name: "Lovelace",
          birth_date: "1815-12-10",
        },
        department: "Cardiology",
        station: "Intensivstation 1",
        room: "Zimmer 101",
        bed: bed.id,
        started_date: "2026-07-10",
        started_time: "08:15",
        ended_date: null,
        ended_time: null,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      },
    });
  });

  test("rejects patient visit numbers that are not five digits", async () => {
    const department = await createDepartment();
    const patient = await createPatient();

    const response = await request("/v1/patient-visits", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "123456",
        visit_type: "OUTPATIENT",
        status: "ACTIVE",
        patient_id: patient.id,
        department_id: department.id,
        started_date: "2026-07-10",
        started_time: "08:15",
      }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      detail: "patient_number must be a 5 digit string",
      instance: "/v1/patient-visits",
    });
  });

  test("lists available movement beds by target department", async () => {
    const sourceDepartment = await createDepartment({ name: "Notaufnahme", current_capacity: 1, max_capacity: 4 });
    const targetDepartment = await createDepartment({ name: "Kardiologie", current_capacity: 2, max_capacity: 10 });
    const station = await createStation(targetDepartment.id);
    const room = await createRoom(targetDepartment.id, station.id);
    const freeBed = await createBed(targetDepartment.id, station.id, room.id, "FREE");
    await createBed(targetDepartment.id, station.id, room.id, "OCCUPIED");
    const patient = await createPatient();
    await createPatientVisit({
      patient_number: "12345",
      visit_type: "OUTPATIENT",
      status: "ACTIVE",
      patient_id: patient.id,
      department_id: sourceDepartment.id,
      started_date: "2026-07-10",
      started_time: "08:15",
    });

    const response = await request("/v1/patient-movements/available-beds", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "12345",
        target_department_id: targetDepartment.id,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        available_bed: true,
        available_rooms: [
          {
            id: room.id,
            name: "Zimmer 101",
            department: "Kardiologie",
            station: "Intensivstation 1",
            room_type: "SINGLE_ROOM_STANDARD",
            bed_capacity: 2,
            current_capacity: 1,
            available_beds: [
              {
                id: freeBed.id,
                bed_type: "INTENSIVE_CARE",
                material: "STANDARD",
              },
            ],
          },
        ],
      },
    });
  });

  test("reserves a target bed for a patient movement and frees the previous bed", async () => {
    const sourceDepartment = await createDepartment({ name: "Notaufnahme", current_capacity: 1, max_capacity: 4 });
    const sourceStation = await createStation(sourceDepartment.id);
    const sourceRoom = await createRoom(sourceDepartment.id, sourceStation.id);
    const sourceBed = await createBed(sourceDepartment.id, sourceStation.id, sourceRoom.id, "OCCUPIED");
    const targetDepartment = await createDepartment({ name: "Kardiologie", current_capacity: 2, max_capacity: 10 });
    const targetStation = await createStation(targetDepartment.id);
    const targetRoom = await createRoom(targetDepartment.id, targetStation.id);
    const targetBed = await createBed(targetDepartment.id, targetStation.id, targetRoom.id, "FREE");
    const patient = await createPatient();
    await createPatientVisit({
      patient_number: "23456",
      visit_type: "INPATIENT",
      status: "ACTIVE",
      patient_id: patient.id,
      department_id: sourceDepartment.id,
      station_id: sourceStation.id,
      room_id: sourceRoom.id,
      bed_id: sourceBed.id,
      started_date: "2026-07-10",
      started_time: "08:15",
    });

    const response = await request("/v1/patient-movements", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "23456",
        target_bed_id: targetBed.id,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        patient_number: "23456",
        from_bed_id: sourceBed.id,
        target_bed_id: targetBed.id,
        target_bed_status: "RESERVED",
        patient_visit: {
          department: "Kardiologie",
          station: "Intensivstation 1",
          room: "Zimmer 101",
          bed: targetBed.id,
        },
      },
    });

    const sourceBedResponse = await request(`/v1/beds/${sourceBed.id}`);
    const sourceBedBody = (await sourceBedResponse.json()) as { data: { status: string } };
    expect(sourceBedBody.data.status).toBe("FREE");

    const targetBedResponse = await request(`/v1/beds/${targetBed.id}`);
    const targetBedBody = (await targetBedResponse.json()) as { data: { status: string } };
    expect(targetBedBody.data.status).toBe("RESERVED");
  });

  test("completes a patient movement and marks the reserved bed occupied", async () => {
    const sourceDepartment = await createDepartment({ name: "Notaufnahme", current_capacity: 1, max_capacity: 4 });
    const targetDepartment = await createDepartment({ name: "Kardiologie", current_capacity: 2, max_capacity: 10 });
    const targetStation = await createStation(targetDepartment.id);
    const targetRoom = await createRoom(targetDepartment.id, targetStation.id);
    const targetBed = await createBed(targetDepartment.id, targetStation.id, targetRoom.id, "FREE");
    const patient = await createPatient();
    await createPatientVisit({
      patient_number: "34567",
      visit_type: "OUTPATIENT",
      status: "ACTIVE",
      patient_id: patient.id,
      department_id: sourceDepartment.id,
      started_date: "2026-07-10",
      started_time: "08:15",
    });
    await request("/v1/patient-movements", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "34567",
        target_bed_id: targetBed.id,
      }),
    });

    const response = await request("/v1/patient-movements/completions", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "34567",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        patient_number: "34567",
        bed_id: targetBed.id,
        bed_status: "OCCUPIED",
      },
    });

    const targetBedResponse = await request(`/v1/beds/${targetBed.id}`);
    const targetBedBody = (await targetBedResponse.json()) as { data: { status: string } };
    expect(targetBedBody.data.status).toBe("OCCUPIED");
  });

  test("creates outpatient patient visits with only a department location", async () => {
    const department = await createDepartment({
      name: "Geriatrie",
      current_capacity: 18,
      max_capacity: 40,
    });
    const patient = await createPatient();

    const response = await request("/v1/patient-visits", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "76543",
        visit_type: "OUTPATIENT",
        status: "DISCHARGED",
        patient_id: patient.id,
        department_id: department.id,
        started_date: "2026-07-09",
        started_time: "10:00",
        ended_date: "2026-07-09",
        ended_time: "12:30",
      }),
    });

    expect(response.status).toBe(201);

    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      patient_number: "76543",
      visit_type: "OUTPATIENT",
      status: "DISCHARGED",
      department: "Geriatrie",
      station: null,
      room: null,
      bed: null,
      ended_date: "2026-07-09",
      ended_time: "12:30",
    });
  });

  test("rejects inpatient patient visits missing station room or bed context", async () => {
    const department = await createDepartment();
    const station = await createStation(department.id);
    const patient = await createPatient();

    const response = await request("/v1/patient-visits", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "22222",
        visit_type: "INPATIENT",
        status: "ACTIVE",
        patient_id: patient.id,
        department_id: department.id,
        station_id: station.id,
        started_date: "2026-07-10",
        started_time: "08:15",
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(422);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: "INPATIENT visits must include station_id, room_id, and bed_id",
      instance: "/v1/patient-visits",
    });
  });

  test("rejects outpatient patient visits with station or room data", async () => {
    const department = await createDepartment();
    const station = await createStation(department.id);
    const patient = await createPatient();

    const response = await request("/v1/patient-visits", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "22223",
        visit_type: "OUTPATIENT",
        status: "ACTIVE",
        patient_id: patient.id,
        department_id: department.id,
        station_id: station.id,
        started_date: "2026-07-10",
        started_time: "08:15",
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(422);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: "OUTPATIENT visits must not include station_id, room_id, or bed_id",
      instance: "/v1/patient-visits",
    });
  });

  test("rejects patient visits with partial station room bed context", async () => {
    const department = await createDepartment();
    const station = await createStation(department.id);
    const room = await createRoom(department.id, station.id);
    const bed = await createBed(department.id, station.id, room.id);
    const patient = await createPatient();

    const roomWithoutStation = await request("/v1/patient-visits", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "23232",
        visit_type: "OUTPATIENT",
        status: "ACTIVE",
        patient_id: patient.id,
        department_id: department.id,
        room_id: room.id,
        started_date: "2026-07-10",
        started_time: "08:15",
      }),
    });

    expect(roomWithoutStation.status).toBe(422);
    expect(await roomWithoutStation.json()).toMatchObject({
      detail: "room_id requires station_id",
      instance: "/v1/patient-visits",
    });

    const bedWithoutRoom = await request("/v1/patient-visits", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "24242",
        visit_type: "OUTPATIENT",
        status: "ACTIVE",
        patient_id: patient.id,
        department_id: department.id,
        station_id: station.id,
        bed_id: bed.id,
        started_date: "2026-07-10",
        started_time: "09:15",
      }),
    });

    expect(bedWithoutRoom.status).toBe(422);
    expect(await bedWithoutRoom.json()).toMatchObject({
      detail: "bed_id requires station_id and room_id",
      instance: "/v1/patient-visits",
    });
  });

  test("enforces active patient visit numbers only among active visits", async () => {
    const department = await createDepartment();
    const firstPatient = await createPatientWithInsuranceNumber("PV-ACTIVE-1");
    const secondPatient = await createPatientWithInsuranceNumber("PV-ACTIVE-2");
    const thirdPatient = await createPatientWithInsuranceNumber("PV-ACTIVE-3");

    await createPatientVisit({
      patient_number: "33333",
      visit_type: "OUTPATIENT",
      status: "ACTIVE",
      patient_id: firstPatient.id,
      department_id: department.id,
      started_date: "2026-07-10",
      started_time: "08:15",
    });

    await createPatientVisit({
      patient_number: "44444",
      visit_type: "OUTPATIENT",
      status: "DISCHARGED",
      patient_id: secondPatient.id,
      department_id: department.id,
      started_date: "2026-07-08",
      started_time: "08:15",
      ended_date: "2026-07-09",
      ended_time: "14:00",
    });

    const duplicateActiveResponse = await request("/v1/patient-visits", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "33333",
        visit_type: "OUTPATIENT",
        status: "ACTIVE",
        patient_id: thirdPatient.id,
        department_id: department.id,
        started_date: "2026-07-10",
        started_time: "09:15",
      }),
    });

    expect(duplicateActiveResponse.status).toBe(409);

    const reusedDischargedNumber = await request("/v1/patient-visits", {
      method: "POST",
      body: JSON.stringify({
        patient_number: "44444",
        visit_type: "OUTPATIENT",
        status: "ACTIVE",
        patient_id: thirdPatient.id,
        department_id: department.id,
        started_date: "2026-07-10",
        started_time: "10:15",
      }),
    });

    expect(reusedDischargedNumber.status).toBe(201);
  });

  test("reads and lists patient visits with cursor pagination", async () => {
    const department = await createDepartment();
    const firstPatient = await createPatientWithInsuranceNumber("PV-LIST-1");
    const secondPatient = await createPatientWithInsuranceNumber("PV-LIST-2");

    const firstVisit = await createPatientVisit({
      patient_number: "55555",
      visit_type: "OUTPATIENT",
      status: "ACTIVE",
      patient_id: firstPatient.id,
      department_id: department.id,
      started_date: "2026-07-10",
      started_time: "08:15",
    });
    await createPatientVisit({
      patient_number: "66666",
      visit_type: "OUTPATIENT",
      status: "ACTIVE",
      patient_id: secondPatient.id,
      department_id: department.id,
      started_date: "2026-07-10",
      started_time: "09:15",
    });

    const readResponse = await request(`/v1/patient-visits/${firstVisit.id}`);
    const readBody = (await readResponse.json()) as {
      data: { id: string; patient_number: string };
    };

    expect(readResponse.status).toBe(200);
    expect(readBody.data.id).toBe(firstVisit.id);
    expect(readBody.data.patient_number).toBe("55555");

    const listResponse = await request("/v1/patient-visits?page_size=1");
    const listBody = (await listResponse.json()) as {
      data: Array<{ patient_number: string }>;
      pagination: { next: string; has_more: boolean };
    };

    expect(listResponse.status).toBe(200);
    expect(listBody.data.map((visit) => visit.patient_number)).toEqual([
      "55555",
    ]);
    expect(listBody.pagination.has_more).toBe(true);
  });

  test("returns problem details when bed room does not belong to the station", async () => {
    const department = await createDepartment();
    const firstStation = await createStation(department.id);
    const secondStationResponse = await request("/v1/stations", {
      method: "POST",
      body: JSON.stringify({
        name: "Normalstation 3",
        station_type: "NORMAL",
        department_id: department.id,
      }),
    });
    const secondStation = ((await secondStationResponse.json()) as {
      data: { id: string };
    }).data;
    const room = await createRoom(department.id, firstStation.id);

    const response = await request("/v1/beds", {
      method: "POST",
      body: JSON.stringify({
        bed_type: "STANDARD",
        status: "FREE",
        material: "STANDARD",
        department_id: department.id,
        station_id: secondStation.id,
        room_id: room.id,
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: "Room must belong to the provided department and station",
      instance: "/v1/beds",
    });
  });

  test("creates employees linked to departments", async () => {
    const department = await createDepartment();

    const response = await request("/v1/employees", {
      method: "POST",
      body: JSON.stringify({
        first_name: "Maya",
        last_name: "Singh",
        position: "CARDIOLOGIST",
        department_id: department.id,
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
      department: department.name,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
    expect(body.data).not.toHaveProperty("department_id");
    expect(body.data).not.toHaveProperty("internal_id");
  });

  test("reads employees by public id", async () => {
    const department = await createDepartment();
    const employee = await createEmployee(department.id);

    const response = await request(`/v1/employees/${employee.id}`);
    const body = (await response.json()) as {
      data: { id: string; department: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(employee.id);
    expect(body.data.department).toBe(department.name);
  });

  test("lists employees with cursor pagination", async () => {
    const department = await createDepartment();
    await createEmployee(department.id);

    const response = await request("/v1/employees?page_size=20");
    const body = (await response.json()) as {
      data: Array<{ department: string }>;
      pagination: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.department).toBe(department.name);
    expect(body.pagination).toEqual({
      self: "/v1/employees?page_size=20",
      has_more: false,
    });
  });

  test("returns problem details when employee department does not exist", async () => {
    const response = await request("/v1/employees", {
      method: "POST",
      body: JSON.stringify({
        first_name: "Maya",
        last_name: "Singh",
        position: "CARDIOLOGIST",
        department_id: "dep_abc123ABC456",
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Department was not found",
      instance: "/v1/employees",
    });
  });

  test("creates appointment types linked to departments", async () => {
    const department = await createDepartment();

    const response = await request("/v1/appointment-types", {
      method: "POST",
      body: JSON.stringify({
        name: "Initial Consultation",
        department_id: department.id,
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
      department: department.name,
      default_duration_minutes: 30,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
    expect(body.data).not.toHaveProperty("department_id");
    expect(body.data).not.toHaveProperty("internal_id");
  });

  test("reads appointment types by public id", async () => {
    const department = await createDepartment();
    const appointmentType = await createAppointmentType(department.id);

    const response = await request(
      `/v1/appointment-types/${appointmentType.id}`,
    );
    const body = (await response.json()) as {
      data: { id: string; department: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(appointmentType.id);
    expect(body.data.department).toBe(department.name);
  });

  test("lists appointment types with cursor pagination", async () => {
    const department = await createDepartment();
    await createAppointmentType(department.id);

    const response = await request("/v1/appointment-types?page_size=20");
    const body = (await response.json()) as {
      data: Array<{ department: string }>;
      pagination: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.department).toBe(department.name);
    expect(body.pagination).toEqual({
      self: "/v1/appointment-types?page_size=20",
      has_more: false,
    });
  });

  test("filters appointment types by department_id", async () => {
    const cardiology = await createDepartment();
    const radiology = await createDepartment({
      name: "Radiology",
      current_capacity: 10,
      max_capacity: 20,
    });
    const cardiologyType = await createAppointmentType(cardiology.id);
    await createAppointmentType(radiology.id);

    const response = await request(
      `/v1/appointment-types?page_size=20&department_id=${cardiology.id}`,
    );
    const body = (await response.json()) as {
      data: Array<{ id: string; department: string }>;
      pagination: { self: string; has_more: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.id).toBe(cardiologyType.id);
    expect(body.data[0]?.department).toBe(cardiology.name);
    expect(body.pagination.self).toBe(
      `/v1/appointment-types?page_size=20&department_id=${cardiology.id}`,
    );
  });

  test("returns problem details when filtering by a department that does not exist", async () => {
    const response = await request(
      "/v1/appointment-types?department_id=dep_abc123ABC456",
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Department was not found",
      instance: "/v1/appointment-types",
    });
  });

  test("returns problem details when appointment type department does not exist", async () => {
    const response = await request("/v1/appointment-types", {
      method: "POST",
      body: JSON.stringify({
        name: "Initial Consultation",
        department_id: "dep_abc123ABC456",
        default_duration_minutes: 30,
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Department was not found",
      instance: "/v1/appointment-types",
    });
  });

  test("returns problem details for invalid appointment type duration", async () => {
    const department = await createDepartment();

    const response = await request("/v1/appointment-types", {
      method: "POST",
      body: JSON.stringify({
        name: "Initial Consultation",
        department_id: department.id,
        default_duration_minutes: 0,
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("default_duration_minutes"),
      instance: "/v1/appointment-types",
    });
  });

  test("lists available slots for an appointment type", async () => {
    const department = await createDepartment();
    const patient = await createPatient();
    const appointmentType = await createAppointmentType(department.id);
    await createAppointment(patient.id, appointmentType.id);

    const response = await request(
      `/v1/appointment-types/${appointmentType.id}/slots?start=2026-07-10T14:00&end=2026-07-10T15:30&limit=4`,
    );
    const body = (await response.json()) as {
      data: Array<{ scheduled_date: string; scheduled_time: string }>;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [
        {
          scheduled_date: "2026-07-10",
          scheduled_time: "14:00",
        },
        {
          scheduled_date: "2026-07-10",
          scheduled_time: "15:00",
        },
      ],
    });
  });

  test("returns problem details when slot search limit is too large", async () => {
    const department = await createDepartment();
    const appointmentType = await createAppointmentType(department.id);

    const response = await request(
      `/v1/appointment-types/${appointmentType.id}/slots?start=2026-07-10T08:00&end=2026-07-10T17:00&limit=501`,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("limit"),
      instance: `/v1/appointment-types/${appointmentType.id}/slots`,
    });
  });

  test("books appointments using insurance number and birth date", async () => {
    const department = await createDepartment();
    await createPatientWithInsuranceNumber("DESVBOOK-001", "1988-04-12");
    const appointmentType = await createAppointmentType(department.id);

    const response = await request("/v1/appointments/bookings", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVBOOK-001",
        birth_date: "1988-04-12",
        appointment_type_id: appointmentType.id,
        scheduled_date: "2026-07-10",
        scheduled_time: "09:30",
      }),
    });
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toMatch(
      /^\/v1\/appointments\/app_[A-Za-z0-9]{12}$/,
    );
    expect(body.data).toEqual({
      id: expect.stringMatching(/^app_[A-Za-z0-9]{12}$/),
      scheduled_date: "2026-07-10",
      scheduled_time: "09:30",
      patient: {
        id: expect.stringMatching(/^pat_[A-Za-z0-9]{12}$/),
      },
      appointment_type: {
        ...appointmentType,
        department: department.name,
      },
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  test("returns problem details when booking patient validation fails", async () => {
    const department = await createDepartment();
    const appointmentType = await createAppointmentType(department.id);

    const response = await request("/v1/appointments/bookings", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVMISSING",
        birth_date: "1988-04-12",
        appointment_type_id: appointmentType.id,
        scheduled_date: "2026-07-10",
        scheduled_time: "09:30",
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Patient was not found",
      instance: "/v1/appointments/bookings",
    });
  });

  test("returns problem details when booking an occupied slot", async () => {
    const department = await createDepartment();
    const patient = await createPatientWithInsuranceNumber(
      "DESVBOOK-002",
      "1988-04-12",
    );
    const appointmentType = await createAppointmentType(department.id);
    await createAppointment(patient.id, appointmentType.id);

    const response = await request("/v1/appointments/bookings", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVBOOK-002",
        birth_date: "1988-04-12",
        appointment_type_id: appointmentType.id,
        scheduled_date: "2026-07-10",
        scheduled_time: "14:30",
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/conflict",
      title: "Conflict",
      status: 409,
      detail: "Appointment slot is already booked",
      instance: "/v1/appointments/bookings",
    });
  });

  test("cancels appointments using insurance number and birth date", async () => {
    const department = await createDepartment();
    const patient = await createPatientWithInsuranceNumber(
      "DESVCANCEL-001",
      "1988-04-12",
    );
    const appointmentType = await createAppointmentType(department.id);
    const appointment = await createAppointment(patient.id, appointmentType.id);

    const response = await request("/v1/appointments/cancellations", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVCANCEL-001",
        birth_date: "1988-04-12",
        appointment_type_id: appointmentType.id,
        scheduled_date: "2026-07-10",
        scheduled_time: "14:30",
      }),
    });
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(body.data).toEqual({
      id: appointment.id,
      scheduled_date: "2026-07-10",
      scheduled_time: "14:30",
      patient: {
        id: patient.id,
      },
      appointment_type: appointmentType,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });

    const readResponse = await request(`/v1/appointments/${appointment.id}`);
    expect(readResponse.status).toBe(404);
  });

  test("returns problem details when cancel appointment is not found", async () => {
    const department = await createDepartment();
    await createPatientWithInsuranceNumber("DESVCANCEL-404", "1988-04-12");
    const appointmentType = await createAppointmentType(department.id);

    const response = await request("/v1/appointments/cancellations", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVCANCEL-404",
        birth_date: "1988-04-12",
        appointment_type_id: appointmentType.id,
        scheduled_date: "2026-07-10",
        scheduled_time: "14:30",
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Appointment was not found",
      instance: "/v1/appointments/cancellations",
    });
  });

  test("returns problem details when cancel patient validation fails", async () => {
    const department = await createDepartment();
    const appointmentType = await createAppointmentType(department.id);

    const response = await request("/v1/appointments/cancellations", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVCANCEL-MISSING",
        birth_date: "1988-04-12",
        appointment_type_id: appointmentType.id,
        scheduled_date: "2026-07-10",
        scheduled_time: "14:30",
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Patient was not found",
      instance: "/v1/appointments/cancellations",
    });
  });

  test("reschedules appointments using insurance number and birth date", async () => {
    const department = await createDepartment();
    const patient = await createPatientWithInsuranceNumber(
      "DESVRESCHEDULE-001",
      "1988-04-12",
    );
    const appointmentType = await createAppointmentType(department.id);
    const appointment = await createAppointment(patient.id, appointmentType.id);

    const response = await request("/v1/appointments/reschedules", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVRESCHEDULE-001",
        birth_date: "1988-04-12",
        appointment_type_id: appointmentType.id,
        from_scheduled_date: "2026-07-10",
        from_scheduled_time: "14:30",
        to_scheduled_date: "2026-07-10",
        to_scheduled_time: "15:00",
      }),
    });
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(
      `/v1/appointments/${appointment.id}`,
    );
    expect(body.data).toEqual({
      id: appointment.id,
      scheduled_date: "2026-07-10",
      scheduled_time: "15:00",
      patient: {
        id: patient.id,
      },
      appointment_type: appointmentType,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });

    const readResponse = await request(`/v1/appointments/${appointment.id}`);
    const readBody = (await readResponse.json()) as {
      data: { scheduled_time: string };
    };
    expect(readBody.data.scheduled_time).toBe("15:00");
  });

  test("returns problem details when reschedule target slot is occupied", async () => {
    const department = await createDepartment();
    const firstPatient = await createPatientWithInsuranceNumber(
      "DESVRESCHEDULE-409-A",
      "1988-04-12",
    );
    const secondPatient = await createPatientWithInsuranceNumber(
      "DESVRESCHEDULE-409-B",
      "1989-05-13",
    );
    const appointmentType = await createAppointmentType(department.id);
    await createAppointmentAt(firstPatient.id, appointmentType.id, {
      scheduled_date: "2026-07-10",
      scheduled_time: "14:30",
    });
    await createAppointmentAt(secondPatient.id, appointmentType.id, {
      scheduled_date: "2026-07-10",
      scheduled_time: "15:00",
    });

    const response = await request("/v1/appointments/reschedules", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVRESCHEDULE-409-A",
        birth_date: "1988-04-12",
        appointment_type_id: appointmentType.id,
        from_scheduled_date: "2026-07-10",
        from_scheduled_time: "14:30",
        to_scheduled_date: "2026-07-10",
        to_scheduled_time: "15:00",
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/conflict",
      title: "Conflict",
      status: 409,
      detail: "Appointment slot is already booked",
      instance: "/v1/appointments/reschedules",
    });
  });

  test("returns problem details when reschedule appointment is not found", async () => {
    const department = await createDepartment();
    await createPatientWithInsuranceNumber("DESVRESCHEDULE-404", "1988-04-12");
    const appointmentType = await createAppointmentType(department.id);

    const response = await request("/v1/appointments/reschedules", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVRESCHEDULE-404",
        birth_date: "1988-04-12",
        appointment_type_id: appointmentType.id,
        from_scheduled_date: "2026-07-10",
        from_scheduled_time: "14:30",
        to_scheduled_date: "2026-07-10",
        to_scheduled_time: "15:00",
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Appointment was not found",
      instance: "/v1/appointments/reschedules",
    });
  });

  test("lists patient appointments using insurance number and birth date", async () => {
    const department = await createDepartment({
      name: "Kardiologie",
      current_capacity: 12,
      max_capacity: 20,
    });
    await createEmployee(department.id);
    const patient = await createPatientWithInsuranceNumber(
      "DESVPATIENT-APPTS",
      "1988-04-12",
    );
    const appointmentType = await createAppointmentType(department.id);
    await createAppointmentAt(patient.id, appointmentType.id, {
      scheduled_date: "2026-07-10",
      scheduled_time: "14:30",
    });

    const response = await request("/v1/appointments/searches", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVPATIENT-APPTS",
        birth_date: "1988-04-12",
      }),
    });
    const body = (await response.json()) as {
      data: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [
        {
          employee: "Maya Singh",
          department: "Kardiologie",
          appointment_type: "Initial Consultation",
          scheduled_date: "2026-07-10",
          scheduled_time: "14:30",
        },
      ],
    });
  });

  test("returns problem details when patient appointment search validation fails", async () => {
    const response = await request("/v1/appointments/searches", {
      method: "POST",
      body: JSON.stringify({
        health_insurance_number: "DESVPATIENT-MISSING",
        birth_date: "1988-04-12",
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Patient was not found",
      instance: "/v1/appointments/searches",
    });
  });

  test("creates appointments linked to patients and appointment types", async () => {
    const department = await createDepartment();
    const patient = await createPatient();
    const appointmentType = await createAppointmentType(department.id);

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
    expect(body.data).not.toHaveProperty("linked_patient_id");
    expect(body.data).not.toHaveProperty("internal_id");
  });

  test("reads appointments by public id", async () => {
    const department = await createDepartment();
    const patient = await createPatient();
    const appointmentType = await createAppointmentType(department.id);
    const appointment = await createAppointment(patient.id, appointmentType.id);

    const response = await request(`/v1/appointments/${appointment.id}`);
    const body = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(appointment.id);
  });

  test("lists appointments with cursor pagination", async () => {
    const department = await createDepartment();
    const firstPatient = await createPatient();
    const secondPatient = await createPatient();
    const appointmentType = await createAppointmentType(department.id);

    const firstAppointment = await createAppointment(
      firstPatient.id,
      appointmentType.id,
    );
    const secondAppointment = await createAppointment(
      secondPatient.id,
      appointmentType.id,
    );

    const firstPageResponse = await request("/v1/appointments?page_size=1");
    const firstPage = (await firstPageResponse.json()) as {
      data: Array<{ id: string }>;
      pagination: { next: string; has_more: boolean };
    };

    expect(firstPage.data).toEqual([
      expect.objectContaining({ id: firstAppointment.id }),
    ]);
    expect(firstPage.pagination.has_more).toBe(true);

    const cursorPayload = decodeCursorFromNext(firstPage.pagination.next);
    expect(cursorPayload).toEqual({ public_id: firstAppointment.id });
    expect(cursorPayload).not.toHaveProperty("id");

    const secondPageResponse = await request(firstPage.pagination.next);
    const secondPage = (await secondPageResponse.json()) as {
      data: Array<{ id: string }>;
      pagination: { has_more: boolean };
    };

    expect(secondPage.data).toEqual([
      expect.objectContaining({ id: secondAppointment.id }),
    ]);
    expect(secondPage.pagination.has_more).toBe(false);
  });

  test("filters appointments by date", async () => {
    const department = await createDepartment();
    const patient = await createPatient();
    const appointmentType = await createAppointmentType(department.id);

    const onTargetDate = await createAppointmentAt(
      patient.id,
      appointmentType.id,
      { scheduled_date: "2026-07-10", scheduled_time: "09:00" },
    );
    await createAppointmentAt(patient.id, appointmentType.id, {
      scheduled_date: "2026-07-11",
      scheduled_time: "09:00",
    });

    const response = await request(
      "/v1/appointments?date=2026-07-10",
    );
    const body = (await response.json()) as {
      data: Array<{ id: string; scheduled_date: string }>;
      pagination: { self: string; has_more: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({ id: onTargetDate.id, scheduled_date: "2026-07-10" }),
    ]);
    expect(body.pagination.self).toBe(
      "/v1/appointments?page_size=20&date=2026-07-10",
    );
  });

  test("returns an empty page when no appointments match the date filter", async () => {
    const department = await createDepartment();
    const patient = await createPatient();
    const appointmentType = await createAppointmentType(department.id);
    await createAppointmentAt(patient.id, appointmentType.id, {
      scheduled_date: "2026-07-10",
      scheduled_time: "09:00",
    });

    const response = await request(
      "/v1/appointments?date=2030-01-01",
    );
    const body = (await response.json()) as {
      data: Array<{ id: string }>;
      pagination: { has_more: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.pagination.has_more).toBe(false);
  });

  test("rejects a malformed date filter on appointments", async () => {
    const response = await request("/v1/appointments?date=07-10-2026");
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("date"),
      instance: "/v1/appointments",
    });
  });

  test("rejects unsupported appointments list query parameters", async () => {
    const response = await request("/v1/appointments?patient_id=pat_abc123ABC456");
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("patient_id"),
      instance: "/v1/appointments",
    });
  });

  test("returns problem details when appointment patient does not exist", async () => {
    const department = await createDepartment();
    const appointmentType = await createAppointmentType(department.id);

    const response = await request("/v1/appointments", {
      method: "POST",
      body: JSON.stringify({
        scheduled_date: "2026-07-10",
        scheduled_time: "14:30",
        linked_patient_id: "pat_abc123ABC456",
        appointment_type_id: appointmentType.id,
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Patient was not found",
      instance: "/v1/appointments",
    });
  });

  test("returns problem details when appointment type does not exist", async () => {
    const patient = await createPatient();

    const response = await request("/v1/appointments", {
      method: "POST",
      body: JSON.stringify({
        scheduled_date: "2026-07-10",
        scheduled_time: "14:30",
        linked_patient_id: patient.id,
        appointment_type_id: "aty_abc123ABC456",
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "Appointment type was not found",
      instance: "/v1/appointments",
    });
  });

  test("returns problem details for invalid appointment time", async () => {
    const department = await createDepartment();
    const patient = await createPatient();
    const appointmentType = await createAppointmentType(department.id);

    const response = await request("/v1/appointments", {
      method: "POST",
      body: JSON.stringify({
        scheduled_date: "2026-07-10",
        scheduled_time: "24:00",
        linked_patient_id: patient.id,
        appointment_type_id: appointmentType.id,
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body).toEqual({
      type: "https://api.fertig.ai/problems/invalid-input",
      title: "Invalid Input",
      status: 422,
      detail: expect.stringContaining("scheduled_time"),
      instance: "/v1/appointments",
    });
  });
});
