import { and, count, eq, gt, inArray, ne, sql, sum } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { berlinTimestamp } from "../api/time";
import type { AppDatabase } from "../db/client";
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
  type AppointmentRow,
  type AppointmentTypeRow,
  type BedMaterial,
  type BedRow,
  type BedStatus,
  type BedType,
  type DepartmentRow,
  type EmployeeRow,
  type Gender,
  type InsuranceType,
  type PatientRow,
  type PatientVisitRow,
  type PatientVisitStatus,
  type PatientVisitType,
  type RoomRow,
  type RoomType,
  type SocialSecurityNumberRow,
  type StationRow,
  type StationType,
} from "../db/schema";

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  12,
);

export type CreateSocialSecurityNumber = {
  number: string;
  healthInsuranceProvider: string;
  insuranceType: InsuranceType;
};

export type CreatePatient = {
  gender: Gender;
  firstName: string;
  lastName: string;
  birthDate: string;
  birthplace: string;
  socialSecurityNumberPublicId: string;
  telephoneNumber: string;
  acceptedGdpr: boolean;
};

export type CreateDepartment = {
  name: string;
  currentCapacity: number;
  maxCapacity: number;
};

export type CreateStation = {
  name: string;
  stationType: StationType;
  departmentPublicId: string;
  building?: string;
  floor?: number;
};

export type CreateRoom = {
  name: string;
  roomType: RoomType;
  departmentPublicId: string;
  stationPublicId: string;
};

export type CreateBed = {
  bedType: BedType;
  status: BedStatus;
  material: BedMaterial;
  departmentPublicId: string;
  stationPublicId: string;
  roomPublicId: string | null;
};

export type CreatePatientVisit = {
  patientNumber: string;
  visitType: PatientVisitType;
  status: PatientVisitStatus;
  patientPublicId: string;
  departmentPublicId: string;
  stationPublicId: string | null;
  roomPublicId: string | null;
  bedPublicId: string | null;
  startedDate: string;
  startedTime: string;
  endedDate: string | null;
  endedTime: string | null;
};

export type CreateEmployee = {
  firstName: string;
  lastName: string;
  position: string;
  departmentPublicId: string;
};

export type CreateAppointmentType = {
  name: string;
  departmentPublicId: string;
  defaultDurationMinutes: number;
};

export type CreateAppointment = {
  scheduledDate: string;
  scheduledTime: string;
  patientPublicId: string;
  appointmentTypePublicId: string;
};

export type CreateAppointmentBooking = {
  healthInsuranceNumber: string;
  birthDate: string;
  appointmentTypePublicId: string;
  scheduledDate: string;
  scheduledTime: string;
};

export type CreateAppointmentCancellation = CreateAppointmentBooking;

export type CreateAppointmentReschedule = {
  healthInsuranceNumber: string;
  birthDate: string;
  appointmentTypePublicId: string;
  fromScheduledDate: string;
  fromScheduledTime: string;
  toScheduledDate: string;
  toScheduledTime: string;
};

export type PatientAppointmentSummary = {
  employee: string | null;
  department: string;
  appointmentType: string;
  scheduledDate: string;
  scheduledTime: string;
};

export type OpsSummary = {
  beds: {
    total: number;
    free: number;
    reserved: number;
    occupied: number;
  };
  capacity: {
    current: number;
    max: number;
  };
  visits: {
    active: number;
    activeInpatient: number;
    activeOutpatient: number;
    discharged: number;
  };
  patients: { total: number };
  employees: { total: number };
  departments: { total: number };
  wards: { total: number };
  appointmentsOnDate: number;
};

export type StationWithDepartment = {
  station: StationRow;
  department: DepartmentRow;
};

/**
 * One (building, level) nav-tree entry for `GET /v1/ops/floors`. `level` is
 * the 0-indexed floor exposed by the API (0 = EG); the underlying `stations`
 * table stores a 1-indexed `floor` column, so the repository translates
 * `level = floor - 1` at the boundary.
 */
export type FloorSummary = {
  building: string;
  level: number;
  wardCount: number;
  bedTotal: number;
  occupied: number;
};

export type FloorBedPatient = {
  firstName: string;
  lastName: string;
  patientNumber: string;
};

export type FloorBed = {
  bed: BedRow;
  patient: FloorBedPatient | null;
};

export type FloorRoom = {
  room: RoomRow;
  bedCapacity: number;
  currentCapacity: number;
  beds: FloorBed[];
};

export type FloorWard = {
  station: StationRow;
  department: DepartmentRow;
  rooms: FloorRoom[];
};

export type FloorDetail = {
  building: string;
  level: number;
  wards: FloorWard[];
};

export type RoomWithDetails = {
  room: RoomRow;
  department: DepartmentRow;
  station: StationRow;
};

export type RoomWithCapacity = RoomWithDetails & {
  bedCapacity: number;
  currentCapacity: number;
};

export type BedWithDetails = {
  bed: BedRow;
  department: DepartmentRow;
  station: StationRow;
  room: RoomRow | null;
};

export type PatientVisitWithDetails = {
  patientVisit: PatientVisitRow;
  patient: PatientRow;
  department: DepartmentRow;
  station: StationRow | null;
  room: RoomRow | null;
  bed: BedRow | null;
};

export type AvailableMovementRoom = {
  room: RoomRow;
  department: DepartmentRow;
  station: StationRow;
  bedCapacity: number;
  currentCapacity: number;
  availableBeds: BedRow[];
};

export type PatientWithSocialSecurityNumber = {
  patient: PatientRow;
  socialSecurityNumber: SocialSecurityNumberRow;
};

export type EmployeeWithDepartment = {
  employee: EmployeeRow;
  department: DepartmentRow;
};

export type AppointmentTypeWithDepartment = {
  appointmentType: AppointmentTypeRow;
  department: DepartmentRow;
};

export type AppointmentWithDetails = {
  appointment: AppointmentRow;
  patient: PatientRow;
  appointmentType: AppointmentTypeRow;
  department: DepartmentRow;
};

export type RoomBedOccupant = {
  patient: PatientRow;
  patientNumber: string;
  visitPublicId: string;
};

export type RoomOccupancy = {
  room: RoomWithCapacity;
  beds: { bed: BedRow; occupant: RoomBedOccupant | null }[];
};

export type PatientOverview = {
  patient: PatientWithSocialSecurityNumber;
  currentVisit: PatientVisitWithDetails | null;
  appointments: AppointmentWithDetails[];
};

export type CreateAppointmentResult =
  | { status: "CREATED"; value: AppointmentWithDetails }
  | { status: "PATIENT_NOT_FOUND" }
  | { status: "APPOINTMENT_TYPE_NOT_FOUND" };

export type CreateAppointmentBookingResult =
  | { status: "CREATED"; value: AppointmentWithDetails }
  | { status: "PATIENT_NOT_FOUND" }
  | { status: "APPOINTMENT_TYPE_NOT_FOUND" }
  | { status: "SLOT_BOOKED" };

export type AppointmentMutationResult =
  | { status: "OK"; value: AppointmentWithDetails }
  | { status: "PATIENT_NOT_FOUND" }
  | { status: "APPOINTMENT_TYPE_NOT_FOUND" }
  | { status: "APPOINTMENT_NOT_FOUND" }
  | { status: "SLOT_BOOKED" };

