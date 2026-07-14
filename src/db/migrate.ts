import { sql } from "drizzle-orm";
import type { AppDatabase } from "./client";

export function migrate(db: AppDatabase) {
  db.run(sql`PRAGMA foreign_keys = ON`);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS social_security_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      number TEXT NOT NULL UNIQUE,
      health_insurance_provider TEXT NOT NULL,
      insurance_type TEXT NOT NULL CHECK (insurance_type IN ('STATUTORY', 'PRIVATE')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      gender TEXT NOT NULL CHECK (gender IN ('FEMALE', 'MALE', 'NON_BINARY', 'UNKNOWN')),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      birthplace TEXT NOT NULL,
      social_security_number_id INTEGER NOT NULL UNIQUE,
      telephone_number TEXT NOT NULL,
      accepted_gdpr INTEGER NOT NULL CHECK (accepted_gdpr IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (social_security_number_id)
        REFERENCES social_security_numbers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      current_capacity INTEGER NOT NULL,
      max_capacity INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  migrateLegacyClinicSchema(db);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      station_type TEXT NOT NULL CHECK (station_type IN ('INTENSIVE', 'NORMAL')),
      building TEXT NOT NULL DEFAULT 'Haus 1',
      floor INTEGER NOT NULL DEFAULT 0,
      department_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    )
  `);

  if (tableExists(db, "stations")) {
    if (!columnExists(db, "stations", "building")) {
      db.run(
        sql.raw(
          `ALTER TABLE stations ADD COLUMN building TEXT NOT NULL DEFAULT 'Haus 1'`,
        ),
      );
    }
    if (!columnExists(db, "stations", "floor")) {
      db.run(
        sql.raw(
          `ALTER TABLE stations ADD COLUMN floor INTEGER NOT NULL DEFAULT 0`,
        ),
      );
    }
  }

  db.run(sql`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      room_type TEXT NOT NULL CHECK (room_type IN ('GROUP_ROOM', 'SINGLE_ROOM_STANDARD', 'SINGLE_ROOM_INFECTIOUS', 'SINGLE_ROOM_AIRLOCK', 'SECRETARIAT')),
      department_id INTEGER NOT NULL,
      station_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (station_id)
        REFERENCES stations(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      bed_type TEXT NOT NULL CHECK (bed_type IN ('INTENSIVE_CARE', 'STANDARD')),
      status TEXT NOT NULL CHECK (status IN ('FREE', 'RESERVED', 'OCCUPIED')),
      material TEXT NOT NULL CHECK (material IN ('BARIATRIC', 'ELEVATING_LEG_REST', 'PRESSURE_ULCER', 'STANDARD')),
      department_id INTEGER NOT NULL,
      station_id INTEGER NOT NULL,
      room_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (station_id)
        REFERENCES stations(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS patient_visits (
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
      CHECK (patient_number GLOB '[0-9][0-9][0-9][0-9][0-9]'),
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
      ),
      FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (station_id)
        REFERENCES stations(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (bed_id)
        REFERENCES beds(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    )
  `);

  migratePatientVisitNumberFormat(db);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      position TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS appointment_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      default_duration_minutes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      patient_id INTEGER NOT NULL,
      appointment_type_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (appointment_type_id)
        REFERENCES appointment_types(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    )
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS patients_created_at_id_idx
      ON patients (created_at, id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS departments_created_at_id_idx
      ON departments (created_at, id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS stations_department_id_idx
      ON stations (department_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS stations_created_at_id_idx
      ON stations (created_at, id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS rooms_department_id_idx
      ON rooms (department_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS rooms_station_id_idx
      ON rooms (station_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS rooms_created_at_id_idx
      ON rooms (created_at, id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS beds_department_id_idx
      ON beds (department_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS beds_station_id_idx
      ON beds (station_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS beds_room_id_idx
      ON beds (room_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS beds_created_at_id_idx
      ON beds (created_at, id)
  `);

  db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS patient_visits_active_patient_number_unique
      ON patient_visits (patient_number)
      WHERE status = 'ACTIVE'
  `);

  // Enforces "one occupied bed = one active inpatient": at most one ACTIVE
  // INPATIENT visit may reference a given bed_id. Previously only guaranteed
  // by seed construction; this makes the DB reject any write that would
  // otherwise leave two active inpatients pointing at the same bed.
  db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS patient_visits_active_inpatient_bed_unique
      ON patient_visits (bed_id)
      WHERE bed_id IS NOT NULL AND status = 'ACTIVE'
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS patient_visits_patient_id_idx
      ON patient_visits (patient_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS patient_visits_department_id_idx
      ON patient_visits (department_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS patient_visits_station_id_idx
      ON patient_visits (station_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS patient_visits_room_id_idx
      ON patient_visits (room_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS patient_visits_bed_id_idx
      ON patient_visits (bed_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS patient_visits_created_at_id_idx
      ON patient_visits (created_at, id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS employees_department_id_idx
      ON employees (department_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS employees_created_at_id_idx
      ON employees (created_at, id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS appointment_types_department_id_idx
      ON appointment_types (department_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS appointment_types_created_at_id_idx
      ON appointment_types (created_at, id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS appointments_patient_id_idx
      ON appointments (patient_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS appointments_appointment_type_id_idx
      ON appointments (appointment_type_id)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS appointments_scheduled_date_idx
      ON appointments (scheduled_date)
  `);

  db.run(sql`
    CREATE INDEX IF NOT EXISTS appointments_created_at_id_idx
      ON appointments (created_at, id)
  `);
}

function migratePatientVisitNumberFormat(db: AppDatabase) {
  const tableSql = db.$client
    .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get("patient_visits") as { sql?: string } | undefined;

  if (!tableSql?.sql?.includes("[0-9][0-9][0-9][0-9][0-9][0-9][0-9]")) {
    return;
  }

  db.run(sql`PRAGMA foreign_keys = OFF`);

  db.run(sql`ALTER TABLE patient_visits RENAME TO patient_visits_old_number_format`);

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
      CHECK (patient_number GLOB '[0-9][0-9][0-9][0-9][0-9]'),
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
      ),
      FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (station_id)
        REFERENCES stations(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (bed_id)
        REFERENCES beds(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    )
  `);

  db.run(sql`
    INSERT INTO patient_visits (
      id,
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
    SELECT
      id,
      public_id,
      CASE
        WHEN length(patient_number) = 7 THEN substr(patient_number, -5)
        ELSE patient_number
      END,
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
    FROM patient_visits_old_number_format
  `);

  db.run(sql`DROP TABLE patient_visits_old_number_format`);
  db.run(sql`PRAGMA foreign_keys = ON`);
}

function migrateLegacyClinicSchema(db: AppDatabase) {
  if (!tableExists(db, "clinics")) {
    return;
  }

  db.run(sql`
    INSERT OR IGNORE INTO departments (
      id,
      public_id,
      name,
      current_capacity,
      max_capacity,
      created_at,
      updated_at
    )
    SELECT
      id,
      CASE
        WHEN public_id LIKE 'cli_%' THEN 'dep_' || substr(public_id, 5)
        ELSE public_id
      END,
      name,
      current_capacity,
      max_capacity,
      created_at,
      updated_at
    FROM clinics
  `);

  addDepartmentReferenceFromClinic(db, "employees");
  addDepartmentReferenceFromClinic(db, "appointment_types");
}

function addDepartmentReferenceFromClinic(
  db: AppDatabase,
  tableName: "employees" | "appointment_types",
) {
  if (!tableExists(db, tableName) || !columnExists(db, tableName, "clinic_id")) {
    return;
  }

  if (!columnExists(db, tableName, "department_id")) {
    db.run(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN department_id INTEGER`));
  }

  db.run(
    sql.raw(
      `UPDATE ${tableName}
       SET department_id = clinic_id
       WHERE department_id IS NULL`,
    ),
  );
}

function tableExists(db: AppDatabase, tableName: string) {
  return Boolean(
    db.$client
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(tableName),
  );
}

function columnExists(db: AppDatabase, tableName: string, columnName: string) {
  return db.$client
    .query(`PRAGMA table_info(${tableName})`)
    .all()
    .some((row) => (row as { name: string }).name === columnName);
}
