import {
  bedMaterials,
  bedStatuses,
  bedTypes,
  genders,
  insuranceTypes,
  patientVisitStatuses,
  patientVisitTypes,
  roomTypes,
  stationTypes,
  type BedMaterial,
  type BedStatus,
  type BedType,
  type Gender,
  type InsuranceType,
  type PatientVisitStatus,
  type PatientVisitType,
  type RoomType,
  type StationType,
} from "../db/schema";

const socialSecurityNumberFields = [
  "number",
  "health_insurance_provider",
  "insurance_type",
] as const;
const patientFields = [
  "gender",
  "first_name",
  "last_name",
  "birth_date",
  "birthplace",
  "social_security_number_id",
  "telephone_number",
  "accepted_gdpr",
] as const;
const departmentFields = ["name", "current_capacity", "max_capacity"] as const;
const stationFields = [
  "name",
  "station_type",
  "department_id",
  "building",
  "floor",
] as const;
const roomFields = ["name", "room_type", "department_id", "station_id"] as const;
const bedFields = [
  "bed_type",
  "status",
  "material",
  "department_id",
  "station_id",
  "room_id",
] as const;
const patientVisitFields = [
  "patient_number",
  "visit_type",
  "status",
  "patient_id",
  "department_id",
  "station_id",
  "room_id",
  "bed_id",
  "started_date",
  "started_time",
  "ended_date",
  "ended_time",
] as const;
const employeeFields = [
  "first_name",
  "last_name",
  "position",
  "department_id",
] as const;
const appointmentTypeFields = [
  "name",
  "department_id",
  "default_duration_minutes",
] as const;
const appointmentFields = [
  "scheduled_date",
  "scheduled_time",
  "linked_patient_id",
  "appointment_type_id",
] as const;
const appointmentBookingFields = [
  "health_insurance_number",
  "birth_date",
  "appointment_type_id",
  "scheduled_date",
  "scheduled_time",
] as const;
const appointmentCancellationFields = appointmentBookingFields;
const appointmentRescheduleFields = [
  "health_insurance_number",
  "birth_date",
  "appointment_type_id",
  "from_scheduled_date",
  "from_scheduled_time",
  "to_scheduled_date",
  "to_scheduled_time",
] as const;
const patientAppointmentSearchFields = [
  "health_insurance_number",
  "birth_date",
] as const;
const patientMovementAvailableBedsFields = [
  "patient_number",
  "target_department_id",
] as const;
const patientMovementFields = ["patient_number", "target_bed_id"] as const;
const patientMovementCompletionFields = ["patient_number"] as const;
const appointmentSlotQueryFields = ["start", "end", "limit"] as const;

export type CreateSocialSecurityNumberInput = {
  number: string;
  health_insurance_provider: string;
  insurance_type: InsuranceType;
};

export type CreatePatientInput = {
  gender: Gender;
  first_name: string;
  last_name: string;
  birth_date: string;
  birthplace: string;
  social_security_number_id: string;
  telephone_number: string;
  accepted_gdpr: boolean;
};

export type CreateDepartmentInput = {
  name: string;
  current_capacity: number;
  max_capacity: number;
};

export type CreateStationInput = {
  name: string;
  station_type: StationType;
  department_id: string;
  building?: string;
  floor?: number;
};

export type CreateRoomInput = {
  name: string;
  room_type: RoomType;
  department_id: string;
  station_id: string;
};

export type CreateBedInput = {
  bed_type: BedType;
  status: BedStatus;
  material: BedMaterial;
  department_id: string;
  station_id: string;
  room_id: string | null;
};

export type CreatePatientVisitInput = {
  patient_number: string;
  visit_type: PatientVisitType;
  status: PatientVisitStatus;
  patient_id: string;
  department_id: string;
  station_id: string | null;
  room_id: string | null;
  bed_id: string | null;
  started_date: string;
  started_time: string;
  ended_date: string | null;
  ended_time: string | null;
};

export type CreateEmployeeInput = {
  first_name: string;
  last_name: string;
  position: string;
  department_id: string;
};

export type CreateAppointmentTypeInput = {
  name: string;
  department_id: string;
  default_duration_minutes: number;
};

export type CreateAppointmentInput = {
  scheduled_date: string;
  scheduled_time: string;
  linked_patient_id: string;
  appointment_type_id: string;
};

export type CreateAppointmentBookingInput = {
  health_insurance_number: string;
  birth_date: string;
  appointment_type_id: string;
  scheduled_date: string;
  scheduled_time: string;
};

export type CreateAppointmentCancellationInput = CreateAppointmentBookingInput;

export type CreateAppointmentRescheduleInput = {
  health_insurance_number: string;
  birth_date: string;
  appointment_type_id: string;
  from_scheduled_date: string;
  from_scheduled_time: string;
  to_scheduled_date: string;
  to_scheduled_time: string;
};

