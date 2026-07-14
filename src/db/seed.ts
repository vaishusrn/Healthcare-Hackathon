import { sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { AppDatabase } from "./client";
import { generatePeople, generateStructure } from "./seed-data";
import {
  appointments,
  appointmentTypes,
  beds,
  departments,
  employees,
  patientVisits,
  patients,
  rooms,
  socialSecurityNumbers,
  stations,
  type NewAppointmentRow,
  type NewAppointmentTypeRow,
  type NewBedRow,
  type NewDepartmentRow,
  type NewEmployeeRow,
  type NewPatientRow,
  type NewPatientVisitRow,
  type NewRoomRow,
  type NewSocialSecurityNumberRow,
  type NewStationRow,
} from "./schema";

export type SeedSummary = {
  socialSecurityNumbers: number;
  patients: number;
  departments: number;
  stations: number;
  rooms: number;
  beds: number;
  patientVisits: number;
  employees: number;
  appointmentTypes: number;
  appointments: number;
};

export const seedHospitalName = "Uniklikum X";

// Order matters for the `DELETE FROM sqlite_sequence` below only in that it
// must list every seeded table; the actual row deletes in `clearDatabase`
// below are ordered child-before-parent to satisfy FK `ON DELETE RESTRICT`.
const seedTableNames = [
  "appointments",
  "patient_visits",
  "beds",
  "appointment_types",
  "employees",
  "rooms",
  "stations",
  "patients",
  "departments",
  "social_security_numbers",
] as const;

/**
 * Chunked, non-returning bulk insert. Avoids per-row `.returning()` round
 * trips: SQLite has a hard limit of 32766 bound variables per statement, so
 * rows are batched to stay comfortably under that (`30000 / columnCount`).
 */
function insertAll<T extends Record<string, unknown>>(
  db: AppDatabase,
  table: SQLiteTable,
  rows: T[],
): void {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]!).length;
  const chunkSize = Math.max(1, Math.floor(30000 / cols));
  for (let i = 0; i < rows.length; i += chunkSize) {
    db.insert(table).values(rows.slice(i, i + chunkSize) as never).run();
  }
}

/**
 * Builds a `publicId -> internal id` map from a freshly-inserted array,
 * relying on the fact that autoincrement ids are sequential starting at 1
 * because the table was just cleared + `sqlite_sequence` reset immediately
 * before this seed run.
 */
function indexMap<T extends { publicId: string }>(
  rows: T[],
): Map<string, number> {
  return new Map(rows.map((row, index) => [row.publicId, index + 1]));
}

function requireId(
  map: Map<string, number>,
  publicId: string,
  label: string,
): number {
  const id = map.get(publicId);
  if (id === undefined) {
    throw new Error(`Seed data references missing ${label} ${publicId}`);
  }
  return id;
}

function resolveNullableId(
  map: Map<string, number>,
  publicId: string | null,
  label: string,
): number | null {
  if (publicId === null) return null;
  return requireId(map, publicId, label);
}

/**
 * Clears (and reseeds sequential ids for) every seeded table, then generates
 * the deterministic scaled hospital via `generateStructure()` +
 * `generatePeople()` and bulk-inserts it inside a single transaction. Because
 * everything is cleared first, autoincrement ids are guaranteed sequential
 * (1, 2, 3, ...) in insertion order, so foreign keys are resolved via cheap
 * `publicId -> arrayIndex + 1` maps instead of per-row `.returning()`.
 */
