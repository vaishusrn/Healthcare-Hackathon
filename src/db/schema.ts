import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const insuranceTypes = ["STATUTORY", "PRIVATE"] as const;
export type InsuranceType = (typeof insuranceTypes)[number];

export const genders = ["FEMALE", "MALE", "NON_BINARY", "UNKNOWN"] as const;
export type Gender = (typeof genders)[number];

export const stationTypes = ["INTENSIVE", "NORMAL"] as const;
export type StationType = (typeof stationTypes)[number];

export const roomTypes = [
  "GROUP_ROOM",
  "SINGLE_ROOM_STANDARD",
  "SINGLE_ROOM_INFECTIOUS",
  "SINGLE_ROOM_AIRLOCK",
  "SECRETARIAT",
] as const;
export type RoomType = (typeof roomTypes)[number];

export const bedTypes = ["INTENSIVE_CARE", "STANDARD"] as const;
export type BedType = (typeof bedTypes)[number];

export const bedStatuses = ["FREE", "RESERVED", "OCCUPIED"] as const;
export type BedStatus = (typeof bedStatuses)[number];

export const bedMaterials = [
  "BARIATRIC",
  "ELEVATING_LEG_REST",
  "PRESSURE_ULCER",
  "STANDARD",
] as const;
export type BedMaterial = (typeof bedMaterials)[number];

export const patientVisitTypes = ["INPATIENT", "OUTPATIENT"] as const;
export type PatientVisitType = (typeof patientVisitTypes)[number];

export const patientVisitStatuses = ["ACTIVE", "DISCHARGED"] as const;
export type PatientVisitStatus = (typeof patientVisitStatuses)[number];

export const socialSecurityNumbers = sqliteTable(
  "social_security_numbers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    number: text("number").notNull(),
    healthInsuranceProvider: text("health_insurance_provider").notNull(),
    insuranceType: text("insurance_type", {
      enum: insuranceTypes,
    }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("social_security_numbers_public_id_unique").on(table.publicId),
    uniqueIndex("social_security_numbers_number_unique").on(table.number),
  ],
);

export const patients = sqliteTable(
  "patients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    gender: text("gender", {
      enum: genders,
    }).notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    birthDate: text("birth_date").notNull(),
    birthplace: text("birthplace").notNull(),
    socialSecurityNumberId: integer("social_security_number_id")
      .notNull()
      .references(() => socialSecurityNumbers.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    telephoneNumber: text("telephone_number").notNull(),
    acceptedGdpr: integer("accepted_gdpr", {
      mode: "boolean",
    }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("patients_public_id_unique").on(table.publicId),
    uniqueIndex("patients_social_security_number_id_unique").on(
      table.socialSecurityNumberId,
    ),
    index("patients_created_at_id_idx").on(table.createdAt, table.id),
  ],
);

export const departments = sqliteTable(
  "departments",
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
    uniqueIndex("departments_public_id_unique").on(table.publicId),
    index("departments_created_at_id_idx").on(table.createdAt, table.id),
  ],
);

export const stations = sqliteTable(
  "stations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    stationType: text("station_type", {
      enum: stationTypes,
    }).notNull(),
    building: text("building").notNull().default("Haus 1"),
    floor: integer("floor").notNull().default(0),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("stations_public_id_unique").on(table.publicId),
    index("stations_department_id_idx").on(table.departmentId),
    index("stations_created_at_id_idx").on(table.createdAt, table.id),
  ],
);

export const rooms = sqliteTable(
  "rooms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    roomType: text("room_type", {
      enum: roomTypes,
    }).notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    stationId: integer("station_id")
      .notNull()
      .references(() => stations.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("rooms_public_id_unique").on(table.publicId),
    index("rooms_department_id_idx").on(table.departmentId),
    index("rooms_station_id_idx").on(table.stationId),
    index("rooms_created_at_id_idx").on(table.createdAt, table.id),
  ],
);

export const beds = sqliteTable(
  "beds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    bedType: text("bed_type", {
      enum: bedTypes,
    }).notNull(),
    status: text("status", {
      enum: bedStatuses,
    }).notNull(),
    material: text("material", {
      enum: bedMaterials,
    }).notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    stationId: integer("station_id")
      .notNull()
      .references(() => stations.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    roomId: integer("room_id").references(() => rooms.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("beds_public_id_unique").on(table.publicId),
    index("beds_department_id_idx").on(table.departmentId),
    index("beds_station_id_idx").on(table.stationId),
    index("beds_room_id_idx").on(table.roomId),
    index("beds_created_at_id_idx").on(table.createdAt, table.id),
  ],
);

