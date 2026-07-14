export type BedStatus = "FREE" | "RESERVED" | "OCCUPIED";
export type BedType = "INTENSIVE_CARE" | "STANDARD";
export type StationType = "INTENSIVE" | "NORMAL";
export type VisitType = "INPATIENT" | "OUTPATIENT";
export type VisitStatus = "ACTIVE" | "DISCHARGED";
export type InsuranceType = "STATUTORY" | "PRIVATE";
export type Gender = "FEMALE" | "MALE" | "NON_BINARY" | "UNKNOWN";

export interface Pagination {
  self: string;
  next?: string;
  prev?: string;
  has_more: boolean;
}
export interface ListResponse<T> { data: T[]; pagination: Pagination }
export interface ItemResponse<T> { data: T }

export interface Department {
  id: string; name: string;
  current_capacity: number; max_capacity: number;
  created_at: string; updated_at: string;
}
export interface Station {
  id: string; name: string; station_type: StationType;
  department: string; created_at: string; updated_at: string;
}
export interface Room {
  id: string; name: string; room_type: string;
  bed_capacity: number; current_capacity: number;
  department: string; station: string;
  created_at: string; updated_at: string;
}
export interface Bed {
  id: string; bed_type: BedType; status: BedStatus; material: string;
  department: string; station: string; room: string | null;
  created_at: string; updated_at: string;
}
export interface PatientVisit {
  id: string; patient_number: string;
  visit_type: VisitType; status: VisitStatus;
  patient: { id: string; first_name: string; last_name: string; birth_date: string };
  department: string; station: string | null; room: string | null; bed: string | null;
  started_date: string; started_time: string;
  ended_date: string | null; ended_time: string | null;
  created_at: string; updated_at: string;
}
export interface Employee {
  id: string; first_name: string; last_name: string; position: string;
  department: string; created_at: string; updated_at: string;
}
export interface AppointmentType {
  id: string; name: string; department: string;
  default_duration_minutes: number; created_at: string; updated_at: string;
}
export interface Appointment {
  id: string; scheduled_date: string; scheduled_time: string;
  patient: { id: string }; appointment_type: AppointmentType;
  created_at: string; updated_at: string;
}
export interface SocialSecurityNumber {
  id: string; number: string; health_insurance_provider: string;
  insurance_type: InsuranceType; created_at: string; updated_at: string;
}
export interface Patient {
  id: string; gender: Gender; first_name: string; last_name: string;
  birth_date: string; birthplace: string;
  social_security_number: SocialSecurityNumber;
  telephone_number: string; accepted_gdpr: boolean;
  created_at: string; updated_at: string;
}

// ---- Financial + operations types (real /v1/financial/* and /v1/ops/* endpoints) ----
export interface FinancialSummary {
  revenue_today: number; revenue_mtd: number; outstanding: number;
  cost_today: number; margin_pct: number;
  payer_mix: { statutory: number; private: number };
}
export interface RevenuePoint { date: string; revenue: number; cost: number }
export interface DepartmentFinancial { department: string; revenue: number; cost: number }
export type InvoiceStatus = "PAID" | "OPEN" | "OVERDUE";
export interface Invoice {
  id: string; department: string; payer: string;
  insurance_type: InsuranceType; amount: number;
  status: InvoiceStatus; issued_date: string;
}
export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export interface Alert {
  id: string; severity: AlertSeverity; category: string;
  message: string; department: string; created_at: string;
}
export interface StaffingEntry {
  department: string; on_shift: number; on_call: number; total: number;
}

export interface OpsSummary {
  beds: { total: number; free: number; reserved: number; occupied: number; occupancy_pct: number };
  capacity: { current: number; max: number; pct: number };
  visits: { active: number; active_inpatient: number; active_outpatient: number; discharged: number };
  patients: { total: number }; employees: { total: number };
  departments: { total: number }; wards: { total: number };
  appointments_on_date: number;
}
export interface FloorSummary { building: string; level: number; label: string; ward_count: number; bed_total: number; occupied: number; occupancy_pct: number }
export interface FloorPatient { first_name: string; last_name: string; patient_number: string }
export interface FloorBed { id: string; status: BedStatus; room: string; patient?: FloorPatient }
export interface FloorRoom { id: string; name: string; room_type: string; bed_capacity: number; current_capacity: number; beds: FloorBed[] }
export interface FloorWard { id: string; name: string; station_type: string; department: string; rooms: FloorRoom[] }
export interface FloorDetail { building: string; level: number; label: string; wards: FloorWard[] }

// ---- Detail pages (single room / single patient) ----
export interface RoomBedOccupant {
  patient_id: string; first_name: string; last_name: string;
  patient_number: string; visit_id: string;
}
export interface RoomOccupancyBed {
  id: string; bed_type: BedType; status: BedStatus; material: string;
  occupant: RoomBedOccupant | null;
}
export interface RoomOccupancy { room: Room; beds: RoomOccupancyBed[] }
export interface PatientSearchResult {
  id: string; first_name: string; last_name: string; birth_date: string;
}
export interface PatientOverview {
  patient: Patient;
  current_visit: (PatientVisit & { room_id: string | null }) | null;
  appointments: Appointment[];
}
