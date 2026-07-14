import type {
  FloorBed,
  FloorDetail,
  FloorRoom,
  FloorSummary,
  FloorWard,
  OpsSummary,
  PatientAppointmentSummary,
  PatientOverview,
  PatientVisitWithDetails,
  RoomOccupancy,
  RoomWithCapacity,
} from "../repositories/healthcare";
import type {
  AppointmentRow,
  AppointmentTypeRow,
  BedRow,
  DepartmentRow,
  EmployeeRow,
  PatientRow,
  RoomRow,
  SocialSecurityNumberRow,
  StationRow,
} from "../db/schema";

export type SocialSecurityNumberResource = {
  id: string;
  number: string;
  health_insurance_provider: string;
  insurance_type: string;
  created_at: string;
  updated_at: string;
};

export type DepartmentResource = {
  id: string;
  name: string;
  current_capacity: number;
  max_capacity: number;
  created_at: string;
  updated_at: string;
};

export type StationResource = {
  id: string;
  name: string;
  station_type: string;
  department: string;
  building: string;
  floor: number;
  created_at: string;
  updated_at: string;
};

export type RoomResource = {
  id: string;
  name: string;
  room_type: string;
  bed_capacity: number;
  current_capacity: number;
  department: string;
  station: string;
  created_at: string;
  updated_at: string;
};

export type BedResource = {
  id: string;
  bed_type: string;
  status: string;
  material: string;
  department: string;
  station: string;
  room: string | null;
  created_at: string;
  updated_at: string;
};

export type PatientVisitResource = {
  id: string;
  patient_number: string;
  visit_type: string;
  status: string;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string;
  };
  department: string;
  station: string | null;
  room: string | null;
  bed: string | null;
  started_date: string;
  started_time: string;
  ended_date: string | null;
  ended_time: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeResource = {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  created_at: string;
  updated_at: string;
};

export type AppointmentTypeResource = {
  id: string;
  name: string;
  department: string;
  default_duration_minutes: number;
  created_at: string;
  updated_at: string;
};

export type PatientReferenceResource = {
  id: string;
};

export type AppointmentResource = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  patient: PatientReferenceResource;
  appointment_type: AppointmentTypeResource;
  created_at: string;
  updated_at: string;
};

export type PatientAppointmentSummaryResource = {
  employee: string | null;
  department: string;
  appointment_type: string;
  scheduled_date: string;
  scheduled_time: string;
};

export type PatientResource = {
  id: string;
  gender: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  birthplace: string;
  social_security_number: SocialSecurityNumberResource;
  telephone_number: string;
  accepted_gdpr: boolean;
  created_at: string;
  updated_at: string;
};