export const patientVisits = sqliteTable(
  "patient_visits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    patientNumber: text("patient_number").notNull(),
    visitType: text("visit_type", {
      enum: patientVisitTypes,
    }).notNull(),
    status: text("status", {
      enum: patientVisitStatuses,
    }).notNull(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patients.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    stationId: integer("station_id").references(() => stations.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    roomId: integer("room_id").references(() => rooms.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    bedId: integer("bed_id").references(() => beds.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    startedDate: text("started_date").notNull(),
    startedTime: text("started_time").notNull(),
    endedDate: text("ended_date"),
    endedTime: text("ended_time"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("patient_visits_public_id_unique").on(table.publicId),
    uniqueIndex("patient_visits_active_patient_number_unique")
      .on(table.patientNumber)
      .where(sql`status = 'ACTIVE'`),
    // Enforces "one occupied bed = one active inpatient": at most one ACTIVE
    // INPATIENT visit may reference a given bed_id. The seed constructs this
    // invariant by hand (each active inpatient is pinned to a distinct bed);
    // this index makes the DB reject any future write that would violate it,
    // instead of silently producing wrong-patient data for a bed.
    uniqueIndex("patient_visits_active_inpatient_bed_unique")
      .on(table.bedId)
      .where(sql`${table.bedId} IS NOT NULL AND status = 'ACTIVE'`),
    check(
      "patient_visits_patient_number_format_check",
      sql`${table.patientNumber} GLOB '[0-9][0-9][0-9][0-9][0-9]'`,
    ),
    check(
      "patient_visits_inpatient_location_check",
      sql`(${table.visitType} = 'INPATIENT' AND ${table.stationId} IS NOT NULL AND ${table.roomId} IS NOT NULL AND ${table.bedId} IS NOT NULL) OR (${table.visitType} = 'OUTPATIENT' AND ${table.stationId} IS NULL AND ${table.roomId} IS NULL AND ${table.bedId} IS NULL)`,
    ),
    check(
      "patient_visits_room_requires_station_check",
      sql`${table.roomId} IS NULL OR ${table.stationId} IS NOT NULL`,
    ),
    check(
      "patient_visits_bed_requires_station_room_check",
      sql`${table.bedId} IS NULL OR (${table.stationId} IS NOT NULL AND ${table.roomId} IS NOT NULL)`,
    ),
    check(
      "patient_visits_status_end_time_check",
      sql`(${table.status} = 'ACTIVE' AND ${table.endedDate} IS NULL AND ${table.endedTime} IS NULL) OR (${table.status} = 'DISCHARGED' AND ${table.endedDate} IS NOT NULL AND ${table.endedTime} IS NOT NULL)`,
    ),
    index("patient_visits_patient_id_idx").on(table.patientId),
    index("patient_visits_department_id_idx").on(table.departmentId),
    index("patient_visits_station_id_idx").on(table.stationId),
    index("patient_visits_room_id_idx").on(table.roomId),
    index("patient_visits_bed_id_idx").on(table.bedId),
    index("patient_visits_created_at_id_idx").on(table.createdAt, table.id),
  ],
);

export const employees = sqliteTable(
  "employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    position: text("position").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("employees_public_id_unique").on(table.publicId),
    index("employees_department_id_idx").on(table.departmentId),
    index("employees_created_at_id_idx").on(table.createdAt, table.id),
  ],
);

export const appointmentTypes = sqliteTable(
  "appointment_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    defaultDurationMinutes: integer("default_duration_minutes").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("appointment_types_public_id_unique").on(table.publicId),
    index("appointment_types_department_id_idx").on(table.departmentId),
    index("appointment_types_created_at_id_idx").on(
      table.createdAt,
      table.id,
    ),
  ],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull(),
    scheduledDate: text("scheduled_date").notNull(),
    scheduledTime: text("scheduled_time").notNull(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patients.id, {
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

export const departmentsRelations = relations(departments, ({ many }) => ({
  employees: many(employees),
  appointmentTypes: many(appointmentTypes),
  stations: many(stations),
  rooms: many(rooms),
  beds: many(beds),
  patientVisits: many(patientVisits),
}));

export const stationsRelations = relations(stations, ({ one, many }) => ({
  department: one(departments, {
    fields: [stations.departmentId],
    references: [departments.id],
  }),
  rooms: many(rooms),
  beds: many(beds),
  patientVisits: many(patientVisits),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  department: one(departments, {
    fields: [rooms.departmentId],
    references: [departments.id],
  }),
  station: one(stations, {
    fields: [rooms.stationId],
    references: [stations.id],
  }),
  beds: many(beds),
  patientVisits: many(patientVisits),
}));

export const bedsRelations = relations(beds, ({ one, many }) => ({
  department: one(departments, {
    fields: [beds.departmentId],
    references: [departments.id],
  }),
  station: one(stations, {
    fields: [beds.stationId],
    references: [stations.id],
  }),
  room: one(rooms, {
    fields: [beds.roomId],
    references: [rooms.id],
  }),
  patientVisits: many(patientVisits),
}));

export const patientVisitsRelations = relations(patientVisits, ({ one }) => ({
  patient: one(patients, {
    fields: [patientVisits.patientId],
    references: [patients.id],
  }),
  department: one(departments, {
    fields: [patientVisits.departmentId],
    references: [departments.id],
  }),
  station: one(stations, {
    fields: [patientVisits.stationId],
    references: [stations.id],
  }),
  room: one(rooms, {
    fields: [patientVisits.roomId],
    references: [rooms.id],
  }),
  bed: one(beds, {
    fields: [patientVisits.bedId],
    references: [beds.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one }) => ({
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
}));

export const appointmentTypesRelations = relations(
  appointmentTypes,
  ({ one, many }) => ({
    department: one(departments, {
      fields: [appointmentTypes.departmentId],
      references: [departments.id],
    }),
    appointments: many(appointments),
  }),
);

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  appointmentType: one(appointmentTypes, {
    fields: [appointments.appointmentTypeId],
    references: [appointmentTypes.id],
  }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  socialSecurityNumber: one(socialSecurityNumbers, {
    fields: [patients.socialSecurityNumberId],
    references: [socialSecurityNumbers.id],
  }),
  appointments: many(appointments),
  patientVisits: many(patientVisits),
}));

export const socialSecurityNumbersRelations = relations(
  socialSecurityNumbers,
  ({ one }) => ({
    patient: one(patients, {
      fields: [socialSecurityNumbers.id],
      references: [patients.socialSecurityNumberId],
    }),
  }),
);

export const schema = {
  appointments,
  appointmentsRelations,
  appointmentTypes,
  appointmentTypesRelations,
  beds,
  bedsRelations,
  departments,
  departmentsRelations,
  employees,
  employeesRelations,
  patients,
  patientsRelations,
  patientVisits,
  patientVisitsRelations,
  rooms,
  roomsRelations,
  socialSecurityNumbers,
  socialSecurityNumbersRelations,
  stations,
  stationsRelations,
};

export type SocialSecurityNumberRow =
  typeof socialSecurityNumbers.$inferSelect;
export type NewSocialSecurityNumberRow =
  typeof socialSecurityNumbers.$inferInsert;
export type PatientRow = typeof patients.$inferSelect;
export type NewPatientRow = typeof patients.$inferInsert;
export type PatientVisitRow = typeof patientVisits.$inferSelect;
export type NewPatientVisitRow = typeof patientVisits.$inferInsert;
export type DepartmentRow = typeof departments.$inferSelect;
export type NewDepartmentRow = typeof departments.$inferInsert;
export type StationRow = typeof stations.$inferSelect;
export type NewStationRow = typeof stations.$inferInsert;
export type RoomRow = typeof rooms.$inferSelect;
export type NewRoomRow = typeof rooms.$inferInsert;
export type BedRow = typeof beds.$inferSelect;
export type NewBedRow = typeof beds.$inferInsert;
export type EmployeeRow = typeof employees.$inferSelect;
export type NewEmployeeRow = typeof employees.$inferInsert;
export type AppointmentTypeRow = typeof appointmentTypes.$inferSelect;
export type NewAppointmentTypeRow = typeof appointmentTypes.$inferInsert;
export type AppointmentRow = typeof appointments.$inferSelect;
export type NewAppointmentRow = typeof appointments.$inferInsert;