export type AppointmentCancellationResult = Exclude<
  AppointmentMutationResult,
  { status: "SLOT_BOOKED" }
>;

export type PatientAppointmentSearchResult =
  | { status: "OK"; data: PatientAppointmentSummary[] }
  | { status: "PATIENT_NOT_FOUND" };

export type CreateStationResult =
  | { status: "CREATED"; value: StationWithDepartment }
  | { status: "DEPARTMENT_NOT_FOUND" };

export type CreateRoomResult =
  | { status: "CREATED"; value: RoomWithCapacity }
  | { status: "DEPARTMENT_NOT_FOUND" }
  | { status: "STATION_NOT_FOUND" }
  | { status: "INVALID_PARENT" };

export type CreateBedResult =
  | { status: "CREATED"; value: BedWithDetails }
  | { status: "DEPARTMENT_NOT_FOUND" }
  | { status: "STATION_NOT_FOUND" }
  | { status: "ROOM_NOT_FOUND" }
  | { status: "INVALID_PARENT" };

export type CreatePatientVisitResult =
  | { status: "CREATED"; value: PatientVisitWithDetails }
  | { status: "PATIENT_NOT_FOUND" }
  | { status: "DEPARTMENT_NOT_FOUND" }
  | { status: "STATION_NOT_FOUND" }
  | { status: "ROOM_NOT_FOUND" }
  | { status: "BED_NOT_FOUND" }
  | { status: "INVALID_PARENT" }
  | { status: "ACTIVE_NUMBER_CONFLICT" };

export type AvailableMovementBedsResult =
  | { status: "OK"; value: AvailableMovementRoom[] }
  | { status: "PATIENT_VISIT_NOT_FOUND" }
  | { status: "DEPARTMENT_NOT_FOUND" };

export type PatientMovementResult =
  | {
      status: "OK";
      value: {
        patientVisit: PatientVisitWithDetails;
        fromBedPublicId: string | null;
        targetBed: BedRow;
      };
    }
  | { status: "PATIENT_VISIT_NOT_FOUND" }
  | { status: "BED_NOT_FOUND" }
  | { status: "BED_NOT_AVAILABLE" }
  | { status: "BED_HAS_NO_ROOM" };

export type PatientMovementCompletionResult =
  | {
      status: "OK";
      value: {
        patientVisit: PatientVisitWithDetails;
        bed: BedRow;
      };
    }
  | { status: "PATIENT_VISIT_NOT_FOUND" }
  | { status: "BED_NOT_RESERVED" };

