# Command Center Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live, light-themed "command center" dashboard for the `Uniklikum X` hospital API, with a true-3D hospital overview and Logistics / Patients / Employees / Financial pages that auto-refresh every 5 seconds.

**Architecture:** A Vite + React + TypeScript app under `frontend/`, scaffolded with shadcn (preset `b67feOKh72`). Real hospital data is read through a Vite dev proxy to the existing Bun API at `:3000`; everything the backend lacks (financials, alerts, staffing) is served by MSW against a designed HTTP contract. TanStack Query polls every 5s, TanStack Router handles routing (code-based), TanStack Table renders grids. Pure modules (`hospital-model`, `kpis`, mock `generators`) hold all non-trivial logic and are unit-tested; React and Three components stay thin.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind + shadcn/ui, TanStack Query/Router/Table, react-three-fiber + drei + three, MSW, Recharts (via shadcn charts), Vitest.

## Global Constraints

- **No backend changes of any kind.** No new endpoints, no CORS edits, no schema/seed edits. Real data via Vite proxy only; missing data via MSW only. The one write the app performs is `POST /v1/database-seeds` (an existing endpoint) behind a "Reseed" button.
- **All app code lives under `frontend/`.** Never modify files outside `frontend/` (except this plan's own docs).
- **5-second polling:** the shared `QueryClient` sets `refetchInterval: 5000`, `staleTime: 4000`, `refetchOnWindowFocus: true`. Individual hooks do not re-specify intervals.
- **Package manager:** `bun`. Run scripts with `bun run ...`; one-off tools with `bunx --bun ...`.
- **Theme:** light enterprise. Do not introduce a dark background for the app or the 3D scene.
- **API envelope:** single resources are `{ data: T }`; lists are `{ data: T[], pagination: { self, next?, prev?, has_more } }`; fields are snake_case; errors are RFC 9457 `application/problem+json`.
- **Nested references are NAMES, not IDs**, except `patient_visit.bed` which is a bed public ID. Join the hospital hierarchy by name.
- **Determinism:** pure modules (`hospital-model.ts`, `kpis.ts`, `mocks/generators.ts`) must not call `Date.now()`/`Math.random()`. Randomness uses a seeded PRNG; "now" is passed in.
- **Seed department names** (the mock's department universe, order preserved):
  `Kardiologie`, `Zentrale Notaufnahme`, `Kinder- und Jugendmedizin`, `Radiologie`, `Orthopädie und Unfallchirurgie`, `Neurologie`, `Onkologie`, `Gastroenterologie`, `Nephrologie`, `Pneumologie`, `Geriatrie`, `Anästhesiologie und Intensivmedizin`.

---

## File Structure

```
frontend/
  index.html
  vite.config.ts                 # Vite + proxy + vitest config
  components.json                # shadcn (from scaffold)
  src/
    main.tsx                     # MSW bootstrap (dev) -> RouterProvider
    router.tsx                   # code-based TanStack Router: root + 5 routes
    index.css                    # tailwind + theme tokens (from scaffold)
    lib/
      utils.ts                   # cn() (from scaffold)
      query-client.ts            # QueryClient with 5s polling defaults
      api/
        types.ts                 # all API + mock response types
        client.ts                # getData(), fetchAll(), postData()
        queries.ts               # useDepartments()... useAlerts() etc.
      kpis.ts                    # PURE aggregations (tested)
      hospital-model.ts          # PURE scene tree + layout (tested)
      format.ts                  # tiny formatters (currency, pct, name)
    mocks/
      generators.ts              # PURE deterministic mock data (tested)
      handlers.ts                # MSW handlers for /v1/financial/* and /v1/ops/*
      browser.ts                 # setupWorker(...handlers)
    components/
      layout/
        app-shell.tsx            # sidebar + top bar + <Outlet/>
        sidebar-nav.tsx
        top-bar.tsx              # clock, polling indicator, pause, reseed
      kpi/
        kpi-tile.tsx
        capacity-bar.tsx
        status-dot.tsx
      data-table.tsx             # generic TanStack Table wrapper
      three/
        hospital-scene.tsx       # <Canvas> + lights + controls + content
        bed-instances.tsx        # instanced beds colored by status
        department-slab.tsx      # floor slab + label
        bed-inspector.tsx        # side panel for a selected bed
        scene-fallback.tsx       # 2D isometric fallback (no WebGL)
      alerts-ticker.tsx
    routes/
      overview.tsx               # 3D hero + KPI rail + alerts
      logistics.tsx
      patients.tsx
      employees.tsx
      financial.tsx
    test/
      setup.ts                   # vitest setup (if needed)
```

---

## Task 1: Scaffold the app, dependencies, proxy, and Vitest

**Files:**
- Create: everything under `frontend/` (via scaffold)
- Modify: `frontend/vite.config.ts`, `frontend/package.json`

**Interfaces:**
- Produces: a runnable Vite app on `:5173`; `/v1/*` proxied to `http://localhost:3000`; `bunx vitest run` works.

- [ ] **Step 1: Scaffold shadcn + Vite into `frontend/`**

The `frontend/` dir exists but is empty. From the repo root run:

```bash
cd /Users/yz/dev/github.com/yzaimoglu/hackathon-healthcare
rmdir frontend 2>/dev/null || true
bunx --bun shadcn@latest init --preset b67feOKh72 --template vite
```

When prompted for the project name/directory, use `frontend`. This creates a Vite React-TS app with Tailwind, `components.json`, `src/lib/utils.ts`, and `src/index.css` theme tokens. If the tool creates a differently named folder, rename it to `frontend`.

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
cd frontend
bun add @tanstack/react-query @tanstack/react-router @tanstack/react-table three @react-three/fiber @react-three/drei recharts
bun add -d msw vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Add shadcn UI primitives used across the app**

```bash
bunx --bun shadcn@latest add card badge button table separator tabs tooltip skeleton sonner chart scroll-area progress
```

Expected: files appear under `src/components/ui/`.

- [ ] **Step 4: Configure Vite proxy + Vitest**

Replace `frontend/vite.config.ts` with:

```ts
/// <reference types="vitest" />
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: [],
  },
});
```

(If the scaffold used the SWC plugin, keep it; only the `server.proxy` and `test` blocks must be added.)

- [ ] **Step 5: Add a `test` script**

In `frontend/package.json` `scripts`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify the app runs and the proxy works**

In one terminal, from repo root: `bun run dev` (backend on :3000).
In another, from `frontend/`: `bun run dev`.
Open `http://localhost:5173` — the default shadcn page renders.
Then verify the proxy in a shell:

```bash
curl -s http://localhost:5173/v1/health
```

Expected: `{"data":{"status":"OK"}}`.

- [ ] **Step 7: Commit**

```bash
cd /Users/yz/dev/github.com/yzaimoglu/hackathon-healthcare
git add frontend
git commit -m "chore(frontend): scaffold vite + shadcn + tanstack + proxy"
```

---

## Task 2: API types

**Files:**
- Create: `frontend/src/lib/api/types.ts`

**Interfaces:**
- Produces: all response types below (imported by client, queries, kpis, hospital-model, mocks, components).

- [ ] **Step 1: Write the types**

```ts
// frontend/src/lib/api/types.ts

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

// ---- MSW "v-next" contract (mocked now, backend later) ----
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
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api/types.ts
git commit -m "feat(frontend): api + mock contract types"
```

---

## Task 3: API client (TDD)

**Files:**
- Create: `frontend/src/lib/api/client.ts`
- Test: `frontend/src/lib/api/client.test.ts`

**Interfaces:**
- Consumes: `ItemResponse<T>`, `ListResponse<T>` from `./types`.
- Produces:
  - `getData<T>(path: string): Promise<T>` — GET, returns unwrapped `data`.
  - `fetchAll<T>(path: string): Promise<T[]>` — GET list, follows `pagination.next` until `has_more` is false, concatenates `data`.
  - `postData<T>(path: string, body?: unknown): Promise<T>` — POST, returns unwrapped `data`.
  - Throws `ApiError` (with `.status`) on non-2xx.

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/lib/api/client.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAll, getData } from "./client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("getData", () => {
  it("unwraps the data envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ data: { id: "dep_1", name: "Kardiologie" } }),
    );
    const dep = await getData<{ id: string; name: string }>("/v1/departments/dep_1");
    expect(dep).toEqual({ id: "dep_1", name: "Kardiologie" });
  });

  it("throws with status on error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ title: "Not Found" }, 404),
    );
    await expect(getData("/v1/departments/nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("fetchAll", () => {
  it("follows pagination.next and concatenates data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "a" }], pagination: { self: "/v1/beds", next: "/v1/beds?cursor=x", has_more: true } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "b" }], pagination: { self: "/v1/beds?cursor=x", has_more: false } }),
      );
    const rows = await fetchAll<{ id: string }>("/v1/beds");
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd frontend && bunx vitest run src/lib/api/client.test.ts
```

Expected: FAIL (module not found / functions undefined).

- [ ] **Step 3: Implement the client**

```ts
// frontend/src/lib/api/client.ts
import type { ItemResponse, ListResponse } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? "GET"} ${path} -> ${res.status}`);
  return res;
}

export async function getData<T>(path: string): Promise<T> {
  const res = await request(path);
  const body = (await res.json()) as ItemResponse<T>;
  return body.data;
}

export async function postData<T>(path: string, body?: unknown): Promise<T> {
  const res = await request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  const parsed = (await res.json()) as ItemResponse<T>;
  return parsed.data;
}

export async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = path;
  while (next) {
    const res = await request(next);
    const body = (await res.json()) as ListResponse<T>;
    out.push(...body.data);
    next = body.pagination.has_more ? body.pagination.next : undefined;
  }
  return out;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && bunx vitest run src/lib/api/client.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api/client.ts frontend/src/lib/api/client.test.ts
git commit -m "feat(frontend): api client with envelope unwrap + pagination (TDD)"
```

---

## Task 4: Query client + query hooks

**Files:**
- Create: `frontend/src/lib/query-client.ts`, `frontend/src/lib/api/queries.ts`

**Interfaces:**
- Consumes: `fetchAll`, `getData` from `./client`; all types from `./types`.
- Produces:
  - `queryClient` (configured `QueryClient`).
  - Real hooks (all return `UseQueryResult<T[]>` unless noted):
    `useDepartments`, `useStations`, `useRooms`, `useBeds`, `usePatients`, `usePatientVisits`, `useEmployees`, `useAppointments`, `useAppointmentTypes`.
  - Mock hooks:
    `useFinancialSummary(): UseQueryResult<FinancialSummary>`, `useRevenueTrend(days?: number): UseQueryResult<RevenuePoint[]>`, `useDepartmentFinancials(): UseQueryResult<DepartmentFinancial[]>`, `useInvoices(): UseQueryResult<Invoice[]>`, `useAlerts(): UseQueryResult<Alert[]>`, `useStaffing(): UseQueryResult<StaffingEntry[]>`.

- [ ] **Step 1: Write the query client**

```ts
// frontend/src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 5000,
      staleTime: 4000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
```

- [ ] **Step 2: Write the hooks**

```ts
// frontend/src/lib/api/queries.ts
import { useQuery } from "@tanstack/react-query";
import { fetchAll, getData } from "./client";
import type {
  Alert, Appointment, AppointmentType, Bed, Department, DepartmentFinancial,
  Employee, FinancialSummary, Invoice, Patient, PatientVisit, RevenuePoint,
  Room, StaffingEntry, Station,
} from "./types";

// Custom hook — must be `use`-prefixed so rules-of-hooks lint is satisfied.
const useList = <T>(key: string, path: string) =>
  useQuery({ queryKey: [key], queryFn: () => fetchAll<T>(path) });

export const useDepartments = () => useList<Department>("departments", "/v1/departments?page_size=100");
export const useStations = () => useList<Station>("stations", "/v1/stations?page_size=100");
export const useRooms = () => useList<Room>("rooms", "/v1/rooms?page_size=100");
export const useBeds = () => useList<Bed>("beds", "/v1/beds?page_size=100");
export const usePatients = () => useList<Patient>("patients", "/v1/patients?page_size=100");
export const usePatientVisits = () => useList<PatientVisit>("patient-visits", "/v1/patient-visits?page_size=100");
export const useEmployees = () => useList<Employee>("employees", "/v1/employees?page_size=100");
export const useAppointments = () => useList<Appointment>("appointments", "/v1/appointments?page_size=100");
export const useAppointmentTypes = () => useList<AppointmentType>("appointment-types", "/v1/appointment-types?page_size=100");

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
```

Note: `/financial/summary`, `/revenue-trend`, `/by-department`, `/ops/alerts`, `/ops/staffing` return a bare `{ data: T }` where `T` is an object or array; `/financial/invoices` is a paginated list. This matches the handlers in Task 8.

- [ ] **Step 3: Typecheck**

```bash
cd frontend && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/query-client.ts frontend/src/lib/api/queries.ts
git commit -m "feat(frontend): query client + polling hooks"
```

---

## Task 5: KPI aggregations (TDD)

**Files:**
- Create: `frontend/src/lib/kpis.ts`
- Test: `frontend/src/lib/kpis.test.ts`

**Interfaces:**
- Consumes: `Bed`, `Department`, `PatientVisit`, `Appointment`, `Employee` from `./api/types`.
- Produces:
  - `bedStats(beds: Bed[]): { total; free; reserved; occupied; occupancyPct }`
  - `hospitalCapacity(departments: Department[]): { current; max; pct }`
  - `visitStats(visits: PatientVisit[]): { active; discharged; activeInpatient; activeOutpatient }`
  - `appointmentsOn(appointments: Appointment[], isoDate: string): Appointment[]`
  - `headcountByDepartment(employees: Employee[]): { department: string; count: number }[]` (sorted desc by count)
  - `departmentUtilization(departments: Department[]): { department: string; current: number; max: number; pct: number }[]`
  - `pct(part: number, whole: number): number` (0 when whole is 0, rounded to 1 decimal)

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/lib/kpis.test.ts
import { describe, expect, it } from "vitest";
import type { Bed, Department, PatientVisit } from "./api/types";
import { bedStats, hospitalCapacity, pct, visitStats, appointmentsOn } from "./kpis";

const bed = (status: Bed["status"]): Bed => ({
  id: "b", bed_type: "STANDARD", status, material: "STANDARD",
  department: "d", station: "s", room: "r", created_at: "", updated_at: "",
});

describe("pct", () => {
  it("returns 0 when whole is 0", () => expect(pct(3, 0)).toBe(0));
  it("rounds to one decimal", () => expect(pct(1, 3)).toBe(33.3));
});

describe("bedStats", () => {
  it("counts by status and computes occupancy", () => {
    const stats = bedStats([bed("FREE"), bed("OCCUPIED"), bed("OCCUPIED"), bed("RESERVED")]);
    expect(stats).toMatchObject({ total: 4, free: 1, reserved: 1, occupied: 2, occupancyPct: 50 });
  });
});

describe("hospitalCapacity", () => {
  it("sums current and max across departments", () => {
    const deps = [
      { current_capacity: 10, max_capacity: 20 },
      { current_capacity: 5, max_capacity: 10 },
    ] as Department[];
    expect(hospitalCapacity(deps)).toEqual({ current: 15, max: 30, pct: 50 });
  });
});

describe("visitStats", () => {
  it("splits active by visit type and counts discharged", () => {
    const v = (status: PatientVisit["status"], type: PatientVisit["visit_type"]): PatientVisit => ({
      id: "v", patient_number: "1", visit_type: type, status,
      patient: { id: "p", first_name: "A", last_name: "B", birth_date: "" },
      department: "d", station: null, room: null, bed: null,
      started_date: "", started_time: "", ended_date: null, ended_time: null,
      created_at: "", updated_at: "",
    });
    const stats = visitStats([v("ACTIVE", "INPATIENT"), v("ACTIVE", "OUTPATIENT"), v("DISCHARGED", "INPATIENT")]);
    expect(stats).toEqual({ active: 2, discharged: 1, activeInpatient: 1, activeOutpatient: 1 });
  });
});

describe("appointmentsOn", () => {
  it("filters by scheduled_date", () => {
    const appts = [{ scheduled_date: "2026-07-10" }, { scheduled_date: "2026-07-11" }] as any;
    expect(appointmentsOn(appts, "2026-07-10")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && bunx vitest run src/lib/kpis.test.ts
```

- [ ] **Step 3: Implement**

```ts
// frontend/src/lib/kpis.ts
import type { Appointment, Bed, Department, Employee, PatientVisit } from "./api/types";

export function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function bedStats(beds: Bed[]) {
  const free = beds.filter((b) => b.status === "FREE").length;
  const reserved = beds.filter((b) => b.status === "RESERVED").length;
  const occupied = beds.filter((b) => b.status === "OCCUPIED").length;
  const total = beds.length;
  return { total, free, reserved, occupied, occupancyPct: pct(occupied, total) };
}

export function hospitalCapacity(departments: Department[]) {
  const current = departments.reduce((n, d) => n + d.current_capacity, 0);
  const max = departments.reduce((n, d) => n + d.max_capacity, 0);
  return { current, max, pct: pct(current, max) };
}

export function visitStats(visits: PatientVisit[]) {
  const active = visits.filter((v) => v.status === "ACTIVE");
  return {
    active: active.length,
    discharged: visits.filter((v) => v.status === "DISCHARGED").length,
    activeInpatient: active.filter((v) => v.visit_type === "INPATIENT").length,
    activeOutpatient: active.filter((v) => v.visit_type === "OUTPATIENT").length,
  };
}

export function appointmentsOn(appointments: Appointment[], isoDate: string): Appointment[] {
  return appointments.filter((a) => a.scheduled_date === isoDate);
}

export function headcountByDepartment(employees: Employee[]) {
  const counts = new Map<string, number>();
  for (const e of employees) counts.set(e.department, (counts.get(e.department) ?? 0) + 1);
  return [...counts.entries()]
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);
}

export function departmentUtilization(departments: Department[]) {
  return departments.map((d) => ({
    department: d.name,
    current: d.current_capacity,
    max: d.max_capacity,
    pct: pct(d.current_capacity, d.max_capacity),
  }));
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && bunx vitest run src/lib/kpis.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/kpis.ts frontend/src/lib/kpis.test.ts
git commit -m "feat(frontend): KPI aggregations (TDD)"
```

---

## Task 6: Hospital model + 3D layout (TDD)

**Files:**
- Create: `frontend/src/lib/hospital-model.ts`
- Test: `frontend/src/lib/hospital-model.test.ts`

**Interfaces:**
- Consumes: `Bed`, `Department`, `Room`, `Station`, `BedStatus` from `./api/types`.
- Produces:
  - `buildHospitalModel(input: { departments; stations; rooms; beds }): HospitalModel`
  - `computeLayout(model: HospitalModel): Layout`
  - Types:
    ```ts
    interface BedNode { id: string; status: BedStatus; bedType: string; material: string; roomName: string | null; stationName: string; departmentName: string }
    interface RoomNode { name: string; roomType: string; stationName: string; departmentName: string; beds: BedNode[] }
    interface StationNode { name: string; stationType: string; departmentName: string; rooms: RoomNode[] }
    interface DepartmentNode { name: string; currentCapacity: number; maxCapacity: number; utilizationPct: number; stations: StationNode[]; bedCount: number }
    interface HospitalModel { departments: DepartmentNode[]; bedById: Map<string, BedNode> }
    interface BedPlacement { bedId: string; status: BedStatus; position: [number, number, number]; departmentName: string }
    interface DepartmentSlab { name: string; utilizationPct: number; y: number; width: number; depth: number; centerX: number; centerZ: number }
    interface Layout { slabs: DepartmentSlab[]; beds: BedPlacement[]; bounds: { width: number; depth: number; height: number } }
    ```
- Join rule: beds→rooms→stations→departments by NAME. Order: departments in `departments[]` order; stations/rooms in their list order filtered to the parent name. Layout is deterministic (index-derived positions).

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/lib/hospital-model.test.ts
import { describe, expect, it } from "vitest";
import type { Bed, Department, Room, Station } from "./api/types";
import { buildHospitalModel, computeLayout } from "./hospital-model";

const dep = (name: string, cur = 10, max = 20): Department => ({
  id: name, name, current_capacity: cur, max_capacity: max, created_at: "", updated_at: "",
});
const sta = (name: string, department: string): Station => ({
  id: name, name, station_type: "NORMAL", department, created_at: "", updated_at: "",
});
const room = (name: string, station: string, department: string): Room => ({
  id: name, name, room_type: "GROUP_ROOM", bed_capacity: 2, current_capacity: 1,
  department, station, created_at: "", updated_at: "",
});
const bed = (id: string, status: Bed["status"], roomName: string, station: string, department: string): Bed => ({
  id, bed_type: "STANDARD", status, material: "STANDARD",
  department, station, room: roomName, created_at: "", updated_at: "",
});

const input = {
  departments: [dep("Kardiologie"), dep("Radiologie")],
  stations: [sta("K-Int", "Kardiologie"), sta("R-Int", "Radiologie")],
  rooms: [room("K-101", "K-Int", "Kardiologie"), room("R-101", "R-Int", "Radiologie")],
  beds: [
    bed("bed_1", "OCCUPIED", "K-101", "K-Int", "Kardiologie"),
    bed("bed_2", "FREE", "K-101", "K-Int", "Kardiologie"),
    bed("bed_3", "RESERVED", "R-101", "R-Int", "Radiologie"),
  ],
};

describe("buildHospitalModel", () => {
  it("nests beds under rooms/stations/departments by name", () => {
    const model = buildHospitalModel(input);
    expect(model.departments.map((d) => d.name)).toEqual(["Kardiologie", "Radiologie"]);
    expect(model.departments[0].stations[0].rooms[0].beds.map((b) => b.id)).toEqual(["bed_1", "bed_2"]);
    expect(model.departments[0].bedCount).toBe(2);
    expect(model.departments[0].utilizationPct).toBe(50);
  });
  it("indexes beds by id", () => {
    const model = buildHospitalModel(input);
    expect(model.bedById.get("bed_3")?.departmentName).toBe("Radiologie");
  });
});

describe("computeLayout", () => {
  it("produces one slab per department and one placement per bed, deterministically", () => {
    const a = computeLayout(buildHospitalModel(input));
    const b = computeLayout(buildHospitalModel(input));
    expect(a.slabs.map((s) => s.name)).toEqual(["Kardiologie", "Radiologie"]);
    expect(a.beds).toHaveLength(3);
    expect(a).toEqual(b); // deterministic
    // departments occupy different floors (distinct y)
    expect(a.slabs[0].y).not.toBe(a.slabs[1].y);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && bunx vitest run src/lib/hospital-model.test.ts
```

- [ ] **Step 3: Implement**

```ts
// frontend/src/lib/hospital-model.ts
import type { Bed, BedStatus, Department, Room, Station } from "./api/types";

export interface BedNode {
  id: string; status: BedStatus; bedType: string; material: string;
  roomName: string | null; stationName: string; departmentName: string;
}
export interface RoomNode { name: string; roomType: string; stationName: string; departmentName: string; beds: BedNode[] }
export interface StationNode { name: string; stationType: string; departmentName: string; rooms: RoomNode[] }
export interface DepartmentNode {
  name: string; currentCapacity: number; maxCapacity: number;
  utilizationPct: number; stations: StationNode[]; bedCount: number;
}
export interface HospitalModel { departments: DepartmentNode[]; bedById: Map<string, BedNode> }

export interface BedPlacement { bedId: string; status: BedStatus; position: [number, number, number]; departmentName: string }
export interface DepartmentSlab {
  name: string; utilizationPct: number; y: number;
  width: number; depth: number; centerX: number; centerZ: number;
}
export interface Layout {
  slabs: DepartmentSlab[]; beds: BedPlacement[];
  bounds: { width: number; depth: number; height: number };
}

function utilPct(current: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((current / max) * 1000) / 10;
}

export function buildHospitalModel(input: {
  departments: Department[]; stations: Station[]; rooms: Room[]; beds: Bed[];
}): HospitalModel {
  const bedById = new Map<string, BedNode>();

  const departments = input.departments.map((d): DepartmentNode => {
    const depStations = input.stations.filter((s) => s.department === d.name);
    let bedCount = 0;

    const stations = depStations.map((s): StationNode => {
      const staRooms = input.rooms.filter((r) => r.station === s.name && r.department === d.name);
      const rooms = staRooms.map((r): RoomNode => {
        const roomBeds = input.beds
          .filter((b) => b.room === r.name && b.station === s.name)
          .map((b): BedNode => {
            const node: BedNode = {
              id: b.id, status: b.status, bedType: b.bed_type, material: b.material,
              roomName: b.room, stationName: b.station, departmentName: b.department,
            };
            bedById.set(b.id, node);
            return node;
          });
        bedCount += roomBeds.length;
        return { name: r.name, roomType: r.room_type, stationName: s.name, departmentName: d.name, beds: roomBeds };
      });
      return { name: s.name, stationType: s.station_type, departmentName: d.name, rooms };
    });

    return {
      name: d.name, currentCapacity: d.current_capacity, maxCapacity: d.max_capacity,
      utilizationPct: utilPct(d.current_capacity, d.max_capacity), stations, bedCount,
    };
  });

  return { departments, bedById };
}

// Layout constants (world units)
const FLOOR_HEIGHT = 3;
const BEDS_PER_ROW = 8;
const BED_SPACING_X = 1.4;
const BED_SPACING_Z = 1.6;
const SLAB_PADDING = 1.5;

export function computeLayout(model: HospitalModel): Layout {
  const slabs: DepartmentSlab[] = [];
  const beds: BedPlacement[] = [];
  let maxCols = BEDS_PER_ROW;
  let maxRows = 1;

  model.departments.forEach((dept, floor) => {
    const y = floor * FLOOR_HEIGHT;
    const flatBeds = dept.stations.flatMap((s) => s.rooms.flatMap((r) => r.beds));
    const cols = Math.min(BEDS_PER_ROW, Math.max(1, flatBeds.length));
    const rows = Math.max(1, Math.ceil(flatBeds.length / BEDS_PER_ROW));
    maxCols = Math.max(maxCols, cols);
    maxRows = Math.max(maxRows, rows);

    flatBeds.forEach((b, i) => {
      const col = i % BEDS_PER_ROW;
      const row = Math.floor(i / BEDS_PER_ROW);
      const x = (col - (BEDS_PER_ROW - 1) / 2) * BED_SPACING_X;
      const z = row * BED_SPACING_Z;
      beds.push({ bedId: b.id, status: b.status, position: [x, y + 0.4, z], departmentName: dept.name });
    });

    const width = BEDS_PER_ROW * BED_SPACING_X + SLAB_PADDING;
    const depth = maxRows * BED_SPACING_Z + SLAB_PADDING;
    slabs.push({
      name: dept.name, utilizationPct: dept.utilizationPct, y,
      width, depth, centerX: 0, centerZ: ((rows - 1) * BED_SPACING_Z) / 2,
    });
  });

  return {
    slabs, beds,
    bounds: {
      width: maxCols * BED_SPACING_X + SLAB_PADDING,
      depth: maxRows * BED_SPACING_Z + SLAB_PADDING,
      height: model.departments.length * FLOOR_HEIGHT,
    },
  };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && bunx vitest run src/lib/hospital-model.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/hospital-model.ts frontend/src/lib/hospital-model.test.ts
git commit -m "feat(frontend): hospital model + deterministic 3D layout (TDD)"
```

---

## Task 7: Mock generators (TDD)

**Files:**
- Create: `frontend/src/mocks/generators.ts`
- Test: `frontend/src/mocks/generators.test.ts`

**Interfaces:**
- Consumes: mock types from `../lib/api/types`; `SEED_DEPARTMENTS` constant defined here.
- Produces (all deterministic given the same `seed`):
  - `mulberry32(seed: number): () => number`
  - `SEED_DEPARTMENTS: string[]` (the 12 names from Global Constraints, in order)
  - `financialSummary(seed?: number): FinancialSummary`
  - `revenueTrend(days: number, seed?: number): RevenuePoint[]` (ascending dates ending at `endDate`, default derived from index — no `Date.now`)
  - `departmentFinancials(seed?: number): DepartmentFinancial[]` (one per SEED_DEPARTMENTS)
  - `invoices(count: number, seed?: number): Invoice[]`
  - `alerts(seed?: number): Alert[]`
  - `staffing(seed?: number): StaffingEntry[]` (one per SEED_DEPARTMENTS)
- `revenueTrend` dates: pass `endDate` as an ISO string param `revenueTrend(days, seed?, endDate = "2026-07-10")` so it stays deterministic and testable.

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/mocks/generators.test.ts
import { describe, expect, it } from "vitest";
import {
  SEED_DEPARTMENTS, alerts, departmentFinancials, financialSummary,
  invoices, mulberry32, revenueTrend, staffing,
} from "./generators";

describe("mulberry32", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(42); const b = mulberry32(42);
    expect(a()).toBe(b());
  });
});

describe("financialSummary", () => {
  it("is deterministic and internally consistent", () => {
    const s = financialSummary(1);
    expect(financialSummary(1)).toEqual(s);
    expect(s.payer_mix.statutory + s.payer_mix.private).toBe(100);
    expect(s.revenue_today).toBeGreaterThan(0);
  });
});

describe("revenueTrend", () => {
  it("returns `days` ascending points ending at endDate", () => {
    const t = revenueTrend(30, 1, "2026-07-10");
    expect(t).toHaveLength(30);
    expect(t[t.length - 1].date).toBe("2026-07-10");
    expect(t[0].date < t[t.length - 1].date).toBe(true);
  });
});

describe("departmentFinancials / staffing", () => {
  it("cover every seed department", () => {
    expect(departmentFinancials(1).map((d) => d.department)).toEqual(SEED_DEPARTMENTS);
    expect(staffing(1)).toHaveLength(SEED_DEPARTMENTS.length);
  });
});

describe("invoices / alerts", () => {
  it("produce the requested shapes deterministically", () => {
    expect(invoices(20, 1)).toHaveLength(20);
    expect(invoices(20, 1)).toEqual(invoices(20, 1));
    const a = alerts(1);
    expect(a.length).toBeGreaterThan(0);
    expect(["INFO", "WARNING", "CRITICAL"]).toContain(a[0].severity);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && bunx vitest run src/mocks/generators.test.ts
```

- [ ] **Step 3: Implement**

```ts
// frontend/src/mocks/generators.ts
import type {
  Alert, AlertSeverity, DepartmentFinancial, FinancialSummary,
  Invoice, InvoiceStatus, RevenuePoint, StaffingEntry,
} from "../lib/api/types";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED_DEPARTMENTS = [
  "Kardiologie", "Zentrale Notaufnahme", "Kinder- und Jugendmedizin", "Radiologie",
  "Orthopädie und Unfallchirurgie", "Neurologie", "Onkologie", "Gastroenterologie",
  "Nephrologie", "Pneumologie", "Geriatrie", "Anästhesiologie und Intensivmedizin",
];

const PAYERS = [
  "Techniker Krankenkasse", "AOK Bayern", "Barmer", "DAK-Gesundheit",
  "Debeka Krankenversicherung", "Allianz Private Krankenversicherung",
];

const round = (n: number) => Math.round(n);

function isoMinus(endDate: string, daysBack: number): string {
  // endDate is "YYYY-MM-DD"; subtract days using UTC math (deterministic).
  const [y, m, d] = endDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - daysBack));
  return dt.toISOString().slice(0, 10);
}

export function financialSummary(seed = 1): FinancialSummary {
  const rnd = mulberry32(seed);
  const revenue_today = round(180_000 + rnd() * 120_000);
  const cost_today = round(revenue_today * (0.6 + rnd() * 0.15));
  const statutory = round(62 + rnd() * 16); // correlates to real ~70/30 split
  return {
    revenue_today,
    revenue_mtd: round(revenue_today * (9 + rnd() * 4)),
    outstanding: round(200_000 + rnd() * 300_000),
    cost_today,
    margin_pct: Math.round(((revenue_today - cost_today) / revenue_today) * 1000) / 10,
    payer_mix: { statutory, private: 100 - statutory },
  };
}

export function revenueTrend(days: number, seed = 1, endDate = "2026-07-10"): RevenuePoint[] {
  const rnd = mulberry32(seed);
  const out: RevenuePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const revenue = round(150_000 + rnd() * 150_000);
    out.push({ date: isoMinus(endDate, i), revenue, cost: round(revenue * (0.55 + rnd() * 0.2)) });
  }
  return out;
}

export function departmentFinancials(seed = 1): DepartmentFinancial[] {
  const rnd = mulberry32(seed);
  return SEED_DEPARTMENTS.map((department) => {
    const revenue = round(40_000 + rnd() * 260_000);
    return { department, revenue, cost: round(revenue * (0.55 + rnd() * 0.25)) };
  });
}

const INVOICE_STATUSES: InvoiceStatus[] = ["PAID", "PAID", "OPEN", "OVERDUE"];

export function invoices(count: number, seed = 1): Invoice[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const isPrivate = rnd() > 0.7;
    return {
      id: `inv_${String(i + 1).padStart(5, "0")}`,
      department: SEED_DEPARTMENTS[i % SEED_DEPARTMENTS.length],
      payer: PAYERS[Math.floor(rnd() * PAYERS.length)],
      insurance_type: isPrivate ? "PRIVATE" : "STATUTORY",
      amount: round(400 + rnd() * 9_600),
      status: INVOICE_STATUSES[Math.floor(rnd() * INVOICE_STATUSES.length)],
      issued_date: isoMinus("2026-07-10", Math.floor(rnd() * 45)),
    };
  });
}

const ALERT_TEMPLATES: { severity: AlertSeverity; category: string; message: string }[] = [
  { severity: "CRITICAL", category: "CAPACITY", message: "ICU occupancy above 95%" },
  { severity: "WARNING", category: "CAPACITY", message: "Department nearing max capacity" },
  { severity: "WARNING", category: "STAFFING", message: "Night shift understaffed" },
  { severity: "INFO", category: "LOGISTICS", message: "Bed cleaning completed" },
  { severity: "CRITICAL", category: "EMERGENCY", message: "Incoming trauma — Schockraum on standby" },
  { severity: "INFO", category: "APPOINTMENTS", message: "Peak outpatient volume in the next hour" },
];

export function alerts(seed = 1): Alert[] {
  const rnd = mulberry32(seed);
  return ALERT_TEMPLATES.map((t, i) => ({
    id: `alt_${i + 1}`,
    severity: t.severity, category: t.category, message: t.message,
    department: SEED_DEPARTMENTS[Math.floor(rnd() * SEED_DEPARTMENTS.length)],
    created_at: "2026-07-10T09:0" + i + ":00.000+02:00",
  }));
}

export function staffing(seed = 1): StaffingEntry[] {
  const rnd = mulberry32(seed);
  return SEED_DEPARTMENTS.map((department) => {
    const total = 8 + Math.floor(rnd() * 22);
    const on_shift = Math.floor(total * (0.4 + rnd() * 0.4));
    return { department, on_shift, on_call: Math.floor(rnd() * 4), total };
  });
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && bunx vitest run src/mocks/generators.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/mocks/generators.ts frontend/src/mocks/generators.test.ts
git commit -m "feat(frontend): deterministic mock data generators (TDD)"
```

---

## Task 8: MSW handlers, worker, and dev bootstrap

**Files:**
- Create: `frontend/src/mocks/handlers.ts`, `frontend/src/mocks/browser.ts`, `frontend/src/main.tsx` (replace), `frontend/src/router.tsx` (stub for now — full in Task 9)
- Command: `bunx msw init public/ --save`

**Interfaces:**
- Consumes: generators from `./generators`.
- Produces: `handlers` array; `worker` (setupWorker); MSW started in dev with `onUnhandledRequest: "bypass"` before React renders.

- [ ] **Step 1: Generate the service worker script**

```bash
cd frontend && bunx msw init public/ --save
```

Expected: `frontend/public/mockServiceWorker.js` created.

- [ ] **Step 2: Write handlers**

```ts
// frontend/src/mocks/handlers.ts
import { HttpResponse, http } from "msw";
import {
  alerts, departmentFinancials, financialSummary, invoices, revenueTrend, staffing,
} from "./generators";

const data = <T>(value: T) => HttpResponse.json({ data: value });

export const handlers = [
  http.get("/v1/financial/summary", () => data(financialSummary())),
  http.get("/v1/financial/revenue-trend", ({ request }) => {
    const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
    return data(revenueTrend(days));
  }),
  http.get("/v1/financial/by-department", () => data(departmentFinancials())),
  http.get("/v1/financial/invoices", () =>
    HttpResponse.json({
      data: invoices(48),
      pagination: { self: "/v1/financial/invoices", has_more: false },
    }),
  ),
  http.get("/v1/ops/alerts", () => data(alerts())),
  http.get("/v1/ops/staffing", () => data(staffing())),
];
```

- [ ] **Step 3: Write the worker**

```ts
// frontend/src/mocks/browser.ts
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
```

- [ ] **Step 4: Write a stub router (replaced in Task 9)**

```tsx
// frontend/src/router.tsx
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <div style={{ padding: 24 }}>Command Center — booting…</div>,
});

const routeTree = rootRoute.addChildren([indexRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
```

- [ ] **Step 5: Replace `main.tsx`**

```tsx
// frontend/src/main.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { queryClient } from "./lib/query-client";
import { router } from "./router";
import "./index.css";

async function enableMocking() {
  if (!import.meta.env.DEV) return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
```

- [ ] **Step 6: Verify mocks + real data both work**

With backend running and `bun run dev` in `frontend/`, open `http://localhost:5173` and in the browser console:

```js
await fetch("/v1/financial/summary").then((r) => r.json());  // MSW: { data: {...} }
await fetch("/v1/departments?page_size=3").then((r) => r.json()); // proxy->backend: real departments
```

Expected: the first is mock data; the second is real backend data. The MSW startup log appears in the console.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/mocks frontend/src/main.tsx frontend/src/router.tsx frontend/public/mockServiceWorker.js
git commit -m "feat(frontend): MSW mock layer + app bootstrap"
```

---

## Task 9: App shell, navigation, and routes

**Files:**
- Create: `frontend/src/lib/format.ts`, `frontend/src/components/layout/app-shell.tsx`, `sidebar-nav.tsx`, `top-bar.tsx`, `frontend/src/components/kpi/{kpi-tile,capacity-bar,status-dot}.tsx`
- Replace: `frontend/src/router.tsx`
- Create stubs: `frontend/src/routes/{overview,logistics,patients,employees,financial}.tsx`

**Interfaces:**
- Consumes: shadcn `ui/*`, `useQueryClient`, `postData`.
- Produces:
  - `formatCurrency(n)`, `formatPct(n)`, `formatDateTime(date, time)`, `fullName(first, last)` in `format.ts`.
  - `<AppShell>` wraps `<Outlet/>` with sidebar + top bar.
  - `<KpiTile title value hint tone?>`, `<CapacityBar value max label?>`, `<StatusDot status>`.
  - Router with routes `/`, `/logistics`, `/patients`, `/employees`, `/financial`.

- [ ] **Step 1: Formatters**

```ts
// frontend/src/lib/format.ts
export const formatCurrency = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
export const formatPct = (n: number) => `${n}%`;
export const fullName = (first: string, last: string) => `${first} ${last}`;
export const formatDateTime = (date: string, time?: string | null) =>
  time ? `${date} ${time}` : date;
```

- [ ] **Step 2: KPI components**

```tsx
// frontend/src/components/kpi/status-dot.tsx
import type { BedStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  FREE: "bg-emerald-500", RESERVED: "bg-amber-500", OCCUPIED: "bg-rose-500",
};
export function StatusDot({ status, className }: { status: BedStatus; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", TONE[status], className)} />;
}
```

```tsx
// frontend/src/components/kpi/capacity-bar.tsx
import { Progress } from "@/components/ui/progress";
export function CapacityBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const tone = pct >= 95 ? "text-rose-600" : pct >= 80 ? "text-amber-600" : "text-emerald-600";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={tone}>{value}/{max} · {pct}%</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}
```

```tsx
// frontend/src/components/kpi/kpi-tile.tsx
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiTile({
  title, value, hint, tone = "default",
}: { title: string; value: string | number; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneClass = {
    default: "text-foreground", good: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className={cn("mt-1 text-3xl font-semibold tabular-nums", toneClass)}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Sidebar, top bar, shell**

```tsx
// frontend/src/components/layout/sidebar-nav.tsx
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/logistics", label: "Logistics" },
  { to: "/patients", label: "Patients" },
  { to: "/employees", label: "Employees" },
  { to: "/financial", label: "Financial" },
] as const;

export function SidebarNav() {
  return (
    <aside className="flex w-56 flex-col border-r bg-card">
      <div className="px-5 py-4">
        <div className="text-sm font-semibold">Uniklikum X</div>
        <div className="text-xs text-muted-foreground">Command Center</div>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            activeProps={{ className: cn("bg-accent font-medium text-foreground") }}
            activeOptions={{ exact: n.to === "/" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

```tsx
// frontend/src/components/layout/top-bar.tsx
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { postData } from "@/lib/api/client";

export function TopBar() {
  const [now, setNow] = useState(() => new Date());
  const fetching = useIsFetching();
  const qc = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function reseed() {
    try {
      await postData("/v1/database-seeds");
      await qc.invalidateQueries();
      toast.success("Hospital demo data reseeded");
    } catch {
      toast.error("Reseed failed — is the backend running?");
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2">
        <Badge variant={fetching ? "default" : "secondary"} className="gap-1">
          <span className={`h-2 w-2 rounded-full ${fetching ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
          {fetching ? "LIVE · syncing" : "LIVE"}
        </Badge>
        <span className="text-sm tabular-nums text-muted-foreground">
          {now.toLocaleTimeString("de-DE")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries()}>Refresh</Button>
        <Button size="sm" onClick={reseed}>Reseed demo data</Button>
      </div>
    </header>
  );
}
```

```tsx
// frontend/src/components/layout/app-shell.tsx
import { Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

export function AppShell() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <SidebarNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
```

- [ ] **Step 4: Route stubs**

Create five files; each default-exports a component named after the file. Content for each (replace `Overview`/`/overview` per file):

```tsx
// frontend/src/routes/overview.tsx
export function OverviewPage() {
  return <h1 className="text-2xl font-semibold">Overview</h1>;
}
```

Repeat for `logistics.tsx` (`LogisticsPage`), `patients.tsx` (`PatientsPage`), `employees.tsx` (`EmployeesPage`), `financial.tsx` (`FinancialPage`).

- [ ] **Step 5: Real router**

```tsx
// frontend/src/router.tsx
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { OverviewPage } from "@/routes/overview";
import { LogisticsPage } from "@/routes/logistics";
import { PatientsPage } from "@/routes/patients";
import { EmployeesPage } from "@/routes/employees";
import { FinancialPage } from "@/routes/financial";

const rootRoute = createRootRoute({ component: AppShell });
const route = (path: string, component: () => JSX.Element) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

const routeTree = rootRoute.addChildren([
  route("/", OverviewPage),
  route("/logistics", LogisticsPage),
  route("/patients", PatientsPage),
  route("/employees", EmployeesPage),
  route("/financial", FinancialPage),
]);

export const router = createRouter({ routeTree });
declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
```

- [ ] **Step 6: Verify navigation + typecheck**

```bash
cd frontend && bun run typecheck && bun run dev
```

Open `http://localhost:5173`, click each sidebar item, confirm routing and the live clock/badge in the top bar. Confirm "Reseed demo data" shows a success toast (backend running).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components frontend/src/routes frontend/src/router.tsx frontend/src/lib/format.ts
git commit -m "feat(frontend): app shell, navigation, KPI primitives, routes"
```

---

## Task 10: Generic DataTable

**Files:**
- Create: `frontend/src/components/data-table.tsx`

**Interfaces:**
- Consumes: `@tanstack/react-table`, shadcn `ui/table`.
- Produces: `DataTable<T>({ columns, data, empty? })` using `ColumnDef<T>` from `@tanstack/react-table`.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/components/data-table.tsx
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export function DataTable<T>({
  columns, data, empty = "No data",
}: { columns: ColumnDef<T, any>[]; data: T[]; empty?: string }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">{empty}</TableCell></TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && bun run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/data-table.tsx
git commit -m "feat(frontend): generic TanStack DataTable"
```

---

## Task 11: Logistics page

**Files:**
- Replace: `frontend/src/routes/logistics.tsx`

**Interfaces:**
- Consumes: `useDepartments`, `useBeds`, `useRooms`, `useStations`; `bedStats`, `departmentUtilization`; `KpiTile`, `CapacityBar`, `StatusDot`, `DataTable`.
- Produces: `LogisticsPage`.

- [ ] **Step 1: Implement**

```tsx
// frontend/src/routes/logistics.tsx
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { CapacityBar } from "@/components/kpi/capacity-bar";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { StatusDot } from "@/components/kpi/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBeds, useDepartments, useRooms, useStations } from "@/lib/api/queries";
import type { Room } from "@/lib/api/types";
import { bedStats, departmentUtilization } from "@/lib/kpis";

const roomColumns: ColumnDef<Room, any>[] = [
  { header: "Room", accessorKey: "name" },
  { header: "Type", accessorKey: "room_type" },
  { header: "Department", accessorKey: "department" },
  { header: "Station", accessorKey: "station" },
  { header: "Occupied / Beds", cell: ({ row }) => `${row.original.current_capacity} / ${row.original.bed_capacity}` },
];

export function LogisticsPage() {
  const departments = useDepartments();
  const beds = useBeds();
  const rooms = useRooms();
  const stations = useStations();

  if (beds.isLoading || departments.isLoading) {
    return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const stats = bedStats(beds.data ?? []);
  const util = departmentUtilization(departments.data ?? []);
  const intensive = (stations.data ?? []).filter((s) => s.station_type === "INTENSIVE").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Logistics</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile title="Occupied beds" value={stats.occupied} hint={`${stats.occupancyPct}% occupancy`} tone="bad" />
        <KpiTile title="Free beds" value={stats.free} tone="good" />
        <KpiTile title="Reserved beds" value={stats.reserved} tone="warn" />
        <KpiTile title="Intensive stations" value={intensive} hint={`${stations.data?.length ?? 0} stations total`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Department capacity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {util.map((d) => <CapacityBar key={d.department} label={d.department} value={d.current} max={d.max} />)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bed status</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-1">
              {(beds.data ?? []).map((b) => <StatusDot key={b.id} status={b.status} className="h-4 w-4" />)}
            </div>
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><StatusDot status="FREE" /> Free</span>
              <span className="flex items-center gap-1"><StatusDot status="RESERVED" /> Reserved</span>
              <span className="flex items-center gap-1"><StatusDot status="OCCUPIED" /> Occupied</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Rooms</CardTitle></CardHeader>
        <CardContent><DataTable columns={roomColumns} data={rooms.data ?? []} /></CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && bun run typecheck && bun run dev
```

Open `/logistics`: KPI tiles show real counts, capacity bars per department, a 96-dot bed grid, and a rooms table. Watch a value change after a reseed (Reseed button).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/logistics.tsx
git commit -m "feat(frontend): logistics page"
```

---

## Task 12: Patients page

**Files:**
- Replace: `frontend/src/routes/patients.tsx`

**Interfaces:**
- Consumes: `usePatientVisits`, `useAppointments`, `usePatients`; `visitStats`, `appointmentsOn`; `DataTable`, `KpiTile`, shadcn `Badge`, `Tabs`.
- Produces: `PatientsPage`. Uses a fixed demo "today" = `"2026-07-10"` (matches seed appointment dates; noted inline).

- [ ] **Step 1: Implement**

```tsx
// frontend/src/routes/patients.tsx
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppointments, usePatients, usePatientVisits } from "@/lib/api/queries";
import type { Appointment, Patient, PatientVisit } from "@/lib/api/types";
import { appointmentsOn, visitStats } from "@/lib/kpis";
import { fullName } from "@/lib/format";

const DEMO_TODAY = "2026-07-10"; // seed appointments are dated from this day

const visitColumns: ColumnDef<PatientVisit, any>[] = [
  { header: "No.", accessorKey: "patient_number" },
  { header: "Patient", cell: ({ row }) => fullName(row.original.patient.first_name, row.original.patient.last_name) },
  { header: "Type", cell: ({ row }) => <Badge variant="outline">{row.original.visit_type}</Badge> },
  { header: "Status", cell: ({ row }) => (
      <Badge variant={row.original.status === "ACTIVE" ? "default" : "secondary"}>{row.original.status}</Badge>
    ) },
  { header: "Department", accessorKey: "department" },
  { header: "Since", cell: ({ row }) => `${row.original.started_date} ${row.original.started_time}` },
];

const patientColumns: ColumnDef<Patient, any>[] = [
  { header: "Patient", cell: ({ row }) => fullName(row.original.first_name, row.original.last_name) },
  { header: "Born", accessorKey: "birth_date" },
  { header: "Insurance", cell: ({ row }) => row.original.social_security_number.insurance_type },
  { header: "Provider", cell: ({ row }) => row.original.social_security_number.health_insurance_provider },
];

const apptColumns: ColumnDef<Appointment, any>[] = [
  { header: "Time", accessorKey: "scheduled_time" },
  { header: "Appointment type", cell: ({ row }) => row.original.appointment_type.name },
  { header: "Department", cell: ({ row }) => row.original.appointment_type.department },
];

export function PatientsPage() {
  const visits = usePatientVisits();
  const appts = useAppointments();
  const patients = usePatients();
  const stats = visitStats(visits.data ?? []);
  const today = appointmentsOn(appts.data ?? [], DEMO_TODAY)
    .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Patients</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile title="Active visits" value={stats.active} tone="default" />
        <KpiTile title="Inpatients" value={stats.activeInpatient} />
        <KpiTile title="Outpatients" value={stats.activeOutpatient} />
        <KpiTile title="Appointments today" value={today.length} hint={DEMO_TODAY} />
      </div>

      <Tabs defaultValue="visits">
        <TabsList>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="appointments">Today's schedule</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
        </TabsList>
        <TabsContent value="visits"><DataTable columns={visitColumns} data={visits.data ?? []} /></TabsContent>
        <TabsContent value="appointments"><DataTable columns={apptColumns} data={today} empty="No appointments today" /></TabsContent>
        <TabsContent value="directory"><DataTable columns={patientColumns} data={patients.data ?? []} /></TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && bun run typecheck && bun run dev
```

Open `/patients`: KPI tiles, three tabs (visits / today's schedule / directory) each populated from real data.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/patients.tsx
git commit -m "feat(frontend): patients page"
```

---

## Task 13: Employees page (real + MSW staffing overlay)

**Files:**
- Replace: `frontend/src/routes/employees.tsx`
- Create: `frontend/src/components/charts/bar-count.tsx`

**Interfaces:**
- Consumes: `useEmployees`, `useStaffing`; `headcountByDepartment`; shadcn `chart` (`ChartContainer`, `ChartTooltip`) + Recharts; `DataTable`, `KpiTile`.
- Produces: `EmployeesPage`; `<BarCount data={{ label; value }[]} />`.

- [ ] **Step 1: Bar chart wrapper**

```tsx
// frontend/src/components/charts/bar-count.tsx
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config = { value: { label: "Count", color: "hsl(221 83% 53%)" } } satisfies ChartConfig;

export function BarCount({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ChartContainer config={config} className="h-[320px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={180} tickLine={false} axisLine={false} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
```

- [ ] **Step 2: Employees page**

```tsx
// frontend/src/routes/employees.tsx
import type { ColumnDef } from "@tanstack/react-table";
import { BarCount } from "@/components/charts/bar-count";
import { DataTable } from "@/components/data-table";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployees, useStaffing } from "@/lib/api/queries";
import type { Employee } from "@/lib/api/types";
import { headcountByDepartment } from "@/lib/kpis";
import { fullName } from "@/lib/format";

const columns: ColumnDef<Employee, any>[] = [
  { header: "Name", cell: ({ row }) => fullName(row.original.first_name, row.original.last_name) },
  { header: "Position", accessorKey: "position" },
  { header: "Department", accessorKey: "department" },
];

export function EmployeesPage() {
  const employees = useEmployees();
  const staffing = useStaffing();
  const counts = headcountByDepartment(employees.data ?? []);
  const onShift = (staffing.data ?? []).reduce((n, s) => n + s.on_shift, 0);
  const onCall = (staffing.data ?? []).reduce((n, s) => n + s.on_call, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Employees</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiTile title="Total staff" value={employees.data?.length ?? 0} />
        <KpiTile title="On shift now" value={onShift} tone="good" hint="simulated" />
        <KpiTile title="On call" value={onCall} tone="warn" hint="simulated" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Headcount by department</CardTitle></CardHeader>
          <CardContent><BarCount data={counts.map((c) => ({ label: c.department, value: c.count }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Directory</CardTitle></CardHeader>
          <CardContent><DataTable columns={columns} data={employees.data ?? []} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend && bun run typecheck && bun run dev
```

Open `/employees`: total staff (24), simulated on-shift/on-call tiles, headcount bar chart, directory table.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/employees.tsx frontend/src/components/charts/bar-count.tsx
git commit -m "feat(frontend): employees page with staffing overlay"
```

---

## Task 14: Financial page (MSW)

**Files:**
- Replace: `frontend/src/routes/financial.tsx`
- Create: `frontend/src/components/charts/revenue-area.tsx`

**Interfaces:**
- Consumes: `useFinancialSummary`, `useRevenueTrend`, `useDepartmentFinancials`, `useInvoices`; `formatCurrency`; shadcn `chart` + Recharts; `DataTable`, `KpiTile`, `Badge`.
- Produces: `FinancialPage`; `<RevenueArea data={RevenuePoint[]} />`.

- [ ] **Step 1: Revenue area chart**

```tsx
// frontend/src/components/charts/revenue-area.tsx
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { RevenuePoint } from "@/lib/api/types";

const config = {
  revenue: { label: "Revenue", color: "hsl(221 83% 53%)" },
  cost: { label: "Cost", color: "hsl(0 72% 51%)" },
} satisfies ChartConfig;

export function RevenueArea({ data }: { data: RevenuePoint[] }) {
  return (
    <ChartContainer config={config} className="h-[320px] w-full">
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={40} fontSize={12}
               tickFormatter={(v: string) => v.slice(5)} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" fill="var(--color-revenue)" fillOpacity={0.15} />
        <Area dataKey="cost" type="monotone" stroke="var(--color-cost)" fill="var(--color-cost)" fillOpacity={0.1} />
      </AreaChart>
    </ChartContainer>
  );
}
```

- [ ] **Step 2: Financial page**

```tsx
// frontend/src/routes/financial.tsx
import type { ColumnDef } from "@tanstack/react-table";
import { RevenueArea } from "@/components/charts/revenue-area";
import { DataTable } from "@/components/data-table";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useDepartmentFinancials, useFinancialSummary, useInvoices, useRevenueTrend,
} from "@/lib/api/queries";
import type { Invoice } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";

const invoiceColumns: ColumnDef<Invoice, any>[] = [
  { header: "Invoice", accessorKey: "id" },
  { header: "Department", accessorKey: "department" },
  { header: "Payer", accessorKey: "payer" },
  { header: "Type", accessorKey: "insurance_type" },
  { header: "Amount", cell: ({ row }) => formatCurrency(row.original.amount) },
  { header: "Status", cell: ({ row }) => {
      const s = row.original.status;
      return <Badge variant={s === "PAID" ? "secondary" : s === "OPEN" ? "default" : "destructive"}>{s}</Badge>;
    } },
];

export function FinancialPage() {
  const summary = useFinancialSummary();
  const trend = useRevenueTrend(30);
  const byDept = useDepartmentFinancials();
  const invoices = useInvoices();
  const s = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Financial</h1>
        <Badge variant="outline">Simulated data</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile title="Revenue today" value={s ? formatCurrency(s.revenue_today) : "—"} tone="good" />
        <KpiTile title="Revenue MTD" value={s ? formatCurrency(s.revenue_mtd) : "—"} />
        <KpiTile title="Outstanding" value={s ? formatCurrency(s.outstanding) : "—"} tone="warn" />
        <KpiTile title="Margin" value={s ? `${s.margin_pct}%` : "—"} hint={s ? `Payer mix ${s.payer_mix.statutory}/${s.payer_mix.private}` : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue vs cost — last 30 days</CardTitle></CardHeader>
        <CardContent><RevenueArea data={trend.data ?? []} /></CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue by department</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(byDept.data ?? []).map((d) => (
              <div key={d.department} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{d.department}</span>
                <span className="tabular-nums">{formatCurrency(d.revenue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Outstanding invoices</CardTitle></CardHeader>
          <CardContent><DataTable columns={invoiceColumns} data={invoices.data ?? []} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend && bun run typecheck && bun run dev
```

Open `/financial`: KPI tiles from MSW, a revenue/cost area chart, revenue-by-department list, and an invoices table. A "Simulated data" badge is visible.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/financial.tsx frontend/src/components/charts/revenue-area.tsx
git commit -m "feat(frontend): financial page (MSW)"
```

---

## Task 15: 3D hospital scene

**Files:**
- Create: `frontend/src/components/three/{hospital-scene,bed-instances,department-slab,bed-inspector,scene-fallback}.tsx`

**Interfaces:**
- Consumes: `computeLayout`, `buildHospitalModel`, `HospitalModel`, `Layout`, `BedNode`, `BedStatus`; `@react-three/fiber`, `@react-three/drei`.
- Produces:
  - `<HospitalScene model layout onSelectBed selectedBedId />`
  - `<BedInstances placements onSelect selectedBedId />`
  - `<DepartmentSlab slab />`
  - `<BedInspector bed visit onClose />` (`visit: PatientVisit | null`)
  - `<SceneFallback layout />` (2D isometric grid; no WebGL)
- Status colors: FREE `#10b981`, RESERVED `#f59e0b`, OCCUPIED `#f43f5e`.

- [ ] **Step 1: Status color helper + bed instances**

```tsx
// frontend/src/components/three/bed-instances.tsx
import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { BedPlacement, BedStatus } from "@/lib/hospital-model";

export const STATUS_COLOR: Record<BedStatus, string> = {
  FREE: "#10b981", RESERVED: "#f59e0b", OCCUPIED: "#f43f5e",
};

export function BedInstances({
  placements, onSelect, selectedBedId,
}: { placements: BedPlacement[]; onSelect: (id: string) => void; selectedBedId?: string }) {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 0.5, 1.1), []);
  return (
    <Instances geometry={geo} limit={2048} castShadow>
      <meshStandardMaterial />
      {placements.map((p) => (
        <Instance
          key={p.bedId}
          position={p.position}
          color={STATUS_COLOR[p.status]}
          scale={p.bedId === selectedBedId ? 1.25 : 1}
          onClick={(e) => { e.stopPropagation(); onSelect(p.bedId); }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = "default"; }}
        />
      ))}
    </Instances>
  );
}
```

Note: `BedPlacement` and `BedStatus` are re-exported from `hospital-model.ts` (`BedStatus` originates in `api/types`; add `export type { BedStatus } from "./api/types";` to `hospital-model.ts` if not already re-exported).

- [ ] **Step 2: Department slab**

```tsx
// frontend/src/components/three/department-slab.tsx
import { Text } from "@react-three/drei";
import type { DepartmentSlab as Slab } from "@/lib/hospital-model";

export function DepartmentSlab({ slab }: { slab: Slab }) {
  const tone = slab.utilizationPct >= 95 ? "#fecdd3" : slab.utilizationPct >= 80 ? "#fde68a" : "#e2e8f0";
  return (
    <group position={[slab.centerX, slab.y, slab.centerZ]}>
      <mesh receiveShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[slab.width, 0.15, slab.depth]} />
        <meshStandardMaterial color={tone} />
      </mesh>
      <Text position={[-slab.width / 2, 0.4, -slab.depth / 2 - 0.3]} fontSize={0.5} color="#0f172a" anchorX="left">
        {slab.name}  ·  {slab.utilizationPct}%
      </Text>
    </group>
  );
}
```

- [ ] **Step 3: Scene**

```tsx
// frontend/src/components/three/hospital-scene.tsx
import { OrbitControls, Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { Layout } from "@/lib/hospital-model";
import { BedInstances } from "./bed-instances";
import { DepartmentSlab } from "./department-slab";

export function HospitalScene({
  layout, onSelectBed, selectedBedId,
}: { layout: Layout; onSelectBed: (id: string) => void; selectedBedId?: string }) {
  const camY = layout.bounds.height * 0.9 + 6;
  return (
    <Canvas shadows camera={{ position: [0, camY, layout.bounds.depth + 14], fov: 45 }} onPointerMissed={() => onSelectBed("")}>
      <color attach="background" args={["#f8fafc"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={1.1} castShadow />
      <Environment preset="city" />
      <group position={[0, -layout.bounds.height / 2, 0]}>
        {layout.slabs.map((s) => <DepartmentSlab key={s.name} slab={s} />)}
        <BedInstances placements={layout.beds} onSelect={onSelectBed} selectedBedId={selectedBedId} />
      </group>
      <OrbitControls enablePan makeDefault target={[0, 0, 0]} />
    </Canvas>
  );
}
```

- [ ] **Step 4: Bed inspector + fallback**

```tsx
// frontend/src/components/three/bed-inspector.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/kpi/status-dot";
import type { BedNode } from "@/lib/hospital-model";
import type { PatientVisit } from "@/lib/api/types";
import { fullName } from "@/lib/format";

export function BedInspector({
  bed, visit, onClose,
}: { bed: BedNode; visit: PatientVisit | null; onClose: () => void }) {
  return (
    <Card className="absolute right-4 top-4 w-72 shadow-lg">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><StatusDot status={bed.status} /> Bed</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <Row label="Status" value={bed.status} />
        <Row label="Type" value={bed.bedType} />
        <Row label="Material" value={bed.material} />
        <Row label="Room" value={bed.roomName ?? "—"} />
        <Row label="Station" value={bed.stationName} />
        <Row label="Department" value={bed.departmentName} />
        <div className="my-2 border-t" />
        {visit ? (
          <>
            <Row label="Patient" value={fullName(visit.patient.first_name, visit.patient.last_name)} />
            <Row label="Visit no." value={visit.patient_number} />
            <Row label="Since" value={`${visit.started_date} ${visit.started_time}`} />
          </>
        ) : (
          <div className="text-muted-foreground">No active visit on this bed</div>
        )}
      </CardContent>
    </Card>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
```

```tsx
// frontend/src/components/three/scene-fallback.tsx
import type { Layout } from "@/lib/hospital-model";
import { STATUS_COLOR } from "./bed-instances";

export function SceneFallback({ layout }: { layout: Layout }) {
  return (
    <div className="grid grid-cols-12 gap-1 p-6">
      {layout.beds.map((b) => (
        <span key={b.bedId} className="h-4 w-4 rounded-sm" style={{ background: STATUS_COLOR[b.status] }} title={b.departmentName} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
cd frontend && bun run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/three
git commit -m "feat(frontend): 3D hospital scene components"
```

---

## Task 16: Overview page (3D hero + KPI rail + alerts + inspector)

**Files:**
- Replace: `frontend/src/routes/overview.tsx`
- Create: `frontend/src/components/alerts-ticker.tsx`

**Interfaces:**
- Consumes: all real hooks + `useAlerts`, `useStaffing`; `buildHospitalModel`, `computeLayout`; `bedStats`, `hospitalCapacity`, `visitStats`, `appointmentsOn`; the `three/*` components + `SceneFallback`; `KpiTile`.
- Produces: `OverviewPage`; `<AlertsTicker alerts />`. Wraps `<HospitalScene>` in an error boundary that falls back to `<SceneFallback>`.

- [ ] **Step 1: Alerts ticker**

```tsx
// frontend/src/components/alerts-ticker.tsx
import { Badge } from "@/components/ui/badge";
import type { Alert } from "@/lib/api/types";

const TONE: Record<Alert["severity"], "destructive" | "default" | "secondary"> = {
  CRITICAL: "destructive", WARNING: "default", INFO: "secondary",
};

export function AlertsTicker({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="flex flex-col gap-2">
      {alerts.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
          <Badge variant={TONE[a.severity]}>{a.severity}</Badge>
          <span className="text-sm">{a.message}</span>
          <span className="ml-auto text-xs text-muted-foreground">{a.department}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: WebGL error boundary + overview page**

```tsx
// frontend/src/routes/overview.tsx
import { Component, type ReactNode, useMemo, useState } from "react";
import { AlertsTicker } from "@/components/alerts-ticker";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BedInspector } from "@/components/three/bed-inspector";
import { HospitalScene } from "@/components/three/hospital-scene";
import { SceneFallback } from "@/components/three/scene-fallback";
import {
  useAlerts, useAppointments, useBeds, useDepartments, usePatientVisits, useRooms, useStations,
} from "@/lib/api/queries";
import { buildHospitalModel, computeLayout } from "@/lib/hospital-model";
import { bedStats, hospitalCapacity, visitStats, appointmentsOn } from "@/lib/kpis";

const DEMO_TODAY = "2026-07-10";

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function OverviewPage() {
  const departments = useDepartments();
  const stations = useStations();
  const rooms = useRooms();
  const beds = useBeds();
  const visits = usePatientVisits();
  const appts = useAppointments();
  const alerts = useAlerts();
  const [selectedBedId, setSelectedBedId] = useState("");

  const model = useMemo(
    () => buildHospitalModel({
      departments: departments.data ?? [], stations: stations.data ?? [],
      rooms: rooms.data ?? [], beds: beds.data ?? [],
    }),
    [departments.data, stations.data, rooms.data, beds.data],
  );
  const layout = useMemo(() => computeLayout(model), [model]);

  const bStats = bedStats(beds.data ?? []);
  const cap = hospitalCapacity(departments.data ?? []);
  const vStats = visitStats(visits.data ?? []);
  const apptToday = appointmentsOn(appts.data ?? [], DEMO_TODAY).length;

  const selectedBed = selectedBedId ? model.bedById.get(selectedBedId) ?? null : null;
  const selectedVisit = selectedBedId
    ? (visits.data ?? []).find((v) => v.bed === selectedBedId && v.status === "ACTIVE") ?? null
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile title="Occupied" value={bStats.occupied} tone="bad" hint={`${bStats.occupancyPct}%`} />
        <KpiTile title="Free" value={bStats.free} tone="good" />
        <KpiTile title="Reserved" value={bStats.reserved} tone="warn" />
        <KpiTile title="Capacity" value={`${cap.pct}%`} hint={`${cap.current}/${cap.max}`} />
        <KpiTile title="Active visits" value={vStats.active} hint={`${vStats.activeInpatient} in · ${vStats.activeOutpatient} out`} />
        <KpiTile title="Appts today" value={apptToday} hint={DEMO_TODAY} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="relative xl:col-span-2">
          <CardHeader><CardTitle>Hospital — live bed status</CardTitle></CardHeader>
          <CardContent className="relative h-[560px] p-0">
            <WebGLBoundary fallback={<SceneFallback layout={layout} />}>
              <HospitalScene layout={layout} onSelectBed={setSelectedBedId} selectedBedId={selectedBedId} />
            </WebGLBoundary>
            {selectedBed && (
              <BedInspector bed={selectedBed} visit={selectedVisit} onClose={() => setSelectedBedId("")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Operational alerts</CardTitle></CardHeader>
          <CardContent><AlertsTicker alerts={alerts.data ?? []} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the centerpiece**

```bash
cd frontend && bun run typecheck && bun run dev
```

Open `/`:
- The KPI rail shows six live tiles.
- The 3D hospital renders: floors per department, color-coded beds, orbit/zoom works.
- Clicking a bed opens the inspector with its details and (if any) the active patient visit.
- The alerts panel lists MSW alerts.
- Click "Reseed demo data" → after ~a second the bed colors/KPIs update (5s poll or immediate invalidate).

- [ ] **Step 4: Full test + typecheck sweep**

```bash
cd frontend && bun run typecheck && bunx vitest run
```

Expected: all unit tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/overview.tsx frontend/src/components/alerts-ticker.tsx
git commit -m "feat(frontend): 3D overview command-center page"
```

---

## Task 17: README + run script

**Files:**
- Create: `frontend/README.md`

**Interfaces:** none.

- [ ] **Step 1: Write run docs**

```md
# Uniklikum X — Command Center (frontend)

Live hospital dashboard: 3D overview + Logistics / Patients / Employees / Financial.
Reads the real API through a Vite proxy; mocks not-yet-built endpoints (financial,
alerts, staffing) with MSW.

## Run

1. Backend (repo root): `bun run db:reset && bun run dev`  (serves :3000)
2. Frontend (this dir): `bun install && bun run dev`  (serves :5173)

Open http://localhost:5173.

## Test / typecheck

```bash
bun run test        # vitest (pure modules)
bun run typecheck   # types
```

## Notes

- Polling: every page auto-refreshes every 5s (TanStack Query).
- "Reseed demo data" (top bar) calls `POST /v1/database-seeds` to reset the hospital live.
- Mocked endpoints live in `src/mocks/`; delete them once the backend implements
  `/v1/financial/*` and `/v1/ops/*` to the same contract.
```

- [ ] **Step 2: Commit**

```bash
git add frontend/README.md
git commit -m "docs(frontend): run + test instructions"
```

---

## Self-Review

**Spec coverage:**
- Light enterprise theme → shadcn preset + no dark surfaces (Global Constraints, Task 1/9). ✓
- 5s polling → `query-client.ts` (Task 4). ✓
- TanStack Query/Router/Table → Tasks 4, 9, 10. ✓
- shadcn preset `b67feOKh72` + Vite → Task 1. ✓
- No backend changes; Vite proxy + MSW → Tasks 1, 8; reseed uses existing endpoint (Task 9). ✓
- 3D overview (floors=departments, color-coded beds, orbit, click→inspector, live, 2D fallback) → Tasks 6, 15, 16. ✓
- Logistics / Patients / Employees / Financial pages → Tasks 11–14. ✓
- MSW contract `/v1/financial/*`, `/v1/ops/*` (same conventions) → Tasks 7, 8. ✓
- Pure, tested modules (`hospital-model`, `kpis`, `generators`) → Tasks 5, 6, 7. ✓
- Reseed button, live clock, polling indicator → Task 9. ✓
- Out of scope respected (no auth, no write UIs beyond reseed, no i18n, no mobile). ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/vague steps; every code step shows full code. ✓

**Type consistency:** `BedStatus`/`BedPlacement`/`Layout`/`HospitalModel`/`BedNode` names match across Tasks 6, 15, 16. `computeLayout(buildHospitalModel(...))` signature consistent. Query hook names match usage in pages. Note added in Task 15 to re-export `BedStatus`/`BedPlacement` from `hospital-model.ts` so three components import them from one place. ✓

**Known execution caveats to watch (not blockers):**
- shadcn init flags/prompts may vary by version — Task 1 says to place the app in `frontend/` regardless of exact prompt wording (use the `shadcn` skill during execution if the CLI differs).
- shadcn `chart` requires `recharts`; installed in Task 1.
- If the scaffold ships React 19, the `@react-three/*` peer versions may need `@react-three/fiber@^8`/`^9` matching React — install the matching major during Task 1 if `bun add` warns.
```
