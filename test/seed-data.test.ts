import { describe, expect, test } from "bun:test";
import { mulberry32 } from "../src/db/prng";
import {
  BUILDINGS,
  SEED_DEPARTMENTS,
  generatePeople,
  generateStructure,
} from "../src/db/seed-data";

describe("mulberry32", () => {
  test("is a deterministic seeded PRNG in [0, 1)", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);

    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());

    expect(seqA).toEqual(seqB);
    expect(seqA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  test("different seeds diverge", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();

    expect(a).not.toBe(b);
  });
});

describe("SEED_DEPARTMENTS / BUILDINGS pools", () => {
  test("has exactly 34 real German Uniklinikum departments with unique kuerzel", () => {
    expect(SEED_DEPARTMENTS).toHaveLength(34);

    const names = new Set(SEED_DEPARTMENTS.map((department) => department.name));
    const kuerzel = new Set(SEED_DEPARTMENTS.map((department) => department.kuerzel));

    expect(names.size).toBe(34);
    expect(kuerzel.size).toBe(34);

    for (const department of SEED_DEPARTMENTS) {
      expect(department.name.length).toBeGreaterThan(0);
      expect(department.kuerzel.length).toBeGreaterThan(0);
    }

    expect(SEED_DEPARTMENTS.map((department) => department.name)).toContain(
      "Kardiologie",
    );
    expect(SEED_DEPARTMENTS.map((department) => department.name)).toContain(
      "Zentrale Notaufnahme",
    );
    expect(SEED_DEPARTMENTS.map((department) => department.name)).toContain(
      "Geriatrie",
    );
    expect(SEED_DEPARTMENTS.map((department) => department.name)).toContain(
      "Palliativmedizin",
    );
  });

  test("has around 10 themed building names", () => {
    expect(BUILDINGS.length).toBeGreaterThanOrEqual(8);
    expect(BUILDINGS.length).toBeLessThanOrEqual(12);
    expect(new Set(BUILDINGS).size).toBe(BUILDINGS.length);
    expect(BUILDINGS.every((name) => name.startsWith("Haus"))).toBe(true);
  });
});

