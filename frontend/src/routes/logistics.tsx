import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { CapacityBar } from "@/components/kpi/capacity-bar";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { StatusDot } from "@/components/kpi/status-dot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartments, useOpsSummary, useRoomsPage } from "@/lib/api/queries";
import type { Room } from "@/lib/api/types";
import { departmentUtilization } from "@/lib/kpis";

const DEMO_TODAY = "2026-07-10"; // seed appointments are dated from this day

const roomColumns: ColumnDef<Room, any>[] = [
  { header: "Room", cell: ({ row }) => (
      <Link to="/rooms/$roomId" params={{ roomId: row.original.id }} className="text-primary hover:underline">
        {row.original.name}
      </Link>
    ) },
  { header: "Type", accessorKey: "room_type" },
  { header: "Department", accessorKey: "department" },
  { header: "Station", accessorKey: "station" },
  { header: "Occupied / Beds", cell: ({ row }) => `${row.original.current_capacity} / ${row.original.bed_capacity}` },
];

export function LogisticsPage() {
  const summaryQuery = useOpsSummary(DEMO_TODAY);
  const departments = useDepartments();
  const roomsPage = useRoomsPage();

  const summary = summaryQuery.data;
  const util = departmentUtilization(departments.data ?? []);

  if (departments.isLoading) {
    return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const beds = summary?.beds;
  const occPct = beds ? Math.min(100, Math.round((beds.occupied / Math.max(1, beds.total)) * 100)) : 0;
  const resPct = beds ? Math.min(100, Math.round((beds.reserved / Math.max(1, beds.total)) * 100)) : 0;
  const freePct = beds ? Math.max(0, 100 - occPct - resPct) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Logistics</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          title="Occupied beds"
          value={summary?.beds.occupied ?? "—"}
          hint={summary ? `${Math.round(summary.beds.occupancy_pct)}% occupancy` : undefined}
          tone="bad"
        />
        <KpiTile title="Free beds" value={summary?.beds.free ?? "—"} tone="good" />
        <KpiTile title="Reserved beds" value={summary?.beds.reserved ?? "—"} tone="warn" />
        <KpiTile
          title="Capacity"
          value={summary ? `${Math.round(summary.capacity.pct)}%` : "—"}
          hint={summary ? `${summary.capacity.current}/${summary.capacity.max}` : undefined}
        />
        <KpiTile title="Wards" value={summary?.wards.total ?? "—"} />
        <KpiTile title="Departments" value={summary?.departments.total ?? "—"} />
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
            {beds ? (
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-rose-500" style={{ width: `${occPct}%` }} />
                <div className="bg-amber-500" style={{ width: `${resPct}%` }} />
                <div className="bg-emerald-500" style={{ width: `${freePct}%` }} />
              </div>
            ) : (
              <Skeleton className="h-4 w-full" />
            )}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><StatusDot status="OCCUPIED" /> Occupied ({beds?.occupied ?? "—"})</span>
              <span className="flex items-center gap-1"><StatusDot status="RESERVED" /> Reserved ({beds?.reserved ?? "—"})</span>
              <span className="flex items-center gap-1"><StatusDot status="FREE" /> Free ({beds?.free ?? "—"})</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rooms</CardTitle>
          <CardDescription>Showing first 50 rooms{summary ? ` · ${summary.wards.total} wards total` : ""}</CardDescription>
        </CardHeader>
        <CardContent><DataTable columns={roomColumns} data={roomsPage.data?.data ?? []} /></CardContent>
      </Card>
    </div>
  );
}
