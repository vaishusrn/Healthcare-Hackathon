import { Link, useParams } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientOverview } from "@/lib/api/queries";
import type { Appointment } from "@/lib/api/types";
import { fullName } from "@/lib/format";

const apptColumns: ColumnDef<Appointment, any>[] = [
  { header: "Date", accessorKey: "scheduled_date" },
  { header: "Time", accessorKey: "scheduled_time" },
  { header: "Appointment type", cell: ({ row }) => row.original.appointment_type.name },
  { header: "Department", cell: ({ row }) => row.original.appointment_type.department },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

export function PatientPage() {
  const { patientId } = useParams({ strict: false }) as { patientId?: string };
  const query = usePatientOverview(patientId ?? "");

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Patient</h1>
        <p className="text-muted-foreground">Patient not found.</p>
        <Link to="/patients" className="text-sm text-primary underline">Back to Patients</Link>
      </div>
    );
  }

  const { patient, current_visit, appointments } = query.data;
  const ssn = patient.social_security_number;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link to="/patients" className="text-xs text-muted-foreground hover:underline">← Patients</Link>
        <h1 className="text-2xl font-semibold">{fullName(patient.first_name, patient.last_name)}</h1>
        <p className="text-sm text-muted-foreground">
          Born {patient.birth_date} · {patient.birthplace} · {patient.gender}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Current placement</CardTitle></CardHeader>
          <CardContent>
            {current_visit ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Visit type"><Badge variant="outline">{current_visit.visit_type}</Badge></Field>
                <Field label="Status"><Badge>{current_visit.status}</Badge></Field>
                <Field label="Department">{current_visit.department}</Field>
                <Field label="Station">{current_visit.station ?? "—"}</Field>
                <Field label="Room">
                  {current_visit.room && current_visit.room_id ? (
                    <Link
                      to="/rooms/$roomId"
                      params={{ roomId: current_visit.room_id }}
                      className="text-primary hover:underline"
                    >
                      {current_visit.room}
                    </Link>
                  ) : (
                    current_visit.room ?? "—"
                  )}
                </Field>
                <Field label="Bed">{current_visit.bed ?? "—"}</Field>
                <Field label="Since">{current_visit.started_date} {current_visit.started_time}</Field>
                <Field label="Patient no.">{current_visit.patient_number}</Field>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active visit — patient is not currently admitted.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Insurance &amp; contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Insurance type">{ssn.insurance_type}</Field>
            <Field label="Provider">{ssn.health_insurance_provider}</Field>
            <Field label="Social security no.">{ssn.number}</Field>
            <Field label="Telephone">{patient.telephone_number}</Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Appointments</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={apptColumns} data={appointments} empty="No appointments." />
        </CardContent>
      </Card>
    </div>
  );
}