describe("generateStructure", () => {
  test("is deterministic across repeated calls", () => {
    const first = generateStructure();
    const second = generateStructure();

    expect(second).toEqual(first);
  });

  test("produces exactly 34 departments", () => {
    const { departments } = generateStructure();

    expect(departments).toHaveLength(34);
    expect(new Set(departments.map((d) => d.publicId)).size).toBe(34);
  });

  test("produces station counts within the [300, 420] scale target", () => {
    const { stations } = generateStructure();

    expect(stations.length).toBeGreaterThanOrEqual(300);
    expect(stations.length).toBeLessThanOrEqual(420);
    expect(new Set(stations.map((s) => s.publicId)).size).toBe(
      stations.length,
    );
  });

  test("produces room counts within the [6000, 8500] scale target", () => {
    const { rooms } = generateStructure();

    expect(rooms.length).toBeGreaterThanOrEqual(6000);
    expect(rooms.length).toBeLessThanOrEqual(8500);
    expect(new Set(rooms.map((r) => r.publicId)).size).toBe(rooms.length);
  });

  test("produces bed counts within the [9500, 12500] scale target", () => {
    const { beds } = generateStructure();

    expect(beds.length).toBeGreaterThanOrEqual(9500);
    expect(beds.length).toBeLessThanOrEqual(12500);
    expect(new Set(beds.map((b) => b.publicId)).size).toBe(beds.length);
  });

  test("every station (ward) has a building and a floor", () => {
    const { stations } = generateStructure();

    expect(stations.length).toBeGreaterThan(0);
    for (const station of stations) {
      expect(typeof station.building).toBe("string");
      expect(station.building.length).toBeGreaterThan(0);
      expect(BUILDINGS).toContain(station.building);
      expect(Number.isInteger(station.floor)).toBe(true);
      expect(station.floor).toBeGreaterThanOrEqual(1);
    }
  });

  test("every ward (station) has at least one SECRETARIAT room, and all SECRETARIAT rooms have 0 beds", () => {
    const { stations, rooms, beds } = generateStructure();

    const bedCountByRoomPublicId = new Map<string, number>();
    for (const bed of beds) {
      if (!bed.roomPublicId) continue;
      bedCountByRoomPublicId.set(
        bed.roomPublicId,
        (bedCountByRoomPublicId.get(bed.roomPublicId) ?? 0) + 1,
      );
    }

    const roomsByStationPublicId = new Map<string, typeof rooms>();
    for (const room of rooms) {
      const list = roomsByStationPublicId.get(room.stationPublicId) ?? [];
      list.push(room);
      roomsByStationPublicId.set(room.stationPublicId, list);
    }

    for (const station of stations) {
      const wardRooms = roomsByStationPublicId.get(station.publicId) ?? [];
      const secretariatRooms = wardRooms.filter(
        (room) => room.roomType === "SECRETARIAT",
      );

      expect(secretariatRooms.length).toBeGreaterThanOrEqual(1);
    }

    const secretariatRooms = rooms.filter(
      (room) => room.roomType === "SECRETARIAT",
    );
    expect(secretariatRooms.length).toBeGreaterThan(0);
    for (const room of secretariatRooms) {
      expect(bedCountByRoomPublicId.get(room.publicId) ?? 0).toBe(0);
    }
  });

  test("INTENSIVE wards only ever produce INTENSIVE_CARE beds", () => {
    const { stations, beds } = generateStructure();

    const stationTypeByPublicId = new Map(
      stations.map((station) => [station.publicId, station.stationType]),
    );

    const intensiveStationPublicIds = new Set(
      stations
        .filter((station) => station.stationType === "INTENSIVE")
        .map((station) => station.publicId),
    );
    expect(intensiveStationPublicIds.size).toBeGreaterThan(0);

    for (const bed of beds) {
      const stationType = stationTypeByPublicId.get(bed.stationPublicId);
      if (stationType === "INTENSIVE") {
        expect(bed.bedType).toBe("INTENSIVE_CARE");
      } else {
        expect(bed.bedType).toBe("STANDARD");
      }
    }
  });

  test("bed status is provisional but only ever a valid enum value, roughly matching the ~84/5/11 split", () => {
    const { beds } = generateStructure();

    const counts = { FREE: 0, RESERVED: 0, OCCUPIED: 0 };
    for (const bed of beds) {
      expect(["FREE", "RESERVED", "OCCUPIED"]).toContain(bed.status);
      counts[bed.status] += 1;
    }

    const occupiedRatio = counts.OCCUPIED / beds.length;
    expect(occupiedRatio).toBeGreaterThan(0.7);
    expect(occupiedRatio).toBeLessThan(0.95);
  });

  test("referential integrity: every station/room/bed points at a real parent publicId", () => {
    const { departments, stations, rooms, beds } = generateStructure();

    const departmentPublicIds = new Set(departments.map((d) => d.publicId));
    const stationPublicIds = new Set(stations.map((s) => s.publicId));
    const roomPublicIds = new Set(rooms.map((r) => r.publicId));

    for (const station of stations) {
      expect(departmentPublicIds.has(station.departmentPublicId)).toBe(true);
    }
    for (const room of rooms) {
      expect(departmentPublicIds.has(room.departmentPublicId)).toBe(true);
      expect(stationPublicIds.has(room.stationPublicId)).toBe(true);
    }
    for (const bed of beds) {
      expect(departmentPublicIds.has(bed.departmentPublicId)).toBe(true);
      expect(stationPublicIds.has(bed.stationPublicId)).toBe(true);
      if (bed.roomPublicId) {
        expect(roomPublicIds.has(bed.roomPublicId)).toBe(true);
      }
    }
  });

  test("department capacities are positive and reflect ward bed totals", () => {
    const { departments, beds } = generateStructure();

    const bedCountByDepartment = new Map<string, number>();
    for (const bed of beds) {
      bedCountByDepartment.set(
        bed.departmentPublicId,
        (bedCountByDepartment.get(bed.departmentPublicId) ?? 0) + 1,
      );
    }

    for (const department of departments) {
      expect(department.maxCapacity).toBeGreaterThan(0);
      expect(department.currentCapacity).toBeGreaterThanOrEqual(0);
      expect(department.maxCapacity).toBe(
        bedCountByDepartment.get(department.publicId) ?? 0,
      );
    }
  });
});