export function serializeSocialSecurityNumber(
  row: SocialSecurityNumberRow,
): SocialSecurityNumberResource {
  return {
    id: row.publicId,
    number: row.number,
    health_insurance_provider: row.healthInsuranceProvider,
    insurance_type: row.insuranceType,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function serializeDepartment(row: DepartmentRow): DepartmentResource {
  return {
    id: row.publicId,
    name: row.name,
    current_capacity: row.currentCapacity,
    max_capacity: row.maxCapacity,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function serializeStation(
  row: StationRow,
  department: DepartmentRow,
): StationResource {
  return {
    id: row.publicId,
    name: row.name,
    station_type: row.stationType,
    department: department.name,
    building: row.building,
    floor: row.floor,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function serializeRoom(row: RoomWithCapacity): RoomResource {
  return {
    id: row.room.publicId,
    name: row.room.name,
    room_type: row.room.roomType,
    bed_capacity: row.bedCapacity,
    current_capacity: row.currentCapacity,
    department: row.department.name,
    station: row.station.name,
    created_at: row.room.createdAt,
    updated_at: row.room.updatedAt,
  };
}

export function serializeBed(
  row: BedRow,
  department: DepartmentRow,
  station: StationRow,
  room: RoomRow | null,
): BedResource {
  return {
    id: row.publicId,
    bed_type: row.bedType,
    status: row.status,
    material: row.material,
    department: department.name,
    station: station.name,
    room: room?.name ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function serializePatientVisit(
  row: PatientVisitWithDetails,
): PatientVisitResource {
  return {
    id: row.patientVisit.publicId,
    patient_number: row.patientVisit.patientNumber,
    visit_type: row.patientVisit.visitType,
    status: row.patientVisit.status,
    patient: {
      id: row.patient.publicId,
      first_name: row.patient.firstName,
      last_name: row.patient.lastName,
      birth_date: row.patient.birthDate,
    },
    department: row.department.name,
    station: row.station?.name ?? null,
    room: row.room?.name ?? null,
    bed: row.bed?.publicId ?? null,
    started_date: row.patientVisit.startedDate,
    started_time: row.patientVisit.startedTime,
    ended_date: row.patientVisit.endedDate,
    ended_time: row.patientVisit.endedTime,
    created_at: row.patientVisit.createdAt,
    updated_at: row.patientVisit.updatedAt,
  };
}

export function serializeEmployee(
  row: EmployeeRow,
  department: DepartmentRow,
): EmployeeResource {
  return {
    id: row.publicId,
    first_name: row.firstName,
    last_name: row.lastName,
    position: row.position,
    department: department.name,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function serializeAppointmentType(
  row: AppointmentTypeRow,
  department: DepartmentRow,
): AppointmentTypeResource {
  return {
    id: row.publicId,
    name: row.name,
    department: department.name,
    default_duration_minutes: row.defaultDurationMinutes,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function serializePatientReference(
  row: PatientRow,
): PatientReferenceResource {
  return {
    id: row.publicId,
  };
}

export function serializeAppointment(
  row: AppointmentRow,
  patient: PatientRow,
  appointmentType: AppointmentTypeRow,
  department: DepartmentRow,
): AppointmentResource {
  return {
    id: row.publicId,
    scheduled_date: row.scheduledDate,
    scheduled_time: row.scheduledTime,
    patient: serializePatientReference(patient),
    appointment_type: serializeAppointmentType(appointmentType, department),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function serializePatientAppointmentSummary(
  row: PatientAppointmentSummary,
): PatientAppointmentSummaryResource {
  return {
    employee: row.employee,
    department: row.department,
    appointment_type: row.appointmentType,
    scheduled_date: row.scheduledDate,
    scheduled_time: row.scheduledTime,
  };
}

export type OpsSummaryResource = {
  beds: {
    total: number;
    free: number;
    reserved: number;
    occupied: number;
    occupancy_pct: number;
  };
  capacity: {
    current: number;
    max: number;
    pct: number;
  };
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

export function serializeOpsSummary(summary: OpsSummary): OpsSummaryResource {
  return {
    beds: {
      total: summary.beds.total,
      free: summary.beds.free,
      reserved: summary.beds.reserved,
      occupied: summary.beds.occupied,
      occupancy_pct: percentage(summary.beds.occupied, summary.beds.total),
    },
    capacity: {
      current: summary.capacity.current,
      max: summary.capacity.max,
      pct: percentage(summary.capacity.current, summary.capacity.max),
    },
    visits: {
      active: summary.visits.active,
      active_inpatient: summary.visits.activeInpatient,
      active_outpatient: summary.visits.activeOutpatient,
      discharged: summary.visits.discharged,
    },
    patients: { total: summary.patients.total },
    employees: { total: summary.employees.total },
    departments: { total: summary.departments.total },
    wards: { total: summary.wards.total },
    appointments_on_date: summary.appointmentsOnDate,
  };
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1_000) / 10;
}

export type FloorSummaryResource = {
  building: string;
  level: number;
  label: string;
  ward_count: number;
  bed_total: number;
  occupied: number;
  occupancy_pct: number;
};

export function serializeFloorSummary(row: FloorSummary): FloorSummaryResource {
  return {
    building: row.building,
    level: row.level,
    label: floorLabel(row.level),
    ward_count: row.wardCount,
    bed_total: row.bedTotal,
    occupied: row.occupied,
    occupancy_pct: percentage(row.occupied, row.bedTotal),
  };
}

export type FloorPatientResource = {
  first_name: string;
  last_name: string;
  patient_number: string;
};

export type FloorBedResource = {
  id: string;
  status: string;
  room: string;
  patient?: FloorPatientResource;
};

export type FloorRoomResource = {
  id: string;
  name: string;
  room_type: string;
  bed_capacity: number;
  current_capacity: number;
  beds: FloorBedResource[];
};

export type FloorWardResource = {
  id: string;
  name: string;
  station_type: string;
  department: string;
  rooms: FloorRoomResource[];
};

export type FloorDetailResource = {
  building: string;
  level: number;
  label: string;
  wards: FloorWardResource[];
};

export function serializeFloorBed(row: FloorBed, roomName: string): FloorBedResource {
  return {
    id: row.bed.publicId,
    status: row.bed.status,
    room: roomName,
    ...(row.patient
      ? {
          patient: {
            first_name: row.patient.firstName,
            last_name: row.patient.lastName,
            patient_number: row.patient.patientNumber,
          },
        }
      : {}),
  };
}

export function serializeFloorRoom(row: FloorRoom): FloorRoomResource {
  return {
    id: row.room.publicId,
    name: row.room.name,
    room_type: row.room.roomType,
    bed_capacity: row.bedCapacity,
    current_capacity: row.currentCapacity,
    beds: row.beds.map((bed) => serializeFloorBed(bed, row.room.name)),
  };
}

export function serializeFloorWard(row: FloorWard): FloorWardResource {
  return {
    id: row.station.publicId,
    name: row.station.name,
    station_type: row.station.stationType,
    department: row.department.name,
    rooms: row.rooms.map(serializeFloorRoom),
  };
}

export function serializeFloorDetail(detail: FloorDetail): FloorDetailResource {
  return {
    building: detail.building,
    level: detail.level,
    label: floorLabel(detail.level),
    wards: detail.wards.map(serializeFloorWard),
  };
}

function floorLabel(level: number): string {
  return level === 0 ? "EG" : `${level}. OG`;
}

export function serializePatient(
  row: PatientRow,
  socialSecurityNumber: SocialSecurityNumberRow,
): PatientResource {
  return {
    id: row.publicId,
    gender: row.gender,
    first_name: row.firstName,
    last_name: row.lastName,
    birth_date: row.birthDate,
    birthplace: row.birthplace,
    social_security_number: serializeSocialSecurityNumber(socialSecurityNumber),
    telephone_number: row.telephoneNumber,
    accepted_gdpr: row.acceptedGdpr,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export type PatientSearchResultResource = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
};

export function serializePatientSearchResult(
  row: PatientRow,
): PatientSearchResultResource {
  return {
    id: row.publicId,
    first_name: row.firstName,
    last_name: row.lastName,
    birth_date: row.birthDate,
  };
}

export type RoomBedOccupantResource = {
  patient_id: string;
  first_name: string;
  last_name: string;
  patient_number: string;
  visit_id: string;
};

export type RoomOccupancyBedResource = {
  id: string;
  bed_type: BedRow["bedType"];
  status: BedRow["status"];
  material: string;
  occupant: RoomBedOccupantResource | null;
};

export type RoomOccupancyResource = {
  room: RoomResource;
  beds: RoomOccupancyBedResource[];
};

export function serializeRoomOccupancy(
  row: RoomOccupancy,
): RoomOccupancyResource {
  return {
    room: serializeRoom(row.room),
    beds: row.beds.map(({ bed, occupant }) => ({
      id: bed.publicId,
      bed_type: bed.bedType,
      status: bed.status,
      material: bed.material,
      occupant: occupant
        ? {
            patient_id: occupant.patient.publicId,
            first_name: occupant.patient.firstName,
            last_name: occupant.patient.lastName,
            patient_number: occupant.patientNumber,
            visit_id: occupant.visitPublicId,
          }
        : null,
    })),
  };
}

export type PatientOverviewResource = {
  patient: PatientResource;
  // `room_id` (the room's public id) is added so the UI can link straight to
  // the room page; `PatientVisitResource.room` only carries the display name.
  current_visit: (PatientVisitResource & { room_id: string | null }) | null;
  appointments: AppointmentResource[];
};

export function serializePatientOverview(
  row: PatientOverview,
): PatientOverviewResource {
  return {
    patient: serializePatient(
      row.patient.patient,
      row.patient.socialSecurityNumber,
    ),
    current_visit: row.currentVisit
      ? {
          ...serializePatientVisit(row.currentVisit),
          room_id: row.currentVisit.room?.publicId ?? null,
        }
      : null,
    appointments: row.appointments.map((appointment) =>
      serializeAppointment(
        appointment.appointment,
        appointment.patient,
        appointment.appointmentType,
        appointment.department,
      ),
    ),
  };
}
