import { useQuery } from "@tanstack/react-query";
import { fetchAll, fetchPage, getData } from "./client";
import type {
  Alert, Appointment, AppointmentType, Department, DepartmentFinancial,
  Employee, FinancialSummary, FloorDetail, FloorSummary, Invoice, OpsSummary,
  Patient, PatientOverview, PatientSearchResult, PatientVisit, RevenuePoint,
  Room, RoomOccupancy, StaffingEntry,
} from "./types";

// Custom hook — must be `use`-prefixed so rules-of-hooks lint is satisfied.
const useList = <T>(key: string, path: string) =>
  useQuery({ queryKey: [key], queryFn: () => fetchAll<T>(path) });

// Single-server-page hook — for tables/pages that show a bounded slice rather
// than the whole (potentially huge) collection. Distinct query keys from
// `useList` above so the two never collide in the cache.
const usePage = <T>(key: string, path: string) =>
  useQuery({ queryKey: [key, "page"], queryFn: () => fetchPage<T>(path) });

// Bounded dimension lists still legitimately fetch the whole (small) collection.
// Per-entity bulk hooks (beds/patients/visits/etc.) were removed: at hospital
// scale the browser must never fetch the full collection — pages use `usePage`
// for tables and `/ops/summary` + `/ops/floors` aggregates for everything else.
export const useDepartments = () => useList<Department>("departments", "/v1/departments?page_size=100");
export const useAppointmentTypes = () => useList<AppointmentType>("appointment-types", "/v1/appointment-types?page_size=100");

export const useRoomsPage = () => usePage<Room>("rooms", "/v1/rooms?page_size=50");
export const usePatientsPage = () => usePage<Patient>("patients", "/v1/patients?page_size=50");
export const usePatientVisitsPage = () => usePage<PatientVisit>("patient-visits", "/v1/patient-visits?page_size=50");
export const useEmployeesPage = () => usePage<Employee>("employees", "/v1/employees?page_size=50");

export const useFinancialSummary = () =>
  useQuery({ queryKey: ["financial-summary"], queryFn: () => getData<FinancialSummary>("/v1/financial/summary") });
export const useRevenueTrend = (days = 30) =>
  useQuery({ queryKey: ["revenue-trend", days], queryFn: () => getData<RevenuePoint[]>(`/v1/financial/revenue-trend?days=${days}`) });
export const useDepartmentFinancials = () =>
  useQuery({ queryKey: ["dept-financials"], queryFn: () => getData<DepartmentFinancial[]>("/v1/financial/by-department") });
export const useInvoices = () =>
  useQuery({ queryKey: ["invoices"], queryFn: () => fetchAll<Invoice>("/v1/financial/invoices?page_size=100") });
export const useAlerts = () =>
  useQuery({ queryKey: ["alerts"], queryFn: () => getData<Alert[]>("/v1/ops/alerts") });
export const useStaffing = () =>
  useQuery({ queryKey: ["staffing"], queryFn: () => getData<StaffingEntry[]>("/v1/ops/staffing") });

export const useOpsSummary = (date: string) =>
  useQuery({ queryKey: ["ops-summary", date], queryFn: () => getData<OpsSummary>(`/v1/ops/summary?date=${date}`) });
export const useAppointmentsOnDate = (date: string) =>
  useQuery({
    queryKey: ["appointments", "date", date],
    queryFn: () => fetchPage<Appointment>(`/v1/appointments?date=${date}&page_size=100`),
  });
export const useFloors = () =>
  useQuery({ queryKey: ["floors"], queryFn: () => getData<FloorSummary[]>("/v1/ops/floors") });
export const useFloorDetail = (building: string, level: number) =>
  useQuery({ queryKey: ["floor-detail", building, level], enabled: !!building,
    queryFn: () => getData<FloorDetail>(`/v1/ops/floors/detail?building=${encodeURIComponent(building)}&level=${level}`) });

export const useRoomOccupancy = (roomId: string) =>
  useQuery({ queryKey: ["room-occupancy", roomId], enabled: !!roomId,
    queryFn: () => getData<RoomOccupancy>(`/v1/rooms/${encodeURIComponent(roomId)}/occupancy`) });
export const usePatientOverview = (patientId: string) =>
  useQuery({ queryKey: ["patient-overview", patientId], enabled: !!patientId,
    queryFn: () => getData<PatientOverview>(`/v1/patients/${encodeURIComponent(patientId)}/overview`) });
export const usePatientSearch = (q: string) =>
  useQuery({
    queryKey: ["patient-search", q.trim()],
    enabled: q.trim().length >= 2,
    refetchInterval: false, // one-shot search — no polling
    staleTime: 10_000,
    queryFn: () => getData<PatientSearchResult[]>(`/v1/patients/search?q=${encodeURIComponent(q.trim())}&limit=8`),
  });