export type PatientAppointmentSearchInput = {
  health_insurance_number: string;
  birth_date: string;
};

export type PatientMovementAvailableBedsInput = {
  patient_number: string;
  target_department_id: string;
};

export type PatientMovementInput = {
  patient_number: string;
  target_bed_id: string;
};

export type PatientMovementCompletionInput = {
  patient_number: string;
};

export type AppointmentSlotSearchParams = {
  start: string;
  end: string;
  limit: number;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const berlinLocalDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export function validateSocialSecurityNumberInput(
  input: unknown,
): CreateSocialSecurityNumberInput {
  const body = objectBody(input);
  rejectUnknownFields(body, socialSecurityNumberFields);

  const number = requiredString(body, "number");
  const healthInsuranceProvider = requiredString(
    body,
    "health_insurance_provider",
  );
  const insuranceType = enumValue(
    body,
    "insurance_type",
    insuranceTypes,
  ) as InsuranceType;

  return {
    number,
    health_insurance_provider: healthInsuranceProvider,
    insurance_type: insuranceType,
  };
}

export function validatePatientInput(input: unknown): CreatePatientInput {
  const body = objectBody(input);
  rejectUnknownFields(body, patientFields);

  const birthDate = requiredString(body, "birth_date");

  if (!isoDatePattern.test(birthDate)) {
    throw new Error("birth_date must use YYYY-MM-DD format");
  }

  return {
    gender: enumValue(body, "gender", genders) as Gender,
    first_name: requiredString(body, "first_name"),
    last_name: requiredString(body, "last_name"),
    birth_date: birthDate,
    birthplace: requiredString(body, "birthplace"),
    social_security_number_id: requiredString(
      body,
      "social_security_number_id",
    ),
    telephone_number: requiredString(body, "telephone_number"),
    accepted_gdpr: requiredBoolean(body, "accepted_gdpr"),
  };
}

export function validateDepartmentInput(input: unknown): CreateDepartmentInput {
  const body = objectBody(input);
  rejectUnknownFields(body, departmentFields);

  return {
    name: requiredString(body, "name"),
    current_capacity: requiredInteger(body, "current_capacity"),
    max_capacity: requiredInteger(body, "max_capacity"),
  };
}

export function validateStationInput(input: unknown): CreateStationInput {
  const body = objectBody(input);
  rejectUnknownFields(body, stationFields);

  return {
    name: requiredString(body, "name"),
    station_type: enumValue(
      body,
      "station_type",
      stationTypes,
    ) as StationType,
    department_id: requiredString(body, "department_id"),
    building: optionalString(body, "building"),
    floor: optionalInteger(body, "floor"),
  };
}

export function validateRoomInput(input: unknown): CreateRoomInput {
  const body = objectBody(input);
  rejectUnknownFields(body, roomFields);

  return {
    name: requiredString(body, "name"),
    room_type: enumValue(body, "room_type", roomTypes) as RoomType,
    department_id: requiredString(body, "department_id"),
    station_id: requiredString(body, "station_id"),
  };
}

export function validateBedInput(input: unknown): CreateBedInput {
  const body = objectBody(input);
  rejectUnknownFields(body, bedFields);

  return {
    bed_type: enumValue(body, "bed_type", bedTypes) as BedType,
    status: enumValue(body, "status", bedStatuses) as BedStatus,
    material: enumValue(body, "material", bedMaterials) as BedMaterial,
    department_id: requiredString(body, "department_id"),
    station_id: requiredString(body, "station_id"),
    room_id: optionalNullableString(body, "room_id"),
  };
}

export function validatePatientVisitInput(
  input: unknown,
): CreatePatientVisitInput {
  const body = objectBody(input);
  rejectUnknownFields(body, patientVisitFields);

  const patientNumber = requiredString(body, "patient_number");
  if (!isFiveDigitPatientNumber(patientNumber)) {
    throw new Error("patient_number must be a 5 digit string");
  }

  const visitType = enumValue(
    body,
    "visit_type",
    patientVisitTypes,
  ) as PatientVisitType;
  const status = enumValue(
    body,
    "status",
    patientVisitStatuses,
  ) as PatientVisitStatus;
  const stationId = optionalNullableString(body, "station_id");
  const roomId = optionalNullableString(body, "room_id");
  const bedId = optionalNullableString(body, "bed_id");
  const endedDate = optionalNullableDate(body, "ended_date");
  const endedTime = optionalNullableTime(body, "ended_time");

  if (roomId && !stationId) {
    throw new Error("room_id requires station_id");
  }

  if (bedId && (!stationId || !roomId)) {
    throw new Error("bed_id requires station_id and room_id");
  }

  if (visitType === "INPATIENT" && (!stationId || !roomId || !bedId)) {
    throw new Error(
      "INPATIENT visits must include station_id, room_id, and bed_id",
    );
  }

  if (visitType === "OUTPATIENT" && (stationId || roomId || bedId)) {
    throw new Error(
      "OUTPATIENT visits must not include station_id, room_id, or bed_id",
    );
  }

  if (status === "DISCHARGED" && (!endedDate || !endedTime)) {
    throw new Error("DISCHARGED visits must include ended_date and ended_time");
  }

  if (status === "ACTIVE" && (endedDate || endedTime)) {
    throw new Error("ACTIVE visits must not include ended_date or ended_time");
  }

  return {
    patient_number: patientNumber,
    visit_type: visitType,
    status,
    patient_id: requiredString(body, "patient_id"),
    department_id: requiredString(body, "department_id"),
    station_id: stationId,
    room_id: roomId,
    bed_id: bedId,
    started_date: requiredDate(body, "started_date"),
    started_time: requiredTime(body, "started_time"),
    ended_date: endedDate,
    ended_time: endedTime,
  };
}

export function validateEmployeeInput(input: unknown): CreateEmployeeInput {
  const body = objectBody(input);
  rejectUnknownFields(body, employeeFields);

  return {
    first_name: requiredString(body, "first_name"),
    last_name: requiredString(body, "last_name"),
    position: requiredString(body, "position"),
    department_id: requiredString(body, "department_id"),
  };
}

export function validateAppointmentTypeInput(
  input: unknown,
): CreateAppointmentTypeInput {
  const body = objectBody(input);
  rejectUnknownFields(body, appointmentTypeFields);

  return {
    name: requiredString(body, "name"),
    department_id: requiredString(body, "department_id"),
    default_duration_minutes: requiredPositiveInteger(
      body,
      "default_duration_minutes",
    ),
  };
}

export function validateAppointmentInput(
  input: unknown,
): CreateAppointmentInput {
  const body = objectBody(input);
  rejectUnknownFields(body, appointmentFields);

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

export function validateAppointmentBookingInput(
  input: unknown,
): CreateAppointmentBookingInput {
  const body = objectBody(input);
  rejectUnknownFields(body, appointmentBookingFields);

  const birthDate = requiredDate(body, "birth_date");
  const scheduledDate = requiredDate(body, "scheduled_date");
  const scheduledTime = requiredTime(body, "scheduled_time");

  return {
    health_insurance_number: requiredString(body, "health_insurance_number"),
    birth_date: birthDate,
    appointment_type_id: requiredString(body, "appointment_type_id"),
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
  };
}

export function validateAppointmentCancellationInput(
  input: unknown,
): CreateAppointmentCancellationInput {
  const body = objectBody(input);
  rejectUnknownFields(body, appointmentCancellationFields);

  return appointmentMutationInput(body);
}

export function validateAppointmentRescheduleInput(
  input: unknown,
): CreateAppointmentRescheduleInput {
  const body = objectBody(input);
  rejectUnknownFields(body, appointmentRescheduleFields);

  return {
    health_insurance_number: requiredString(body, "health_insurance_number"),
    birth_date: requiredDate(body, "birth_date"),
    appointment_type_id: requiredString(body, "appointment_type_id"),
    from_scheduled_date: requiredDate(body, "from_scheduled_date"),
    from_scheduled_time: requiredTime(body, "from_scheduled_time"),
    to_scheduled_date: requiredDate(body, "to_scheduled_date"),
    to_scheduled_time: requiredTime(body, "to_scheduled_time"),
  };
}

export function validatePatientAppointmentSearchInput(
  input: unknown,
): PatientAppointmentSearchInput {
  const body = objectBody(input);
  rejectUnknownFields(body, patientAppointmentSearchFields);

  return {
    health_insurance_number: requiredString(body, "health_insurance_number"),
    birth_date: requiredDate(body, "birth_date"),
  };
}

export function validatePatientMovementAvailableBedsInput(
  input: unknown,
): PatientMovementAvailableBedsInput {
  const body = objectBody(input);
  rejectUnknownFields(body, patientMovementAvailableBedsFields);
  const patientNumber = requiredPatientNumber(body);

  return {
    patient_number: patientNumber,
    target_department_id: requiredString(body, "target_department_id"),
  };
}

export function validatePatientMovementInput(
  input: unknown,
): PatientMovementInput {
  const body = objectBody(input);
  rejectUnknownFields(body, patientMovementFields);
  const patientNumber = requiredPatientNumber(body);

  return {
    patient_number: patientNumber,
    target_bed_id: requiredString(body, "target_bed_id"),
  };
}

export function validatePatientMovementCompletionInput(
  input: unknown,
): PatientMovementCompletionInput {
  const body = objectBody(input);
  rejectUnknownFields(body, patientMovementCompletionFields);

  return {
    patient_number: requiredPatientNumber(body),
  };
}

export function validateAppointmentListQuery(url: URL): string | undefined {
  const date = url.searchParams.get("date") ?? undefined;

  if (date !== undefined && !isoDatePattern.test(date)) {
    throw new Error("date must use YYYY-MM-DD format");
  }

  return date;
}

export function validateAppointmentSlotSearchParams(
  url: URL,
): AppointmentSlotSearchParams {
  const allowed = new Set(appointmentSlotQueryFields);
  const unknown = Array.from(url.searchParams.keys()).filter(
    (field) => !allowed.has(field as (typeof appointmentSlotQueryFields)[number]),
  );

  if (unknown.length > 0) {
    throw new Error(`${unknown.join(", ")} must not be provided`);
  }

  const start = requiredQueryString(url, "start");
  const end = requiredQueryString(url, "end");
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number(rawLimit) : 100;

  if (!berlinLocalDateTimePattern.test(start)) {
    throw new Error("start must use YYYY-MM-DDTHH:mm format");
  }

  if (!berlinLocalDateTimePattern.test(end)) {
    throw new Error("end must use YYYY-MM-DDTHH:mm format");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("limit must be an integer between 1 and 500");
  }

  if (compareBerlinLocalDateTime(start, end) >= 0) {
    throw new Error("end must be after start");
  }

  return {
    start,
    end,
    limit,
  };
}

function objectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Request body must be a JSON object");
  }

  return input as Record<string, unknown>;
}

