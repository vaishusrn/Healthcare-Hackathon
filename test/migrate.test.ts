import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { createHealthcareRepository } from "../src/repositories/healthcare";

describe("database migrations", () => {
  test("migrates legacy clinic references to department references", () => {
    const db = createDatabase(":memory:");

    createLegacyClinicSchema(db);
    db.run(sql`
      INSERT INTO clinics (
        id,
        public_id,
        name,
        current_capacity,
        max_capacity,
        created_at,
        updated_at
      )
      VALUES (
        1,
        'cli_Legacy000001',
        'Kardiologie',
        12,
        20,
        '2026-07-09T10:00:00.000+02:00',
        '2026-07-09T10:00:00.000+02:00'
      )
    `);
    db.run(sql`
      INSERT INTO employees (
        public_id,
        first_name,
        last_name,
        position,
        clinic_id,
        created_at,
        updated_at
      )
      VALUES (
        'emp_Legacy000001',
        'Anna',
        'Müller',
        'Chefärztin',
        1,
        '2026-07-09T10:00:00.000+02:00',
        '2026-07-09T10:00:00.000+02:00'
      )
    `);
    db.run(sql`
      INSERT INTO appointment_types (
        public_id,
        name,
        clinic_id,
        default_duration_minutes,
        created_at,
        updated_at
      )
      VALUES (
        'aty_Legacy000001',
        'Kardiologischer Kontrolltermin',
        1,
        30,
        '2026-07-09T10:00:00.000+02:00',
        '2026-07-09T10:00:00.000+02:00'
      )
    `);

    migrate(db);

    const repository = createHealthcareRepository(db);
    const employee = repository.getEmployee("emp_Legacy000001");
    const appointmentType = repository.getAppointmentType("aty_Legacy000001");

    expect(repository.getDepartment("dep_Legacy000001")?.name).toBe(
      "Kardiologie",
    );
    expect(employee?.department.name).toBe("Kardiologie");
    expect(appointmentType?.department.name).toBe("Kardiologie");

    db.$client.close();
  });

  test("enforces patient visit integrity at the database layer", () => {
    const db = createDatabase(":memory:");
    migrate(db);
    insertVisitDependencies(db);

    expect(() =>
      db.run(sql`
        INSERT INTO patient_visits (
          public_id,
          patient_number,
          visit_type,
          status,
          patient_id,
          department_id,
          station_id,
          room_id,
          bed_id,
          started_date,
          started_time,
          ended_date,
          ended_time,
          created_at,
          updated_at
        )
        VALUES (
          'pvi_Invalid00001',
          'ABC1234',
          'INPATIENT',
          'ACTIVE',
          1,
          1,
          NULL,
          NULL,
          NULL,
          '2026-07-10',
          '08:15',
          NULL,
          NULL,
          '2026-07-09T10:00:00.000+02:00',
          '2026-07-09T10:00:00.000+02:00'
        )
      `),
    ).toThrow();

    expect(() =>
      db.run(sql`
        INSERT INTO patient_visits (
          public_id,
          patient_number,
          visit_type,
          status,
          patient_id,
          department_id,
          station_id,
          room_id,
          bed_id,
          started_date,
          started_time,
          ended_date,
          ended_time,
          created_at,
          updated_at
        )
        VALUES (
          'pvi_Invalid00002',
          '12345',
          'INPATIENT',
          'ACTIVE',
          1,
          1,
          1,
          NULL,
          NULL,
          '2026-07-10',
          '08:15',
          NULL,
          NULL,
          '2026-07-09T10:00:00.000+02:00',
          '2026-07-09T10:00:00.000+02:00'
        )
      `),
    ).toThrow();

    // Flipped rule: INPATIENT visits must now include station/room/bed, so a
    // fully null location (previously the valid inpatient shape) must fail.
    expect(() =>
      db.run(sql`
        INSERT INTO patient_visits (
          public_id,
          patient_number,
          visit_type,
          status,
          patient_id,
          department_id,
          station_id,
          room_id,
          bed_id,
          started_date,
          started_time,
          ended_date,
          ended_time,
          created_at,
          updated_at
        )
        VALUES (
          'pvi_Invalid00003',
          '23456',
          'INPATIENT',
          'ACTIVE',
          1,
          1,
          NULL,
          NULL,
          NULL,
          '2026-07-10',
          '08:15',
          NULL,
          NULL,
          '2026-07-09T10:00:00.000+02:00',
          '2026-07-09T10:00:00.000+02:00'
        )
      `),
    ).toThrow();

    // Flipped rule: OUTPATIENT visits must now have no station/room/bed, so a
    // partial location (previously an allowed outpatient shape) must fail.
    expect(() =>
      db.run(sql`
        INSERT INTO patient_visits (
          public_id,
          patient_number,
          visit_type,
          status,
          patient_id,
          department_id,
          station_id,
          room_id,
          bed_id,
          started_date,
          started_time,
          ended_date,
          ended_time,
          created_at,
          updated_at
        )
        VALUES (
          'pvi_Invalid00004',
          '34567',
          'OUTPATIENT',
          'ACTIVE',
          1,
          1,
          1,
          NULL,
          NULL,
          '2026-07-10',
          '08:15',
          NULL,
          NULL,
          '2026-07-09T10:00:00.000+02:00',
          '2026-07-09T10:00:00.000+02:00'
        )
      `),
    ).toThrow();

    // A fully-null outpatient visit remains valid under the flipped rule.
    expect(() =>
      db.run(sql`
        INSERT INTO patient_visits (
          public_id,
          patient_number,
          visit_type,
          status,
          patient_id,
          department_id,
          station_id,
          room_id,
          bed_id,
          started_date,
          started_time,
          ended_date,
          ended_time,
          created_at,
          updated_at
        )
        VALUES (
          'pvi_Valid00001',
          '45678',
          'OUTPATIENT',
          'ACTIVE',
          1,
          1,
          NULL,
          NULL,
          NULL,
          '2026-07-10',
          '08:15',
          NULL,
          NULL,
          '2026-07-09T10:00:00.000+02:00',
          '2026-07-09T10:00:00.000+02:00'
        )
      `),
    ).not.toThrow();

    db.$client.close();
  });

  test("migrates legacy seven digit patient visit numbers to five digits", () => {
    const db = createDatabase(":memory:");
    createLegacySevenDigitPatientVisitsSchema(db);
    db.run(sql`
      INSERT INTO patient_visits (
        public_id,
        patient_number,
        visit_type,
        status,
        patient_id,
        department_id,
        station_id,
        room_id,
        bed_id,
        started_date,
        started_time,
        ended_date,
        ended_time,
        created_at,
        updated_at
      )
      VALUES (
        'pvi_OldNumber01',
        '7000123',
        'OUTPATIENT',
        'ACTIVE',
        1,
        1,
        NULL,
        NULL,
        NULL,
        '2026-07-10',
        '08:15',
        NULL,
        NULL,
        '2026-07-09T10:00:00.000+02:00',
        '2026-07-09T10:00:00.000+02:00'
      )
    `);

    migrate(db);

    const row = db.$client
      .query("SELECT patient_number FROM patient_visits WHERE public_id = ?")
      .get("pvi_OldNumber01") as { patient_number: string };
    const table = db.$client
      .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get("patient_visits") as { sql: string };

    expect(row.patient_number).toBe("00123");
    expect(table.sql).toContain("[0-9][0-9][0-9][0-9][0-9]");
    expect(table.sql).not.toContain("[0-9][0-9][0-9][0-9][0-9][0-9][0-9]");

    db.$client.close();
  });
});

