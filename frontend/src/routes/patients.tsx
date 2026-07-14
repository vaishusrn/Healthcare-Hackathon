import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppointmentsOnDate, useOpsSummary, usePatientSearch, usePatientsPage, usePatientVisitsPage } from "@/lib/api/queries";
import type { Appointment, Patient, PatientVisit } from "@/lib/api/types";
import { fullName } from "@/lib/format";

const DEMO_TODAY = "2026-07-10"; // seed appointments are dated from this day

const visitColumns: ColumnDef<PatientVisit, any>[] = [
  { header: "No.", accessorKey: "patient_number" },
  { header: "Patient", cell: ({ row }) => (
      <Link to="/patients/$patientId" params={{ patientId: row.original.patient.id }} className="text-primary hover:underline">
        {fullName(row.original.patient.first_name, row.original.patient.last_name)}
      </Link>
    ) },
  { header: "Type", cell: ({ row }) => <Badge variant="outline">{row.original.visit_type}</Badge> },
  { header: "Status", cell: ({ row }) => (
      <Badge variant={row.original.status === "ACTIVE" ? "default" : "secondary"}>{row.original.status}</Badge>
    ) },
  { header: "Department", accessorKey: "department" },
  { header: "Since", cell: ({ row }) => `${row.original.started_date} ${row.original.started_time}` },
];

const patientColumns: ColumnDef<Patient, any>[] = [
  { header: "Patient", cell: ({ row }) => (
      <Link to="/patients/$patientId" params={{ patientId: row.original.id }} className="text-primary hover:underline">
        {fullName(row.original.first_name, row.original.last_name)}
      </Link>
    ) },
  { header: "Born", accessorKey: "birth_date" },
  { header: "Insurance", cell: ({ row }) => row.original.social_security_number.insurance_type },
  { header: "Provider", cell: ({ row }) => row.original.social_security_number.health_insurance_provider },
];

const apptColumns: ColumnDef<Appointment, any>[] = [
  { header: "Time", accessorKey: "scheduled_time" },
  { header: "Appointment type", cell: ({ row }) => row.original.appointment_type.name },
  { header: "Department", cell: ({ row }) => row.original.appointment_type.department },
];

function PatientSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 200);
    return () => clearTimeout(timer);
  }, [term]);

  const search = usePatientSearch(debounced);
  const results = search.data ?? [];
  const active = debounced.trim().length >= 2;

  const go = (patientId: string) => {
    setOpen(false);
    setTerm("");
    navigate({ to: "/patients/$patientId", params: { patientId } });
  };

  return (
    <div className="relative w-72">
      <input
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) go(results[0].id);
          if (event.key === "Escape") setOpen(false);
        }}
        aria-label="Search patients by name or patient number"
        placeholder="Search name or patient number"
        className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
      />
      {open && active ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          {search.isFetching && results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
          ) : (
            <ul className="max-h-64 overflow-auto py-1">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(result.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="font-medium">{fullName(result.first_name, result.last_name)}</span>
                    <span className="text-muted-foreground">{result.birth_date}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PatientsPage() {
  const summaryQuery = useOpsSummary(DEMO_TODAY);
  const visitsPage = usePatientVisitsPage();
  const patientsPage = usePatientsPage();
  const appointmentsToday = useAppointmentsOnDate(DEMO_TODAY);

  const summary = summaryQuery.data;
  const todaysAppointments = [...(appointmentsToday.data?.data ?? [])].sort((a, b) =>
    a.scheduled_time.localeCompare(b.scheduled_time),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <PatientSearch />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile title="Active visits" value={summary?.visits.active ?? "—"} tone="default" />
        <KpiTile title="Inpatients" value={summary?.visits.active_inpatient ?? "—"} />
        <KpiTile title="Outpatients" value={summary?.visits.active_outpatient ?? "—"} />
        <KpiTile title="Appointments today" value={summary?.appointments_on_date ?? "—"} hint={DEMO_TODAY} />
      </div>

      <Tabs defaultValue="visits">
        <TabsList>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="appointments">Today's schedule</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
        </TabsList>
        <TabsContent value="visits">
          <p className="mb-2 text-xs text-muted-foreground">Showing first 50 visits</p>
          <DataTable columns={visitColumns} data={visitsPage.data?.data ?? []} />
        </TabsContent>
        <TabsContent value="appointments">
          <p className="mb-2 text-xs text-muted-foreground">
            Showing first 100 of {summary?.appointments_on_date ?? "—"} appointments on {DEMO_TODAY}
          </p>
          <DataTable columns={apptColumns} data={todaysAppointments} empty="No appointments today." />
        </TabsContent>
        <TabsContent value="directory">
          <p className="mb-2 text-xs text-muted-foreground">
            Showing first 50 of {summary?.patients.total ?? "—"} patients
          </p>
          <DataTable columns={patientColumns} data={patientsPage.data?.data ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