describe("generatePeople", () => {
  test("is deterministic: same structure in -> identical people out across calls", () => {
    const structure = generateStructure();
    const first = generatePeople(structure);
    const second = generatePeople(structure);

    expect(second).toEqual(first);
  });

  test("produces exactly 64324 SSNs and 64324 patients, one SSN per patient", () => {
    const structure = generateStructure();
    const { socialSecurityNumbers, patients } = generatePeople(structure);

    expect(socialSecurityNumbers).toHaveLength(64324);
    expect(patients).toHaveLength(64324);
    expect(new Set(socialSecurityNumbers.map((s) => s.publicId)).size).toBe(
      64324,
    );
    expect(new Set(patients.map((p) => p.publicId)).size).toBe(64324);

    const ssnPublicIds = new Set(
      socialSecurityNumbers.map((s) => s.publicId),
    );
    for (const patient of patients) {
      expect(ssnPublicIds.has(patient.socialSecurityNumberPublicId)).toBe(
        true,
      );
      expect(patient.acceptedGdpr).toBe(true);
      expect(patient.firstName.length).toBeGreaterThan(0);
      expect(patient.lastName.length).toBeGreaterThan(0);
      expect(patient.birthplace.length).toBeGreaterThan(0);
      expect(patient.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("every SSN number is dash-free, matches DESV<digits>, and is unique", () => {
    const structure = generateStructure();
    const { socialSecurityNumbers } = generatePeople(structure);

    expect(socialSecurityNumbers.length).toBeGreaterThan(0);
    for (const ssn of socialSecurityNumbers) {
      expect(ssn.number).toMatch(/^DESV\d+$/);
      expect(ssn.number).not.toContain("-");
    }

    const numbers = new Set(socialSecurityNumbers.map((s) => s.number));
    expect(numbers.size).toBe(socialSecurityNumbers.length);
  });

  test("produces exactly 1000 employees, round-robin across every department", () => {
    const structure = generateStructure();
    const { employees } = generatePeople(structure);

    expect(employees).toHaveLength(1000);
    expect(new Set(employees.map((e) => e.publicId)).size).toBe(1000);

    const departmentPublicIds = new Set(
      structure.departments.map((d) => d.publicId),
    );
    const departmentsUsed = new Set<string>();
    for (const employee of employees) {
      expect(departmentPublicIds.has(employee.departmentPublicId)).toBe(
        true,
      );
      expect(employee.position.length).toBeGreaterThan(0);
      departmentsUsed.add(employee.departmentPublicId);
    }
    expect(departmentsUsed.size).toBe(structure.departments.length);
  });

  // 13240 not 13241: pat_Berlin000019 ("Matthias Müller") is pinned as an
  // ambulatory outpatient fixture, so their would-be active inpatient visit is
  // dropped and its bed released. See the fixture block in seed-data.ts.
  test("produces exactly 13240 active visits: ~9269 INPATIENT (bed-pinned) + rest OUTPATIENT (no bed)", () => {
    const structure = generateStructure();
    const { patientVisits, beds } = generatePeople(structure);

    const bedByPublicId = new Map(beds.map((b) => [b.publicId, b]));
    const activeVisits = patientVisits.filter((v) => v.status === "ACTIVE");
    const activeInpatient = activeVisits.filter(
      (v) => v.visitType === "INPATIENT",
    );
    const activeOutpatient = activeVisits.filter(
      (v) => v.visitType === "OUTPATIENT",
    );

    expect(activeVisits).toHaveLength(13240);
    expect(activeInpatient.length).toBeGreaterThan(9269 - 50);
    expect(activeInpatient.length).toBeLessThan(9269 + 50);
    expect(activeInpatient.length + activeOutpatient.length).toBe(13240);

    const usedBedPublicIds = new Set<string>();
    for (const visit of activeInpatient) {
      expect(visit.stationPublicId).not.toBeNull();
      expect(visit.roomPublicId).not.toBeNull();
      expect(visit.bedPublicId).not.toBeNull();

      const bed = bedByPublicId.get(visit.bedPublicId as string);
      expect(bed).toBeDefined();
      expect(bed?.status).toBe("OCCUPIED");

      expect(usedBedPublicIds.has(visit.bedPublicId as string)).toBe(false);
      usedBedPublicIds.add(visit.bedPublicId as string);
    }

    for (const visit of activeOutpatient) {
      expect(visit.stationPublicId).toBeNull();
      expect(visit.roomPublicId).toBeNull();
      expect(visit.bedPublicId).toBeNull();
      expect(visit.departmentPublicId.length).toBeGreaterThan(0);
    }

    const activePatientNumbers = activeVisits.map((v) => v.patientNumber);
    expect(new Set(activePatientNumbers).size).toBe(
      activePatientNumbers.length,
    );
    for (const number of activePatientNumbers) {
      expect(number).toMatch(/^\d{5}$/);
    }
  });

  test("reconciled OCCUPIED bed count equals the active INPATIENT visit count exactly", () => {
    const structure = generateStructure();
    const { beds, patientVisits } = generatePeople(structure);

    const activeInpatientCount = patientVisits.filter(
      (v) => v.status === "ACTIVE" && v.visitType === "INPATIENT",
    ).length;
    const occupiedBedCount = beds.filter((b) => b.status === "OCCUPIED").length;

    expect(occupiedBedCount).toBe(activeInpatientCount);
    expect(beds).toHaveLength(structure.beds.length);
    expect(new Set(beds.map((b) => b.publicId)).size).toBe(beds.length);
    for (const bed of beds) {
      expect(["FREE", "RESERVED", "OCCUPIED"]).toContain(bed.status);
    }
  });

  test("includes discharged history visits in addition to the 13240 active ones", () => {
    const structure = generateStructure();
    const { patientVisits } = generatePeople(structure);

    const discharged = patientVisits.filter((v) => v.status === "DISCHARGED");
    expect(discharged.length).toBeGreaterThan(0);
    for (const visit of discharged) {
      expect(visit.endedDate).not.toBeNull();
      expect(visit.endedTime).not.toBeNull();
    }
    expect(new Set(patientVisits.map((v) => v.publicId)).size).toBe(
      patientVisits.length,
    );
  });

  test("produces ~3 appointment types per department (~100 total)", () => {
    const structure = generateStructure();
    const { appointmentTypes } = generatePeople(structure);

    expect(appointmentTypes.length).toBeGreaterThanOrEqual(90);
    expect(appointmentTypes.length).toBeLessThanOrEqual(110);
    expect(new Set(appointmentTypes.map((a) => a.publicId)).size).toBe(
      appointmentTypes.length,
    );

    const departmentPublicIds = new Set(
      structure.departments.map((d) => d.publicId),
    );
    for (const type of appointmentTypes) {
      expect(departmentPublicIds.has(type.departmentPublicId)).toBe(true);
      expect(type.defaultDurationMinutes).toBeGreaterThan(0);
      expect(type.name.length).toBeGreaterThan(0);
    }
  });

  test("produces ~5000 appointments in the date window, unique per (type, date, time)", () => {
    const structure = generateStructure();
    const { appointments, appointmentTypes, patients } = generatePeople(
      structure,
    );

    expect(appointments.length).toBeGreaterThanOrEqual(4900);
    expect(appointments.length).toBeLessThanOrEqual(5100);
    expect(new Set(appointments.map((a) => a.publicId)).size).toBe(
      appointments.length,
    );

    const appointmentTypePublicIds = new Set(
      appointmentTypes.map((a) => a.publicId),
    );
    const patientPublicIds = new Set(patients.map((p) => p.publicId));
    const seenTriples = new Set<string>();

    for (const appointment of appointments) {
      expect(appointment.scheduledDate >= "2026-07-06").toBe(true);
      expect(appointment.scheduledDate <= "2026-07-20").toBe(true);
      expect(
        appointmentTypePublicIds.has(appointment.appointmentTypePublicId),
      ).toBe(true);
      expect(patientPublicIds.has(appointment.patientPublicId)).toBe(true);

      const triple = `${appointment.appointmentTypePublicId}|${appointment.scheduledDate}|${appointment.scheduledTime}`;
      expect(seenTriples.has(triple)).toBe(false);
      seenTriples.add(triple);
    }
  });
});