export function createHealthcareRepository(db: AppDatabase) {
  return {
    createSocialSecurityNumber(input: CreateSocialSecurityNumber) {
      const now = berlinTimestamp();

      return db
        .insert(socialSecurityNumbers)
        .values({
          publicId: publicId("ssn"),
          number: input.number,
          healthInsuranceProvider: input.healthInsuranceProvider,
          insuranceType: input.insuranceType,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
    },

    listSocialSecurityNumbers(
      afterPublicId: string | undefined,
      pageSize: number,
    ) {
      const cursorRow = afterPublicId
        ? this.getSocialSecurityNumber(afterPublicId)
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select()
        .from(socialSecurityNumbers)
        .where(
          cursorRow ? gt(socialSecurityNumbers.id, cursorRow.id) : undefined,
        )
        .orderBy(socialSecurityNumbers.id)
        .limit(pageSize + 1)
        .all();

      return pageRows(rows, pageSize, (row) => row.publicId);
    },

    getSocialSecurityNumber(publicId: string) {
      return db
        .select()
        .from(socialSecurityNumbers)
        .where(eq(socialSecurityNumbers.publicId, publicId))
        .get();
    },

    createDepartment(input: CreateDepartment) {
      const now = berlinTimestamp();

      return db
        .insert(departments)
        .values({
          publicId: publicId("dep"),
          name: input.name,
          currentCapacity: input.currentCapacity,
          maxCapacity: input.maxCapacity,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
    },

    listDepartments(afterPublicId: string | undefined, pageSize: number) {
      const cursorRow = afterPublicId
        ? this.getDepartment(afterPublicId)
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select()
        .from(departments)
        .where(cursorRow ? gt(departments.id, cursorRow.id) : undefined)
        .orderBy(departments.id)
        .limit(pageSize + 1)
        .all();

      return pageRows(rows, pageSize, (row) => row.publicId);
    },

    getDepartment(publicId: string) {
      return db
        .select()
        .from(departments)
        .where(eq(departments.publicId, publicId))
        .get();
    },

    createStation(input: CreateStation): CreateStationResult {
      const department = this.getDepartment(input.departmentPublicId);

      if (!department) {
        return { status: "DEPARTMENT_NOT_FOUND" };
      }

      const now = berlinTimestamp();
      const station = db
        .insert(stations)
        .values({
          publicId: publicId("sta"),
          name: input.name,
          stationType: input.stationType,
          departmentId: department.id,
          ...(input.building !== undefined ? { building: input.building } : {}),
          ...(input.floor !== undefined ? { floor: input.floor } : {}),
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      return {
        status: "CREATED",
        value: {
          station,
          department,
        },
      };
    },

    listStations(afterPublicId: string | undefined, pageSize: number) {
      const cursorRow = afterPublicId
        ? db
            .select()
            .from(stations)
            .where(eq(stations.publicId, afterPublicId))
            .get()
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select({
          station: stations,
          department: departments,
        })
        .from(stations)
        .innerJoin(departments, eq(stations.departmentId, departments.id))
        .where(cursorRow ? gt(stations.id, cursorRow.id) : undefined)
        .orderBy(stations.id)
        .limit(pageSize + 1)
        .all();

      return pageRows(rows, pageSize, (row) => row.station.publicId);
    },

    getStation(publicId: string): StationWithDepartment | undefined {
      return db
        .select({
          station: stations,
          department: departments,
        })
        .from(stations)
        .innerJoin(departments, eq(stations.departmentId, departments.id))
        .where(eq(stations.publicId, publicId))
        .get();
    },

    createRoom(input: CreateRoom): CreateRoomResult {
      const department = this.getDepartment(input.departmentPublicId);

      if (!department) {
        return { status: "DEPARTMENT_NOT_FOUND" };
      }

      const station = this.getStation(input.stationPublicId);

      if (!station) {
        return { status: "STATION_NOT_FOUND" };
      }

      if (station.station.departmentId !== department.id) {
        return { status: "INVALID_PARENT" };
      }

      const now = berlinTimestamp();
      const room = db
        .insert(rooms)
        .values({
          publicId: publicId("roo"),
          name: input.name,
          roomType: input.roomType,
          departmentId: department.id,
          stationId: station.station.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      return {
        status: "CREATED",
        value: this.roomWithCapacity({
          room,
          department,
          station: station.station,
        }),
      };
    },

    listRooms(afterPublicId: string | undefined, pageSize: number) {
      const cursorRow = afterPublicId
        ? db
            .select()
            .from(rooms)
            .where(eq(rooms.publicId, afterPublicId))
            .get()
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select({
          room: rooms,
          department: departments,
          station: stations,
        })
        .from(rooms)
        .innerJoin(departments, eq(rooms.departmentId, departments.id))
        .innerJoin(stations, eq(rooms.stationId, stations.id))
        .where(cursorRow ? gt(rooms.id, cursorRow.id) : undefined)
        .orderBy(rooms.id)
        .limit(pageSize + 1)
        .all()
        .map((row) => this.roomWithCapacity(row));

      return pageRows(rows, pageSize, (row) => row.room.publicId);
    },

    getRoom(publicId: string): RoomWithCapacity | undefined {
      const row = db
        .select({
          room: rooms,
          department: departments,
          station: stations,
        })
        .from(rooms)
        .innerJoin(departments, eq(rooms.departmentId, departments.id))
        .innerJoin(stations, eq(rooms.stationId, stations.id))
        .where(eq(rooms.publicId, publicId))
        .get();

      return row ? this.roomWithCapacity(row) : undefined;
    },

    createBed(input: CreateBed): CreateBedResult {
      const department = this.getDepartment(input.departmentPublicId);

      if (!department) {
        return { status: "DEPARTMENT_NOT_FOUND" };
      }

      const station = this.getStation(input.stationPublicId);

      if (!station) {
        return { status: "STATION_NOT_FOUND" };
      }

      if (station.station.departmentId !== department.id) {
        return { status: "INVALID_PARENT" };
      }

      const room = input.roomPublicId ? this.getRoom(input.roomPublicId) : null;

      if (input.roomPublicId && !room) {
        return { status: "ROOM_NOT_FOUND" };
      }

      if (
        room &&
        (room.room.departmentId !== department.id ||
          room.room.stationId !== station.station.id)
      ) {
        return { status: "INVALID_PARENT" };
      }

      const now = berlinTimestamp();
      const bed = db
        .insert(beds)
        .values({
          publicId: publicId("bed"),
          bedType: input.bedType,
          status: input.status,
          material: input.material,
          departmentId: department.id,
          stationId: station.station.id,
          roomId: room?.room.id ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      return {
        status: "CREATED",
        value: {
          bed,
          department,
          station: station.station,
          room: room?.room ?? null,
        },
      };
    },

    listBeds(afterPublicId: string | undefined, pageSize: number) {
      const cursorRow = afterPublicId
        ? db
            .select()
            .from(beds)
            .where(eq(beds.publicId, afterPublicId))
            .get()
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select({
          bed: beds,
          department: departments,
          station: stations,
        })
        .from(beds)
        .innerJoin(departments, eq(beds.departmentId, departments.id))
        .innerJoin(stations, eq(beds.stationId, stations.id))
        .where(cursorRow ? gt(beds.id, cursorRow.id) : undefined)
        .orderBy(beds.id)
        .limit(pageSize + 1)
        .all()
        .map((row) => ({
          ...row,
          room: row.bed.roomId
            ? this.getRoomByInternalId(row.bed.roomId) ?? null
            : null,
        }));

      return pageRows(rows, pageSize, (row) => row.bed.publicId);
    },

    getBed(publicId: string): BedWithDetails | undefined {
      const row = db
        .select({
          bed: beds,
          department: departments,
          station: stations,
        })
        .from(beds)
        .innerJoin(departments, eq(beds.departmentId, departments.id))
        .innerJoin(stations, eq(beds.stationId, stations.id))
        .where(eq(beds.publicId, publicId))
        .get();

      if (!row) {
        return undefined;
      }

      return {
        ...row,
        room: row.bed.roomId
          ? this.getRoomByInternalId(row.bed.roomId) ?? null
          : null,
      };
    },

    getRoomByInternalId(id: number): RoomRow | undefined {
      return db.select().from(rooms).where(eq(rooms.id, id)).get();
    },

    roomWithCapacity(row: RoomWithDetails): RoomWithCapacity {
      const roomBeds = db
        .select()
        .from(beds)
        .where(eq(beds.roomId, row.room.id))
        .all();

      return {
        ...row,
        bedCapacity: roomBeds.length,
        currentCapacity: roomBeds.filter((bed) => bed.status === "OCCUPIED")
          .length,
      };
    },

    createPatientVisit(input: CreatePatientVisit): CreatePatientVisitResult {
      const patient = this.getPatient(input.patientPublicId);

      if (!patient) {
        return { status: "PATIENT_NOT_FOUND" };
      }

      const department = this.getDepartment(input.departmentPublicId);

      if (!department) {
        return { status: "DEPARTMENT_NOT_FOUND" };
      }

      const activeNumber = db
        .select()
        .from(patientVisits)
        .where(
          and(
            eq(patientVisits.patientNumber, input.patientNumber),
            eq(patientVisits.status, "ACTIVE"),
          ),
        )
        .get();

      if (input.status === "ACTIVE" && activeNumber) {
        return { status: "ACTIVE_NUMBER_CONFLICT" };
      }

      const station = input.stationPublicId
        ? this.getStation(input.stationPublicId)
        : null;

      if (input.stationPublicId && !station) {
        return { status: "STATION_NOT_FOUND" };
      }

      if (station && station.station.departmentId !== department.id) {
        return { status: "INVALID_PARENT" };
      }

      const room = input.roomPublicId ? this.getRoom(input.roomPublicId) : null;

      if (input.roomPublicId && !room) {
        return { status: "ROOM_NOT_FOUND" };
      }

      if (
        room &&
        (room.room.departmentId !== department.id ||
          (station && room.room.stationId !== station.station.id))
      ) {
        return { status: "INVALID_PARENT" };
      }

      const bed = input.bedPublicId ? this.getBed(input.bedPublicId) : null;

      if (input.bedPublicId && !bed) {
        return { status: "BED_NOT_FOUND" };
      }

      if (
        bed &&
        (bed.bed.departmentId !== department.id ||
          (station && bed.bed.stationId !== station.station.id) ||
          (room && bed.bed.roomId !== room.room.id))
      ) {
        return { status: "INVALID_PARENT" };
      }

      const now = berlinTimestamp();
      const patientVisit = db
        .insert(patientVisits)
        .values({
          publicId: publicId("pvi"),
          patientNumber: input.patientNumber,
          visitType: input.visitType,
          status: input.status,
          patientId: patient.patient.id,
          departmentId: department.id,
          stationId: station?.station.id ?? null,
          roomId: room?.room.id ?? null,
          bedId: bed?.bed.id ?? null,
          startedDate: input.startedDate,
          startedTime: input.startedTime,
          endedDate: input.endedDate,
          endedTime: input.endedTime,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      return {
        status: "CREATED",
        value: {
          patientVisit,
          patient: patient.patient,
          department,
          station: station?.station ?? null,
          room: room?.room ?? null,
          bed: bed?.bed ?? null,
        },
      };
    },

    listPatientVisits(afterPublicId: string | undefined, pageSize: number) {
      const cursorRow = afterPublicId
        ? db
            .select()
            .from(patientVisits)
            .where(eq(patientVisits.publicId, afterPublicId))
            .get()
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select({
          patientVisit: patientVisits,
          patient: patients,
          department: departments,
        })
        .from(patientVisits)
        .innerJoin(patients, eq(patientVisits.patientId, patients.id))
        .innerJoin(departments, eq(patientVisits.departmentId, departments.id))
        .where(cursorRow ? gt(patientVisits.id, cursorRow.id) : undefined)
        .orderBy(patientVisits.id)
        .limit(pageSize + 1)
        .all()
        .map((row) => this.patientVisitWithDetails(row));

      return pageRows(rows, pageSize, (row) => row.patientVisit.publicId);
    },

    getPatientVisit(publicId: string): PatientVisitWithDetails | undefined {
      const row = db
        .select({
          patientVisit: patientVisits,
          patient: patients,
          department: departments,
        })
        .from(patientVisits)
        .innerJoin(patients, eq(patientVisits.patientId, patients.id))
        .innerJoin(departments, eq(patientVisits.departmentId, departments.id))
        .where(eq(patientVisits.publicId, publicId))
        .get();

      return row ? this.patientVisitWithDetails(row) : undefined;
    },

    getActivePatientVisitByNumber(
      patientNumber: string,
    ): PatientVisitWithDetails | undefined {
      const row = db
        .select({
          patientVisit: patientVisits,
          patient: patients,
          department: departments,
        })
        .from(patientVisits)
        .innerJoin(patients, eq(patientVisits.patientId, patients.id))
        .innerJoin(departments, eq(patientVisits.departmentId, departments.id))
        .where(
          and(
            eq(patientVisits.patientNumber, patientNumber),
            eq(patientVisits.status, "ACTIVE"),
          ),
        )
        .get();

      return row ? this.patientVisitWithDetails(row) : undefined;
    },

    listAvailableMovementBeds(input: {
      patientNumber: string;
      targetDepartmentPublicId: string;
    }): AvailableMovementBedsResult {
      const activeVisit = this.getActivePatientVisitByNumber(
        input.patientNumber,
      );

      if (!activeVisit) {
        return { status: "PATIENT_VISIT_NOT_FOUND" };
      }

      const department = this.getDepartment(input.targetDepartmentPublicId);

      if (!department) {
        return { status: "DEPARTMENT_NOT_FOUND" };
      }

      const freeBeds = db
        .select({
          bed: beds,
          room: rooms,
          station: stations,
        })
        .from(beds)
        .innerJoin(rooms, eq(beds.roomId, rooms.id))
        .innerJoin(stations, eq(beds.stationId, stations.id))
        .where(
          and(
            eq(beds.departmentId, department.id),
            eq(beds.status, "FREE"),
          ),
        )
        .orderBy(rooms.id, beds.id)
        .all();

      const grouped = new Map<number, AvailableMovementRoom>();

      for (const row of freeBeds) {
        const existing = grouped.get(row.room.id);
        if (existing) {
          existing.availableBeds.push(row.bed);
          continue;
        }

        const roomBeds = db
          .select()
          .from(beds)
          .where(eq(beds.roomId, row.room.id))
          .all();

        grouped.set(row.room.id, {
          room: row.room,
          department,
          station: row.station,
          bedCapacity: roomBeds.length,
          currentCapacity: roomBeds.filter((bed) => bed.status === "OCCUPIED")
            .length,
          availableBeds: [row.bed],
        });
      }

      return { status: "OK", value: Array.from(grouped.values()) };
    },

    movePatientToBed(input: {
      patientNumber: string;
      targetBedPublicId: string;
    }): PatientMovementResult {
      const activeVisit = this.getActivePatientVisitByNumber(
        input.patientNumber,
      );

      if (!activeVisit) {
        return { status: "PATIENT_VISIT_NOT_FOUND" };
      }

      const targetBed = this.getBed(input.targetBedPublicId);

      if (!targetBed) {
        return { status: "BED_NOT_FOUND" };
      }

      if (!targetBed.room) {
        return { status: "BED_HAS_NO_ROOM" };
      }

      if (targetBed.bed.status !== "FREE") {
        return { status: "BED_NOT_AVAILABLE" };
      }

      const now = berlinTimestamp();
      const fromBedPublicId = activeVisit.bed?.publicId ?? null;

      return db.transaction(() => {
        if (activeVisit.bed) {
          db.update(beds)
            .set({ status: "FREE", updatedAt: now })
            .where(eq(beds.id, activeVisit.bed.id))
            .run();
        }

        const reservedBed = db
          .update(beds)
          .set({ status: "RESERVED", updatedAt: now })
          .where(eq(beds.id, targetBed.bed.id))
          .returning()
          .get();

        db.update(patientVisits)
          .set({
            visitType: "INPATIENT",
            departmentId: targetBed.department.id,
            stationId: targetBed.station.id,
            roomId: targetBed.room!.id,
            bedId: targetBed.bed.id,
            updatedAt: now,
          })
          .where(eq(patientVisits.id, activeVisit.patientVisit.id))
          .run();

        return {
          status: "OK" as const,
          value: {
            patientVisit: this.getActivePatientVisitByNumber(
              input.patientNumber,
            )!,
            fromBedPublicId,
            targetBed: reservedBed,
          },
        };
      });
    },

    completePatientMovement(input: {
      patientNumber: string;
    }): PatientMovementCompletionResult {
      const activeVisit = this.getActivePatientVisitByNumber(
        input.patientNumber,
      );

      if (!activeVisit) {
        return { status: "PATIENT_VISIT_NOT_FOUND" };
      }

      if (!activeVisit.bed || activeVisit.bed.status !== "RESERVED") {
        return { status: "BED_NOT_RESERVED" };
      }

      const now = berlinTimestamp();

      return db.transaction(() => {
        const occupiedBed = db
          .update(beds)
          .set({ status: "OCCUPIED", updatedAt: now })
          .where(eq(beds.id, activeVisit.bed!.id))
          .returning()
          .get();

        db.update(patientVisits)
          .set({ updatedAt: now })
          .where(eq(patientVisits.id, activeVisit.patientVisit.id))
          .run();

        return {
          status: "OK" as const,
          value: {
            patientVisit: this.getActivePatientVisitByNumber(
              input.patientNumber,
            )!,
            bed: occupiedBed,
          },
        };
      });
    },

    patientVisitWithDetails(row: {
      patientVisit: PatientVisitRow;
      patient: PatientRow;
      department: DepartmentRow;
    }): PatientVisitWithDetails {
      return {
        ...row,
        station: row.patientVisit.stationId
          ? this.getStationByInternalId(row.patientVisit.stationId) ?? null
          : null,
        room: row.patientVisit.roomId
          ? this.getRoomByInternalId(row.patientVisit.roomId) ?? null
          : null,
        bed: row.patientVisit.bedId
          ? this.getBedByInternalId(row.patientVisit.bedId) ?? null
          : null,
      };
    },

    getStationByInternalId(id: number): StationRow | undefined {
      return db.select().from(stations).where(eq(stations.id, id)).get();
    },

    getBedByInternalId(id: number): BedRow | undefined {
      return db.select().from(beds).where(eq(beds.id, id)).get();
    },

    createEmployee(input: CreateEmployee): EmployeeWithDepartment | undefined {
      const department = this.getDepartment(input.departmentPublicId);

      if (!department) {
        return undefined;
      }

      const now = berlinTimestamp();
      const employee = db
        .insert(employees)
        .values({
          publicId: publicId("emp"),
          firstName: input.firstName,
          lastName: input.lastName,
          position: input.position,
          departmentId: department.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      return {
        employee,
        department,
      };
    },

    listEmployees(afterPublicId: string | undefined, pageSize: number) {
      const cursorRow = afterPublicId
        ? db
            .select()
            .from(employees)
            .where(eq(employees.publicId, afterPublicId))
            .get()
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select({
          employee: employees,
          department: departments,
        })
        .from(employees)
        .innerJoin(departments, eq(employees.departmentId, departments.id))
        .where(cursorRow ? gt(employees.id, cursorRow.id) : undefined)
        .orderBy(employees.id)
        .limit(pageSize + 1)
        .all();

      return pageRows(rows, pageSize, (row) => row.employee.publicId);
    },

    getEmployee(publicId: string): EmployeeWithDepartment | undefined {
      return db
        .select({
          employee: employees,
          department: departments,
        })
        .from(employees)
        .innerJoin(departments, eq(employees.departmentId, departments.id))
        .where(eq(employees.publicId, publicId))
        .get();
    },

    createAppointmentType(
      input: CreateAppointmentType,
    ): AppointmentTypeWithDepartment | undefined {
      const department = this.getDepartment(input.departmentPublicId);

      if (!department) {
        return undefined;
      }

      const now = berlinTimestamp();
      const appointmentType = db
        .insert(appointmentTypes)
        .values({
          publicId: publicId("aty"),
          name: input.name,
          departmentId: department.id,
          defaultDurationMinutes: input.defaultDurationMinutes,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      return {
        appointmentType,
        department,
      };
    },

    listAppointmentTypes(
      afterPublicId: string | undefined,
      pageSize: number,
      departmentId?: number,
    ) {
      const cursorRow = afterPublicId
        ? db
            .select()
            .from(appointmentTypes)
            .where(eq(appointmentTypes.publicId, afterPublicId))
            .get()
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select({
          appointmentType: appointmentTypes,
          department: departments,
        })
        .from(appointmentTypes)
        .innerJoin(departments, eq(appointmentTypes.departmentId, departments.id))
        .where(
          and(
            cursorRow ? gt(appointmentTypes.id, cursorRow.id) : undefined,
            departmentId !== undefined
              ? eq(appointmentTypes.departmentId, departmentId)
              : undefined,
          ),
        )
        .orderBy(appointmentTypes.id)
        .limit(pageSize + 1)
        .all();

      return pageRows(rows, pageSize, (row) => row.appointmentType.publicId);
    },

    getAppointmentType(
      publicId: string,
    ): AppointmentTypeWithDepartment | undefined {
      return db
        .select({
          appointmentType: appointmentTypes,
          department: departments,
        })
        .from(appointmentTypes)
        .innerJoin(departments, eq(appointmentTypes.departmentId, departments.id))
        .where(eq(appointmentTypes.publicId, publicId))
        .get();
    },

    listBookedAppointmentsForAppointmentType(publicId: string) {
      const appointmentType = this.getAppointmentType(publicId);

      if (!appointmentType) {
        return undefined;
      }

      return db
        .select()
        .from(appointments)
        .where(eq(appointments.appointmentTypeId, appointmentType.appointmentType.id))
        .all();
    },

    createAppointment(input: CreateAppointment): CreateAppointmentResult {
      const patient = this.getPatient(input.patientPublicId);

      if (!patient) {
        return { status: "PATIENT_NOT_FOUND" };
      }

      const appointmentType = this.getAppointmentType(
        input.appointmentTypePublicId,
      );

      if (!appointmentType) {
        return { status: "APPOINTMENT_TYPE_NOT_FOUND" };
      }

      const now = berlinTimestamp();
      const appointment = db
        .insert(appointments)
        .values({
          publicId: publicId("app"),
          scheduledDate: input.scheduledDate,
          scheduledTime: input.scheduledTime,
          patientId: patient.patient.id,
          appointmentTypeId: appointmentType.appointmentType.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      return {
        status: "CREATED",
        value: {
          appointment,
          patient: patient.patient,
          appointmentType: appointmentType.appointmentType,
          department: appointmentType.department,
        },
      };
    },

    createAppointmentBooking(
      input: CreateAppointmentBooking,
    ): CreateAppointmentBookingResult {
      const patient = this.getPatientByInsuranceNumberAndBirthDate(
        input.healthInsuranceNumber,
        input.birthDate,
      );

      if (!patient) {
        return { status: "PATIENT_NOT_FOUND" };
      }

      const appointmentType = this.getAppointmentType(
        input.appointmentTypePublicId,
      );

      if (!appointmentType) {
        return { status: "APPOINTMENT_TYPE_NOT_FOUND" };
      }

      if (
        this.isAppointmentSlotBooked(
          appointmentType.appointmentType.id,
          input.scheduledDate,
          input.scheduledTime,
        )
      ) {
        return { status: "SLOT_BOOKED" };
      }

      const now = berlinTimestamp();
      const appointment = db
        .insert(appointments)
        .values({
          publicId: publicId("app"),
          scheduledDate: input.scheduledDate,
          scheduledTime: input.scheduledTime,
          patientId: patient.patient.id,
          appointmentTypeId: appointmentType.appointmentType.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      return {
        status: "CREATED",
        value: {
          appointment,
          patient: patient.patient,
          appointmentType: appointmentType.appointmentType,
          department: appointmentType.department,
        },
      };
    },

    cancelAppointment(
      input: CreateAppointmentCancellation,
    ): AppointmentCancellationResult {
      const patient = this.getPatientByInsuranceNumberAndBirthDate(
        input.healthInsuranceNumber,
        input.birthDate,
      );

      if (!patient) {
        return { status: "PATIENT_NOT_FOUND" };
      }

      const appointmentType = this.getAppointmentType(
        input.appointmentTypePublicId,
      );

      if (!appointmentType) {
        return { status: "APPOINTMENT_TYPE_NOT_FOUND" };
      }

      const appointment = this.findPatientAppointment(
        patient.patient.id,
        appointmentType.appointmentType.id,
        input.scheduledDate,
        input.scheduledTime,
      );

      if (!appointment) {
        return { status: "APPOINTMENT_NOT_FOUND" };
      }

      const value = {
        appointment,
        patient: patient.patient,
        appointmentType: appointmentType.appointmentType,
        department: appointmentType.department,
      };

      db.delete(appointments).where(eq(appointments.id, appointment.id)).run();

      return {
        status: "OK",
        value,
      };
    },

    rescheduleAppointment(
      input: CreateAppointmentReschedule,
    ): AppointmentMutationResult {
      const patient = this.getPatientByInsuranceNumberAndBirthDate(
        input.healthInsuranceNumber,
        input.birthDate,
      );

      if (!patient) {
        return { status: "PATIENT_NOT_FOUND" };
      }

      const appointmentType = this.getAppointmentType(
        input.appointmentTypePublicId,
      );

      if (!appointmentType) {
        return { status: "APPOINTMENT_TYPE_NOT_FOUND" };
      }

      const appointment = this.findPatientAppointment(
        patient.patient.id,
        appointmentType.appointmentType.id,
        input.fromScheduledDate,
        input.fromScheduledTime,
      );

      if (!appointment) {
        return { status: "APPOINTMENT_NOT_FOUND" };
      }

      if (
        this.isAppointmentSlotBooked(
          appointmentType.appointmentType.id,
          input.toScheduledDate,
          input.toScheduledTime,
          appointment.id,
        )
      ) {
        return { status: "SLOT_BOOKED" };
      }

      const updatedAppointment = db
        .update(appointments)
        .set({
          scheduledDate: input.toScheduledDate,
          scheduledTime: input.toScheduledTime,
          updatedAt: berlinTimestamp(),
        })
        .where(eq(appointments.id, appointment.id))
        .returning()
        .get();

      return {
        status: "OK",
        value: {
          appointment: updatedAppointment,
          patient: patient.patient,
          appointmentType: appointmentType.appointmentType,
          department: appointmentType.department,
        },
      };
    },

    isAppointmentSlotBooked(
      appointmentTypeId: number,
      scheduledDate: string,
      scheduledTime: string,
      exceptAppointmentId?: number,
    ) {
      return Boolean(
        db
          .select()
          .from(appointments)
          .where(
            exceptAppointmentId
              ? and(
                  eq(appointments.appointmentTypeId, appointmentTypeId),
                  ne(appointments.id, exceptAppointmentId),
                )
              : eq(appointments.appointmentTypeId, appointmentTypeId),
          )
          .all()
          .find(
            (appointment) =>
              appointment.scheduledDate === scheduledDate &&
              appointment.scheduledTime === scheduledTime,
          ),
      );
    },

    findPatientAppointment(
      patientId: number,
      appointmentTypeId: number,
      scheduledDate: string,
      scheduledTime: string,
    ) {
      return db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.patientId, patientId),
            eq(appointments.appointmentTypeId, appointmentTypeId),
          ),
        )
        .all()
        .find(
          (appointment) =>
            appointment.scheduledDate === scheduledDate &&
            appointment.scheduledTime === scheduledTime,
        );
    },

    listAppointments(
      afterPublicId: string | undefined,
      pageSize: number,
      date?: string,
    ) {
      const cursorRow = afterPublicId
        ? db
            .select()
            .from(appointments)
            .where(eq(appointments.publicId, afterPublicId))
            .get()
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select({
          appointment: appointments,
          patient: patients,
          appointmentType: appointmentTypes,
          department: departments,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(
          appointmentTypes,
          eq(appointments.appointmentTypeId, appointmentTypes.id),
        )
        .innerJoin(departments, eq(appointmentTypes.departmentId, departments.id))
        .where(
          and(
            cursorRow ? gt(appointments.id, cursorRow.id) : undefined,
            date !== undefined ? eq(appointments.scheduledDate, date) : undefined,
          ),
        )
        .orderBy(appointments.id)
        .limit(pageSize + 1)
        .all();

      return pageRows(rows, pageSize, (row) => row.appointment.publicId);
    },

    getAppointment(publicId: string): AppointmentWithDetails | undefined {
      return db
        .select({
          appointment: appointments,
          patient: patients,
          appointmentType: appointmentTypes,
          department: departments,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(
          appointmentTypes,
          eq(appointments.appointmentTypeId, appointmentTypes.id),
        )
        .innerJoin(departments, eq(appointmentTypes.departmentId, departments.id))
        .where(eq(appointments.publicId, publicId))
        .get();
    },

    createPatient(input: CreatePatient): PatientWithSocialSecurityNumber | undefined {
      const socialSecurityNumber = this.getSocialSecurityNumber(
        input.socialSecurityNumberPublicId,
      );

      if (!socialSecurityNumber) {
        return undefined;
      }

      const now = berlinTimestamp();
      const patient = db
        .insert(patients)
        .values({
          publicId: publicId("pat"),
          gender: input.gender,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate,
          birthplace: input.birthplace,
          socialSecurityNumberId: socialSecurityNumber.id,
          telephoneNumber: input.telephoneNumber,
          acceptedGdpr: input.acceptedGdpr,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      return {
        patient,
        socialSecurityNumber,
      };
    },

    listPatients(afterPublicId: string | undefined, pageSize: number) {
      const cursorRow = afterPublicId
        ? db
            .select()
            .from(patients)
            .where(eq(patients.publicId, afterPublicId))
            .get()
        : undefined;

      if (afterPublicId && !cursorRow) {
        return { data: [], nextPublicId: undefined };
      }

      const rows = db
        .select({
          patient: patients,
          socialSecurityNumber: socialSecurityNumbers,
        })
        .from(patients)
        .innerJoin(
          socialSecurityNumbers,
          eq(patients.socialSecurityNumberId, socialSecurityNumbers.id),
        )
        .where(cursorRow ? gt(patients.id, cursorRow.id) : undefined)
        .orderBy(patients.id)
        .limit(pageSize + 1)
        .all();

      return pageRows(rows, pageSize, (row) => row.patient.publicId);
    },

    getPatient(publicId: string): PatientWithSocialSecurityNumber | undefined {
      return db
        .select({
          patient: patients,
          socialSecurityNumber: socialSecurityNumbers,
        })
        .from(patients)
        .innerJoin(
          socialSecurityNumbers,
          eq(patients.socialSecurityNumberId, socialSecurityNumbers.id),
        )
        .where(eq(patients.publicId, publicId))
        .get();
    },

    getPatientByInsuranceNumberAndBirthDate(
      insuranceNumber: string,
      birthDate: string,
    ): PatientWithSocialSecurityNumber | undefined {
      return db
        .select({
          patient: patients,
          socialSecurityNumber: socialSecurityNumbers,
        })
        .from(patients)
        .innerJoin(
          socialSecurityNumbers,
          eq(patients.socialSecurityNumberId, socialSecurityNumbers.id),
        )
        .where(eq(socialSecurityNumbers.number, insuranceNumber))
        .all()
        .find((row) => row.patient.birthDate === birthDate);
    },

    listPatientAppointmentSummaries(
      insuranceNumber: string,
      birthDate: string,
    ): PatientAppointmentSearchResult {
      const patient = this.getPatientByInsuranceNumberAndBirthDate(
        insuranceNumber,
        birthDate,
      );

      if (!patient) {
        return { status: "PATIENT_NOT_FOUND" };
      }

      const rows = db
        .select({
          appointment: appointments,
          appointmentType: appointmentTypes,
          department: departments,
        })
        .from(appointments)
        .innerJoin(
          appointmentTypes,
          eq(appointments.appointmentTypeId, appointmentTypes.id),
        )
        .innerJoin(departments, eq(appointmentTypes.departmentId, departments.id))
        .where(eq(appointments.patientId, patient.patient.id))
        .orderBy(appointments.scheduledDate, appointments.scheduledTime)
        .all();

      return {
        status: "OK",
        data: rows.map((row) => {
          const employee = db
            .select()
            .from(employees)
            .where(eq(employees.departmentId, row.department.id))
            .orderBy(employees.id)
            .get();

          return {
            employee: employee
              ? `${employee.firstName} ${employee.lastName}`
              : null,
            department: row.department.name,
            appointmentType: row.appointmentType.name,
            scheduledDate: row.appointment.scheduledDate,
            scheduledTime: row.appointment.scheduledTime,
          };
        }),
      };
    },

    /**
     * Aggregate hospital KPIs for `GET /v1/ops/summary`, computed entirely via
     * SQL `count()`/`sum()`/`GROUP BY` — never by fetching rows into JS. Safe
     * at any scale (34 departments, 11k+ beds, 64k+ patients, ...).
     */
    opsSummary(dateIso?: string): OpsSummary {
      const bedRows = db
        .select({ status: beds.status, total: count() })
        .from(beds)
        .groupBy(beds.status)
        .all();

      const bedCounts: Record<BedStatus, number> = {
        FREE: 0,
        RESERVED: 0,
        OCCUPIED: 0,
      };
      for (const row of bedRows) {
        bedCounts[row.status] = row.total;
      }
      const bedsTotal =
        bedCounts.FREE + bedCounts.RESERVED + bedCounts.OCCUPIED;

      const capacityRow = db
        .select({
          current: sum(departments.currentCapacity),
          max: sum(departments.maxCapacity),
        })
        .from(departments)
        .get();

      const visitRows = db
        .select({
          status: patientVisits.status,
          visitType: patientVisits.visitType,
          total: count(),
        })
        .from(patientVisits)
        .groupBy(patientVisits.status, patientVisits.visitType)
        .all();

      let activeInpatient = 0;
      let activeOutpatient = 0;
      let discharged = 0;
      for (const row of visitRows) {
        if (row.status === "ACTIVE" && row.visitType === "INPATIENT") {
          activeInpatient += row.total;
        } else if (row.status === "ACTIVE" && row.visitType === "OUTPATIENT") {
          activeOutpatient += row.total;
        } else if (row.status === "DISCHARGED") {
          discharged += row.total;
        }
      }

      const patientsTotal =
        db.select({ total: count() }).from(patients).get()?.total ?? 0;
      const employeesTotal =
        db.select({ total: count() }).from(employees).get()?.total ?? 0;
      const departmentsTotal =
        db.select({ total: count() }).from(departments).get()?.total ?? 0;
      const wardsTotal =
        db.select({ total: count() }).from(stations).get()?.total ?? 0;

      const appointmentsOnDate = dateIso
        ? (db
            .select({ total: count() })
            .from(appointments)
            .where(eq(appointments.scheduledDate, dateIso))
            .get()?.total ?? 0)
        : (db.select({ total: count() }).from(appointments).get()?.total ??
          0);

      return {
        beds: {
          total: bedsTotal,
          free: bedCounts.FREE,
          reserved: bedCounts.RESERVED,
          occupied: bedCounts.OCCUPIED,
        },
        capacity: {
          current: Number(capacityRow?.current ?? 0),
          max: Number(capacityRow?.max ?? 0),
        },
        visits: {
          active: activeInpatient + activeOutpatient,
          activeInpatient,
          activeOutpatient,
          discharged,
        },
        patients: { total: patientsTotal },
        employees: { total: employeesTotal },
        departments: { total: departmentsTotal },
        wards: { total: wardsTotal },
        appointmentsOnDate,
      };
    },

    /**
     * Per-department employee totals over ALL employees (SQL `GROUP BY`),
     * used by `/v1/ops/staffing` so per-department counts always sum to the
     * true total employee count instead of a capped 100-row sample.
     */
    countEmployeesByDepartment(): Map<number, number> {
      const rows = db
        .select({ departmentId: employees.departmentId, total: count() })
        .from(employees)
        .groupBy(employees.departmentId)
        .all();

      return new Map(rows.map((row) => [row.departmentId, row.total]));
    },

    /**
     * STATUTORY/PRIVATE counts over ALL patients' SSN insurance type (SQL
     * `GROUP BY`), used by `/v1/financial/summary`'s `payer_mix` instead of a
     * capped 100-row sample.
     */
    countPatientsByInsuranceType(): { statutory: number; private: number } {
      const rows = db
        .select({
          insuranceType: socialSecurityNumbers.insuranceType,
          total: count(),
        })
        .from(patients)
        .innerJoin(
          socialSecurityNumbers,
          eq(patients.socialSecurityNumberId, socialSecurityNumbers.id),
        )
        .groupBy(socialSecurityNumbers.insuranceType)
        .all();

      const counts = { statutory: 0, private: 0 };
      for (const row of rows) {
        if (row.insuranceType === "STATUTORY") {
          counts.statutory = row.total;
        } else if (row.insuranceType === "PRIVATE") {
          counts.private = row.total;
        }
      }

      return counts;
    },

    /**
     * One entry per (building, floor) nav-tree slot for
     * `GET /v1/ops/floors`, computed via SQL `GROUP BY stations.building,
     * stations.floor` plus two bed rollups joined on `beds.station_id` —
     * never by loading whole tables. Safe at any scale (~10 buildings x ~7
     * floors, 400 wards, 11k+ beds).
     */
    listFloors(): FloorSummary[] {
      const wardRows = db
        .select({
          building: stations.building,
          floor: stations.floor,
          wardCount: count(),
        })
        .from(stations)
        .groupBy(stations.building, stations.floor)
        .orderBy(stations.building, stations.floor)
        .all();

      const bedRows = db
        .select({
          building: stations.building,
          floor: stations.floor,
          bedTotal: count(),
        })
        .from(beds)
        .innerJoin(stations, eq(beds.stationId, stations.id))
        .groupBy(stations.building, stations.floor)
        .all();

      const occupiedRows = db
        .select({
          building: stations.building,
          floor: stations.floor,
          occupied: count(),
        })
        .from(beds)
        .innerJoin(stations, eq(beds.stationId, stations.id))
        .where(eq(beds.status, "OCCUPIED"))
        .groupBy(stations.building, stations.floor)
        .all();

      const bedTotalsBySlot = new Map<string, number>();
      for (const row of bedRows) {
        bedTotalsBySlot.set(floorSlotKey(row.building, row.floor), row.bedTotal);
      }

      const occupiedBySlot = new Map<string, number>();
      for (const row of occupiedRows) {
        occupiedBySlot.set(floorSlotKey(row.building, row.floor), row.occupied);
      }

      return wardRows.map((row) => {
        const key = floorSlotKey(row.building, row.floor);

        return {
          building: row.building,
          level: row.floor - 1,
          wardCount: row.wardCount,
          bedTotal: bedTotalsBySlot.get(key) ?? 0,
          occupied: occupiedBySlot.get(key) ?? 0,
        };
      });
    },

    /**
     * One floor's wards -> rooms -> beds (+ the active INPATIENT occupant
     * for OCCUPIED beds), bounded to a single (building, floor) slot
     * (~5-6 wards / ~150 beds in the scaled seed) via `WHERE building = ?
     * AND floor = ?` plus `IN (...)` joins scoped to that slot's station
     * ids — never a full-table scan. Returns `null` when the (building,
     * level) pair matches no wards, mapped to 404 by the route.
     */
    floorDetail(building: string, level: number): FloorDetail | null {
      const floor = level + 1;

      const stationRows = db
        .select({ station: stations, department: departments })
        .from(stations)
        .innerJoin(departments, eq(stations.departmentId, departments.id))
        .where(and(eq(stations.building, building), eq(stations.floor, floor)))
        .orderBy(stations.name)
        .all();

      if (stationRows.length === 0) {
        return null;
      }

      const stationIds = stationRows.map((row) => row.station.id);

      const roomRows = db
        .select()
        .from(rooms)
        .where(inArray(rooms.stationId, stationIds))
        .orderBy(rooms.name)
        .all();

      const bedRows = db
        .select()
        .from(beds)
        .where(inArray(beds.stationId, stationIds))
        .orderBy(beds.id)
        .all();

      const bedIds = bedRows.map((row) => row.id);

      const occupantRows =
        bedIds.length > 0
          ? db
              .select({
                bedId: patientVisits.bedId,
                patientNumber: patientVisits.patientNumber,
                patient: patients,
              })
              .from(patientVisits)
              .innerJoin(patients, eq(patientVisits.patientId, patients.id))
              .where(
                and(
                  inArray(patientVisits.bedId, bedIds),
                  eq(patientVisits.visitType, "INPATIENT"),
                  eq(patientVisits.status, "ACTIVE"),
                ),
              )
              .all()
          : [];

      const occupantByBedId = new Map<number, FloorBedPatient>();
      for (const row of occupantRows) {
        if (row.bedId !== null) {
          occupantByBedId.set(row.bedId, {
            firstName: row.patient.firstName,
            lastName: row.patient.lastName,
            patientNumber: row.patientNumber,
          });
        }
      }

      const bedsByRoomId = new Map<number, BedRow[]>();
      for (const bed of bedRows) {
        if (bed.roomId === null) {
          continue;
        }

        const existing = bedsByRoomId.get(bed.roomId) ?? [];
        existing.push(bed);
        bedsByRoomId.set(bed.roomId, existing);
      }

      const roomsByStationId = new Map<number, RoomRow[]>();
      for (const room of roomRows) {
        const existing = roomsByStationId.get(room.stationId) ?? [];
        existing.push(room);
        roomsByStationId.set(room.stationId, existing);
      }

      return {
        building,
        level,
        wards: stationRows.map((row) => ({
          station: row.station,
          department: row.department,
          rooms: (roomsByStationId.get(row.station.id) ?? []).map((room) => {
            const roomBeds = bedsByRoomId.get(room.id) ?? [];

            return {
              room,
              bedCapacity: roomBeds.length,
              currentCapacity: roomBeds.filter(
                (bed) => bed.status === "OCCUPIED",
              ).length,
              beds: roomBeds.map((bed) => ({
                bed,
                patient:
                  bed.status === "OCCUPIED"
                    ? (occupantByBedId.get(bed.id) ?? null)
                    : null,
              })),
            };
          }),
        })),
      };
    },

    roomOccupancy(roomPublicId: string): RoomOccupancy | undefined {
      const room = this.getRoom(roomPublicId);

      if (!room) {
        return undefined;
      }

      const bedRows = db
        .select()
        .from(beds)
        .where(eq(beds.roomId, room.room.id))
        .orderBy(beds.id)
        .all();

      const bedIds = bedRows.map((row) => row.id);

      const occupantRows =
        bedIds.length > 0
          ? db
              .select({
                bedId: patientVisits.bedId,
                visitPublicId: patientVisits.publicId,
                patientNumber: patientVisits.patientNumber,
                patient: patients,
              })
              .from(patientVisits)
              .innerJoin(patients, eq(patientVisits.patientId, patients.id))
              .where(
                and(
                  inArray(patientVisits.bedId, bedIds),
                  eq(patientVisits.visitType, "INPATIENT"),
                  eq(patientVisits.status, "ACTIVE"),
                ),
              )
              .all()
          : [];

      const occupantByBedId = new Map<number, RoomBedOccupant>();
      for (const row of occupantRows) {
        if (row.bedId !== null) {
          occupantByBedId.set(row.bedId, {
            patient: row.patient,
            patientNumber: row.patientNumber,
            visitPublicId: row.visitPublicId,
          });
        }
      }

      return {
        room,
        beds: bedRows.map((bed) => ({
          bed,
          occupant: occupantByBedId.get(bed.id) ?? null,
        })),
      };
    },

    patientOverview(patientPublicId: string): PatientOverview | undefined {
      const patient = this.getPatient(patientPublicId);

      if (!patient) {
        return undefined;
      }

      const activeVisitRow = db
        .select({
          patientVisit: patientVisits,
          patient: patients,
          department: departments,
        })
        .from(patientVisits)
        .innerJoin(patients, eq(patientVisits.patientId, patients.id))
        .innerJoin(departments, eq(patientVisits.departmentId, departments.id))
        .where(
          and(
            eq(patientVisits.patientId, patient.patient.id),
            eq(patientVisits.status, "ACTIVE"),
          ),
        )
        // "INPATIENT" sorts before "OUTPATIENT", so an active inpatient stay
        // (the one that carries a room/bed) wins if a patient has more than one
        // active visit.
        .orderBy(patientVisits.visitType)
        .get();

      const currentVisit = activeVisitRow
        ? this.patientVisitWithDetails(activeVisitRow)
        : null;

      const appointmentRows = db
        .select({
          appointment: appointments,
          patient: patients,
          appointmentType: appointmentTypes,
          department: departments,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(
          appointmentTypes,
          eq(appointments.appointmentTypeId, appointmentTypes.id),
        )
        .innerJoin(
          departments,
          eq(appointmentTypes.departmentId, departments.id),
        )
        .where(eq(appointments.patientId, patient.patient.id))
        .orderBy(appointments.scheduledDate, appointments.scheduledTime)
        .all();

      return {
        patient,
        currentVisit,
        appointments: appointmentRows,
      };
    },

    searchPatients(query: string, limit: number): PatientRow[] {
      const q = query.trim();

      if (!q) {
        return [];
      }

      // A purely numeric query is treated as a patient number: resolve it via
      // the active-visit lookup (the uniquely-indexed number) and return that
      // single patient.
      if (/^\d+$/.test(q)) {
        const visit = this.getActivePatientVisitByNumber(q);
        return visit ? [visit.patient] : [];
      }

      // Name search: case-insensitive (SQLite LIKE) match on first name, last
      // name, or the full "first last" — parameterized, so it is scale-safe and
      // injection-safe. Bounded by `limit`; the browser never loads all 64k.
      const pattern = `%${q}%`;
      return db
        .select()
        .from(patients)
        .where(
          sql`(${patients.firstName} LIKE ${pattern} OR ${patients.lastName} LIKE ${pattern} OR (${patients.firstName} || ' ' || ${patients.lastName}) LIKE ${pattern})`,
        )
        .orderBy(patients.lastName, patients.firstName)
        .limit(limit)
        .all();
    },
  };
}

function publicId(
  prefix:
    | "app"
    | "aty"
    | "bed"
    | "dep"
    | "emp"
    | "pat"
    | "pvi"
    | "roo"
    | "ssn"
    | "sta",
) {
  return `${prefix}_${nanoid()}`;
}

function floorSlotKey(building: string, floor: number) {
  return `${building}\0${floor}`;
}

function pageRows<T>(
  rows: T[],
  pageSize: number,
  getPublicId: (row: T) => string,
): { data: T[]; nextPublicId?: string } {
  const data = rows.slice(0, pageSize);
  const extra = rows.at(pageSize);
  const last = data.at(-1);

  return {
    data,
    nextPublicId: extra && last ? getPublicId(last) : undefined,
  };
}
