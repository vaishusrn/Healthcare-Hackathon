import { describe, expect, test } from "bun:test";
import { createDatabase } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import {
  resetAndSeedDatabase,
  seedDatabase,
  seedHospitalName,
} from "../src/db/seed";
import { generatePeople, generateStructure } from "../src/db/seed-data";
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
} from "../src/db/schema";

/** publicId -> internal id, built purely from a DB query result. */
function idsByPublicId<T extends { publicId: string; id: number }>(
  rows: T[],
): Map<string, number> {
  return new Map(rows.map((row) => [row.publicId, row.id]));
}

describe("scaled German hospital seed (generateStructure + generatePeople wired into the DB)", () => {
  test("seeds the full scaled hospital with correct counts and FK wiring, and is idempotent", () => {
    const db = createDatabase(":memory:");
    migrate(db);

    const summary = seedDatabase(db);

    // --- Fixed-by-construction counts (see seed-data.ts constants) ----------
    expect(summary.socialSecurityNumbers).toBe(64324);
    expect(summary.patients).toBe(64324);
    expect(summary.employees).toBe(1000);
    expect(summary.appointments).toBe(5000);
    expect(summary.patientVisits).toBe(19240); // 9269 inpatient + 3971 outpatient active + 6000 discharged (pat_Berlin000019 pinned as ambulatory outpatient)

    // --- Structural counts derived from PRNG ward/room loops (tolerance) ----
    expect(summary.departments).toBeGreaterThanOrEqual(30);
    expect(summary.departments).toBeLessThanOrEqual(40);
    expect(summary.stations).toBeGreaterThanOrEqual(300);
    expect(summary.stations).toBeLessThanOrEqual(420);
    expect(summary.rooms).toBeGreaterThanOrEqual(6000);
    expect(summary.rooms).toBeLessThanOrEqual(8500);
    expect(summary.beds).toBeGreaterThanOrEqual(9500);
    expect(summary.beds).toBeLessThanOrEqual(12500);
    expect(summary.appointmentTypes).toBeGreaterThanOrEqual(90);
    expect(summary.appointmentTypes).toBeLessThanOrEqual(110);

    expect(seedHospitalName).toBe("Uniklikum X");

    // --- DB row counts must match the reported summary exactly --------------
    const dbSsns = db.select().from(socialSecurityNumbers).all();
    const dbDepartments = db.select().from(departments).all();
    const dbStations = db.select().from(stations).all();
    const dbRooms = db.select().from(rooms).all();
    const dbPatients = db.select().from(patients).all();
    const dbEmployees = db.select().from(employees).all();
    const dbBeds = db.select().from(beds).all();
    const dbPatientVisits = db.select().from(patientVisits).all();
    const dbAppointmentTypes = db.select().from(appointmentTypes).all();
    const dbAppointments = db.select().from(appointments).all();

    expect(dbSsns).toHaveLength(summary.socialSecurityNumbers);
    expect(dbDepartments).toHaveLength(summary.departments);
    expect(dbStations).toHaveLength(summary.stations);
    expect(dbRooms).toHaveLength(summary.rooms);
    expect(dbPatients).toHaveLength(summary.patients);
    expect(dbEmployees).toHaveLength(summary.employees);
    expect(dbBeds).toHaveLength(summary.beds);
    expect(dbPatientVisits).toHaveLength(summary.patientVisits);
    expect(dbAppointmentTypes).toHaveLength(summary.appointmentTypes);
    expect(dbAppointments).toHaveLength(summary.appointments);

    // Sequential ids starting at 1 (tables were freshly cleared + sequence reset).
    expect(Math.min(...dbDepartments.map((d) => d.id))).toBe(1);
    expect(Math.max(...dbDepartments.map((d) => d.id))).toBe(
      summary.departments,
    );

    // --- Full FK cross-check: re-run the deterministic generators           --
    // independently, and verify every generated row's *PublicId references   --
    // resolve, via publicId maps built purely from DB rows, to the exact FK  --
    // ids Drizzle actually stored. This exercises the seed.ts id-resolution  --
    // logic end-to-end (not just row counts).
    const structure = generateStructure();
    const people = generatePeople(structure);

    const ssnIds = idsByPublicId(dbSsns);
    const departmentIds = idsByPublicId(dbDepartments);
    const stationIds = idsByPublicId(dbStations);
    const roomIds = idsByPublicId(dbRooms);
    const patientIds = idsByPublicId(dbPatients);
    const bedIds = idsByPublicId(dbBeds);
    const appointmentTypeIds = idsByPublicId(dbAppointmentTypes);

    const dbStationByPublicId = new Map(dbStations.map((s) => [s.publicId, s]));
    const dbRoomByPublicId = new Map(dbRooms.map((r) => [r.publicId, r]));
    const dbPatientByPublicId = new Map(dbPatients.map((p) => [p.publicId, p]));
    const dbEmployeeByPublicId = new Map(
      dbEmployees.map((e) => [e.publicId, e]),
    );
    const dbBedByPublicId = new Map(dbBeds.map((b) => [b.publicId, b]));
    const dbPatientVisitByPublicId = new Map(
      dbPatientVisits.map((v) => [v.publicId, v]),
    );
    const dbAppointmentTypeByPublicId = new Map(
      dbAppointmentTypes.map((a) => [a.publicId, a]),
    );
    const dbAppointmentByPublicId = new Map(
      dbAppointments.map((a) => [a.publicId, a]),
    );

    for (const seed of structure.stations) {
      const row = dbStationByPublicId.get(seed.publicId);
      expect(row).toBeDefined();
      expect(row?.departmentId).toBe(
        departmentIds.get(seed.departmentPublicId),
      );
      expect(row?.building).toBe(seed.building);
      expect(row?.floor).toBe(seed.floor);
    }

    for (const seed of structure.rooms) {
      const row = dbRoomByPublicId.get(seed.publicId);
      expect(row).toBeDefined();
      expect(row?.departmentId).toBe(
        departmentIds.get(seed.departmentPublicId),
      );
      expect(row?.stationId).toBe(stationIds.get(seed.stationPublicId));
    }

    for (const seed of people.patients) {
      const row = dbPatientByPublicId.get(seed.publicId);
      expect(row).toBeDefined();
      expect(row?.socialSecurityNumberId).toBe(
        ssnIds.get(seed.socialSecurityNumberPublicId),
      );
    }

    for (const seed of people.employees) {
      const row = dbEmployeeByPublicId.get(seed.publicId);
      expect(row).toBeDefined();
      expect(row?.departmentId).toBe(
        departmentIds.get(seed.departmentPublicId),
      );
    }

    for (const seed of people.beds) {
      const row = dbBedByPublicId.get(seed.publicId);
      expect(row).toBeDefined();
      expect(row?.departmentId).toBe(
        departmentIds.get(seed.departmentPublicId),
      );
      expect(row?.stationId).toBe(stationIds.get(seed.stationPublicId));
      expect(row?.roomId).toBe(
        seed.roomPublicId ? (roomIds.get(seed.roomPublicId) ?? null) : null,
      );
      expect(row?.status).toBe(seed.status);
    }

    for (const seed of people.patientVisits) {
      const row = dbPatientVisitByPublicId.get(seed.publicId);
      expect(row).toBeDefined();
      expect(row?.patientId).toBe(patientIds.get(seed.patientPublicId));
      expect(row?.departmentId).toBe(
        departmentIds.get(seed.departmentPublicId),
      );
      expect(row?.stationId).toBe(
        seed.stationPublicId
          ? (stationIds.get(seed.stationPublicId) ?? null)
          : null,
      );
      expect(row?.roomId).toBe(
        seed.roomPublicId ? (roomIds.get(seed.roomPublicId) ?? null) : null,
      );
      expect(row?.bedId).toBe(
        seed.bedPublicId ? (bedIds.get(seed.bedPublicId) ?? null) : null,
      );
    }

    for (const seed of people.appointmentTypes) {
      const row = dbAppointmentTypeByPublicId.get(seed.publicId);
      expect(row).toBeDefined();
      expect(row?.departmentId).toBe(
        departmentIds.get(seed.departmentPublicId),
      );
    }

    for (const seed of people.appointments) {
      const row = dbAppointmentByPublicId.get(seed.publicId);
      expect(row).toBeDefined();
      expect(row?.patientId).toBe(patientIds.get(seed.patientPublicId));
      expect(row?.appointmentTypeId).toBe(
        appointmentTypeIds.get(seed.appointmentTypePublicId),
      );
    }

    // --- Cross-table invariants ----------------------------------------------
    const activeInpatientVisits = dbPatientVisits.filter(
      (v) => v.status === "ACTIVE" && v.visitType === "INPATIENT",
    );
    const occupiedBeds = dbBeds.filter((b) => b.status === "OCCUPIED");
    expect(occupiedBeds).toHaveLength(activeInpatientVisits.length);

    for (const visit of dbPatientVisits) {
      if (visit.visitType === "INPATIENT") {
        expect(visit.stationId).not.toBeNull();
        expect(visit.roomId).not.toBeNull();
        expect(visit.bedId).not.toBeNull();
      } else {
        expect(visit.stationId).toBeNull();
        expect(visit.roomId).toBeNull();
        expect(visit.bedId).toBeNull();
      }
      if (visit.status === "ACTIVE") {
        expect(visit.endedDate).toBeNull();
        expect(visit.endedTime).toBeNull();
      } else {
        expect(visit.endedDate).not.toBeNull();
        expect(visit.endedTime).not.toBeNull();
      }
      expect(visit.patientNumber).toMatch(/^\d{5}$/);
    }

    const activePatientNumbers = dbPatientVisits
      .filter((v) => v.status === "ACTIVE")
      .map((v) => v.patientNumber);
    expect(new Set(activePatientNumbers).size).toBe(
      activePatientNumbers.length,
    );

    // --- Re-seeding is safe and deterministic (clears + rebuilds identically) --
    const secondSummary = seedDatabase(db);
    expect(secondSummary).toEqual(summary);
    expect(db.select().from(patients).all()).toHaveLength(summary.patients);
    expect(db.select().from(beds).all()).toHaveLength(summary.beds);
    expect(db.select().from(patientVisits).all()).toHaveLength(
      summary.patientVisits,
    );
    expect(
      db.select().from(departments).all().map((d) => d.id),
    ).toEqual(dbDepartments.map((d) => d.id));

    db.$client.close();
  }, 30000);

  test("resetAndSeedDatabase clears prior data (including manual edits) and resets sequences before reseeding", () => {
    const db = createDatabase(":memory:");
    migrate(db);

    seedDatabase(db);
    db.insert(departments)
      .values({
        publicId: "dep_Extra000001",
        name: "Temporäre Abteilung",
        currentCapacity: 1,
        maxCapacity: 1,
        createdAt: "2026-07-09T10:00:00.000+02:00",
        updatedAt: "2026-07-09T10:00:00.000+02:00",
      })
      .run();

    const beforeReset = db.select().from(departments).all();
    expect(
      beforeReset.some((d) => d.publicId === "dep_Extra000001"),
    ).toBe(true);

    const summary = resetAndSeedDatabase(db);
    const seededDepartments = db.select().from(departments).all();

    expect(seededDepartments).toHaveLength(summary.departments);
    expect(
      seededDepartments.map((department) => department.name),
    ).not.toContain("Temporäre Abteilung");
    expect(seededDepartments[0]?.id).toBe(1);
    expect(summary.patients).toBe(64324);
    expect(summary.employees).toBe(1000);
    expect(db.select().from(patients).all()).toHaveLength(summary.patients);
    expect(db.select().from(socialSecurityNumbers).all()).toHaveLength(
      summary.socialSecurityNumbers,
    );

    db.$client.close();
  }, 30000);
});
