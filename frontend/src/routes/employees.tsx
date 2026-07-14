import type { ColumnDef } from "@tanstack/react-table";
import { BarCount } from "@/components/charts/bar-count";
import { DataTable } from "@/components/data-table";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployeesPage, useOpsSummary, useStaffing } from "@/lib/api/queries";
import type { Employee } from "@/lib/api/types";
import { fullName } from "@/lib/format";

const DEMO_TODAY = "2026-07-10"; // seed appointments are dated from this day

const columns: ColumnDef<Employee, any>[] = [
  { header: "Name", cell: ({ row }) => fullName(row.original.first_name, row.original.last_name) },
  { header: "Position", accessorKey: "position" },
  { header: "Department", accessorKey: "department" },
];

export function EmployeesPage() {
  const summaryQuery = useOpsSummary(DEMO_TODAY);
  const staffing = useStaffing();
  const employeesPage = useEmployeesPage();

  const summary = summaryQuery.data;
  const onShift = (staffing.data ?? []).reduce((n, s) => n + s.on_shift, 0);
  const onCall = (staffing.data ?? []).reduce((n, s) => n + s.on_call, 0);
  const counts = [...(staffing.data ?? [])]
    .sort((a, b) => b.total - a.total)
    .map((s) => ({ label: s.department, value: s.total }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Employees</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiTile title="Total staff" value={summary?.employees.total ?? "—"} />
        <KpiTile title="On shift now" value={onShift} tone="good" />
        <KpiTile title="On call" value={onCall} tone="warn" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Headcount by department</CardTitle></CardHeader>
          <CardContent><BarCount data={counts} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Directory</CardTitle>
            <CardDescription>Showing first 50 of {summary?.employees.total ?? "—"} employees</CardDescription>
          </CardHeader>
          <CardContent><DataTable columns={columns} data={employeesPage.data?.data ?? []} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