function requiredPatientNumber(body: Record<string, unknown>): string {
  const patientNumber = requiredString(body, "patient_number");
  if (!isFiveDigitPatientNumber(patientNumber)) {
    throw new Error("patient_number must be a 5 digit string");
  }
  return patientNumber;
}

function isFiveDigitPatientNumber(value: string): boolean {
  return /^\d{5}$/.test(value);
}

function appointmentMutationInput(
  body: Record<string, unknown>,
): CreateAppointmentBookingInput {
  return {
    health_insurance_number: requiredString(body, "health_insurance_number"),
    birth_date: requiredDate(body, "birth_date"),
    appointment_type_id: requiredString(body, "appointment_type_id"),
    scheduled_date: requiredDate(body, "scheduled_date"),
    scheduled_time: requiredTime(body, "scheduled_time"),
  };
}

function rejectUnknownFields(
  body: Record<string, unknown>,
  allowedFields: readonly string[],
) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(body).filter((field) => !allowed.has(field));

  if (unknown.length > 0) {
    throw new Error(`${unknown.join(", ")} must not be provided`);
  }
}

function requiredString(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value;
}

function optionalString(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value;
}

function optionalInteger(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer`);
  }

  return value;
}

function optionalNullableString(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string or null`);
  }

  return value;
}