export function seedDatabase(db: AppDatabase): SeedSummary {
  const now = "2026-07-09T10:00:00.000+02:00";

  const structure = generateStructure();
  const people = generatePeople(structure);

  return db.transaction((): SeedSummary => {
    clearDatabase(db);

    const socialSecurityNumberRows: NewSocialSecurityNumberRow[] =
      people.socialSecurityNumbers.map((seed) => ({
        publicId: seed.publicId,
        number: seed.number,
        healthInsuranceProvider: seed.healthInsuranceProvider,
        insuranceType: seed.insuranceType,
        createdAt: now,
        updatedAt: now,
      }));
    insertAll(db, socialSecurityNumbers, socialSecurityNumberRows);
    const socialSecurityNumberIds = indexMap(people.socialSecurityNumbers);

    const departmentRows: NewDepartmentRow[] = structure.departments.map(
      (seed) => ({
        publicId: seed.publicId,
        name: seed.name,
        currentCapacity: seed.currentCapacity,
        maxCapacity: seed.maxCapacity,
        createdAt: now,
        updatedAt: now,
      }),
    );
    insertAll(db, departments, departmentRows);
    const departmentIds = indexMap(structure.departments);

    const stationRows: NewStationRow[] = structure.stations.map((seed) => ({
      publicId: seed.publicId,
      name: seed.name,
      stationType: seed.stationType,
      building: seed.building,
      floor: seed.floor,
      departmentId: requireId(
        departmentIds,
        seed.departmentPublicId,
        "department",
      ),
      createdAt: now,
      updatedAt: now,
    }));
    insertAll(db, stations, stationRows);
    const stationIds = indexMap(structure.stations);

    const roomRows: NewRoomRow[] = structure.rooms.map((seed) => ({
      publicId: seed.publicId,
      name: seed.name,
      roomType: seed.roomType,
      departmentId: requireId(
        departmentIds,
        seed.departmentPublicId,
        "department",
      ),
      stationId: requireId(stationIds, seed.stationPublicId, "station"),
      createdAt: now,
      updatedAt: now,
    }));
    insertAll(db, rooms, roomRows);
    const roomIds = indexMap(structure.rooms);

    const patientRows: NewPatientRow[] = people.patients.map((seed) => ({
      publicId: seed.publicId,
      gender: seed.gender,
      firstName: seed.firstName,
      lastName: seed.lastName,
      birthDate: seed.birthDate,
      birthplace: seed.birthplace,
      socialSecurityNumberId: requireId(
        socialSecurityNumberIds,
        seed.socialSecurityNumberPublicId,
        "social security number",
      ),
      telephoneNumber: seed.telephoneNumber,
      acceptedGdpr: seed.acceptedGdpr,
      createdAt: now,
      updatedAt: now,
    }));
    insertAll(db, patients, patientRows);
    const patientIds = indexMap(people.patients);

    const employeeRows: NewEmployeeRow[] = people.employees.map((seed) => ({
      publicId: seed.publicId,
      firstName: seed.firstName,
      lastName: seed.lastName,
      position: seed.position,
      departmentId: requireId(
        departmentIds,
        seed.departmentPublicId,
        "department",
      ),
      createdAt: now,
      updatedAt: now,
    }));
    insertAll(db, employees, employeeRows);

    // Reconciled beds (people.beds), NOT structure.beds: this is the array
    // where OCCUPIED status has been re-derived so it exactly matches the
    // active-inpatient pairings below.
    const bedRows: NewBedRow[] = people.beds.map((seed) => ({
      publicId: seed.publicId,
      bedType: seed.bedType,
      status: seed.status,
      material: seed.material,
      departmentId: requireId(
        departmentIds,
        seed.departmentPublicId,
        "department",
      ),
      stationId: requireId(stationIds, seed.stationPublicId, "station"),
      roomId: resolveNullableId(roomIds, seed.roomPublicId, "room"),
      createdAt: now,
      updatedAt: now,
    }));
    insertAll(db, beds, bedRows);
    const bedIds = indexMap(people.beds);

    const patientVisitRows: NewPatientVisitRow[] = people.patientVisits.map(
      (seed) => ({
        publicId: seed.publicId,
        patientNumber: seed.patientNumber,
        visitType: seed.visitType,
        status: seed.status,
        patientId: requireId(patientIds, seed.patientPublicId, "patient"),
        departmentId: requireId(
          departmentIds,
          seed.departmentPublicId,
          "department",
        ),
        stationId: resolveNullableId(
          stationIds,
          seed.stationPublicId,
          "station",
        ),
        roomId: resolveNullableId(roomIds, seed.roomPublicId, "room"),
        bedId: resolveNullableId(bedIds, seed.bedPublicId, "bed"),
        startedDate: seed.startedDate,
        startedTime: seed.startedTime,
        endedDate: seed.endedDate,
        endedTime: seed.endedTime,
        createdAt: now,
        updatedAt: now,
      }),
    );
    insertAll(db, patientVisits, patientVisitRows);

    const appointmentTypeRows: NewAppointmentTypeRow[] =
      people.appointmentTypes.map((seed) => ({
        publicId: seed.publicId,
        name: seed.name,
        departmentId: requireId(
          departmentIds,
          seed.departmentPublicId,
          "department",
        ),
        defaultDurationMinutes: seed.defaultDurationMinutes,
        createdAt: now,
        updatedAt: now,
      }));
    insertAll(db, appointmentTypes, appointmentTypeRows);
    const appointmentTypeIds = indexMap(people.appointmentTypes);

    const appointmentRows: NewAppointmentRow[] = people.appointments.map(
      (seed) => ({
        publicId: seed.publicId,
        scheduledDate: seed.scheduledDate,
        scheduledTime: seed.scheduledTime,
        patientId: requireId(patientIds, seed.patientPublicId, "patient"),
        appointmentTypeId: requireId(
          appointmentTypeIds,
          seed.appointmentTypePublicId,
          "appointment type",
        ),
        createdAt: now,
        updatedAt: now,
      }),
    );
    insertAll(db, appointments, appointmentRows);

    return {
      socialSecurityNumbers: people.socialSecurityNumbers.length,
      patients: people.patients.length,
      departments: structure.departments.length,
      stations: structure.stations.length,
      rooms: structure.rooms.length,
      beds: people.beds.length,
      patientVisits: people.patientVisits.length,
      employees: people.employees.length,
      appointmentTypes: people.appointmentTypes.length,
      appointments: people.appointments.length,
    };
  });
}

export function clearDatabase(db: AppDatabase) {
  db.delete(appointments).run();
  db.delete(patientVisits).run();
  db.delete(beds).run();
  db.delete(appointmentTypes).run();
  db.delete(employees).run();
  db.delete(rooms).run();
  db.delete(stations).run();
  db.delete(patients).run();
  db.delete(departments).run();
  db.delete(socialSecurityNumbers).run();
  db.run(sql.raw(`DELETE FROM sqlite_sequence WHERE name IN (${quotedTableNames()})`));
}

export function resetAndSeedDatabase(db: AppDatabase): SeedSummary {
  return seedDatabase(db);
}

function quotedTableNames() {
  return seedTableNames.map((tableName) => `'${tableName}'`).join(", ");
}