function createLegacyClinicSchema(db: ReturnType<typeof createDatabase>) {
  db.run(sql`
    CREATE TABLE clinics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      current_capacity INTEGER NOT NULL,
      max_capacity INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(sql`
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      position TEXT NOT NULL,
      clinic_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(sql`
    CREATE TABLE appointment_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      clinic_id INTEGER NOT NULL,
      default_duration_minutes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

function createLegacySevenDigitPatientVisitsSchema(
  db: ReturnType<typeof createDatabase>,
) {
  db.run(sql`
    CREATE TABLE patient_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      patient_number TEXT NOT NULL,
      visit_type TEXT NOT NULL CHECK (visit_type IN ('INPATIENT', 'OUTPATIENT')),
      status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DISCHARGED')),
      patient_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      station_id INTEGER,
      room_id INTEGER,
      bed_id INTEGER,
      started_date TEXT NOT NULL,
      started_time TEXT NOT NULL,
      ended_date TEXT,
      ended_time TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (patient_number GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
      CHECK (
        (visit_type = 'INPATIENT' AND station_id IS NOT NULL AND room_id IS NOT NULL AND bed_id IS NOT NULL)
        OR
        (visit_type = 'OUTPATIENT' AND station_id IS NULL AND room_id IS NULL AND bed_id IS NULL)
      ),
      CHECK (room_id IS NULL OR station_id IS NOT NULL),
      CHECK (bed_id IS NULL OR (station_id IS NOT NULL AND room_id IS NOT NULL)),
      CHECK (
        (status = 'ACTIVE' AND ended_date IS NULL AND ended_time IS NULL)
        OR
        (status = 'DISCHARGED' AND ended_date IS NOT NULL AND ended_time IS NOT NULL)
      )
    )
  `);
}

function insertVisitDependencies(db: ReturnType<typeof createDatabase>) {
  db.run(sql`
    INSERT INTO social_security_numbers (
      public_id,
      number,
      health_insurance_provider,
      insurance_type,
      created_at,
      updated_at
    )
    VALUES (
      'ssn_Test0000001',
      'DESVTEST-001',
      'Techniker Krankenkasse',
      'STATUTORY',
      '2026-07-09T10:00:00.000+02:00',
      '2026-07-09T10:00:00.000+02:00'
    )
  `);
  db.run(sql`
    INSERT INTO patients (
      public_id,
      gender,
      first_name,
      last_name,
      birth_date,
      birthplace,
      social_security_number_id,
      telephone_number,
      accepted_gdpr,
      created_at,
      updated_at
    )
    VALUES (
      'pat_Test0000001',
      'FEMALE',
      'Lena',
      'Schneider',
      '1988-04-12',
      'Berlin',
      1,
      '+493012345001',
      1,
      '2026-07-09T10:00:00.000+02:00',
      '2026-07-09T10:00:00.000+02:00'
    )
  `);
  db.run(sql`
    INSERT INTO departments (
      public_id,
      name,
      current_capacity,
      max_capacity,
      created_at,
      updated_at
    )
    VALUES (
      'dep_Test0000001',
      'Kardiologie',
      12,
      20,
      '2026-07-09T10:00:00.000+02:00',
      '2026-07-09T10:00:00.000+02:00'
    )
  `);
  db.run(sql`
    INSERT INTO stations (
      public_id,
      name,
      station_type,
      department_id,
      created_at,
      updated_at
    )
    VALUES (
      'sta_Test0000001',
      'Kardiologie Normalstation',
      'NORMAL',
      1,
      '2026-07-09T10:00:00.000+02:00',
      '2026-07-09T10:00:00.000+02:00'
    )
  `);
}