function optionalNullableDate(body: Record<string, unknown>, field: string) {
  const value = optionalNullableString(body, field);

  if (value === null) {
    return null;
  }

  if (!isoDatePattern.test(value)) {
    throw new Error(`${field} must use YYYY-MM-DD format`);
  }

  return value;
}

function optionalNullableTime(body: Record<string, unknown>, field: string) {
  const value = optionalNullableString(body, field);

  if (value === null) {
    return null;
  }

  if (!isoTimePattern.test(value)) {
    throw new Error(`${field} must use HH:mm format`);
  }

  return value;
}

function requiredDate(body: Record<string, unknown>, field: string) {
  const value = requiredString(body, field);

  if (!isoDatePattern.test(value)) {
    throw new Error(`${field} must use YYYY-MM-DD format`);
  }

  return value;
}

function requiredTime(body: Record<string, unknown>, field: string) {
  const value = requiredString(body, field);

  if (!isoTimePattern.test(value)) {
    throw new Error(`${field} must use HH:mm format`);
  }

  return value;
}

function requiredQueryString(url: URL, field: string) {
  const value = url.searchParams.get(field);

  if (!value || value.trim().length === 0) {
    throw new Error(`${field} must be provided`);
  }

  return value;
}

function requiredInteger(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer`);
  }

  return value;
}

function requiredPositiveInteger(body: Record<string, unknown>, field: string) {
  const value = requiredInteger(body, field);

  if (value < 1) {
    throw new Error(`${field} must be a positive integer`);
  }

  return value;
}

function requiredBoolean(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }

  return value;
}

function enumValue(
  body: Record<string, unknown>,
  field: string,
  values: readonly string[],
) {
  const value = body[field];

  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`${field} must be one of ${values.join(", ")}`);
  }

  return value;
}

function compareBerlinLocalDateTime(left: string, right: string) {
  return left.localeCompare(right);
}
