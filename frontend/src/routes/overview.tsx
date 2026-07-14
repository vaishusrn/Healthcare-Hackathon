import { useEffect, useState } from "react";
import { AlertsTicker } from "@/components/alerts-ticker";
import { HospitalFloorPlan } from "@/components/floor-plan/hospital-floor-plan";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FullscreenModal } from "@/components/ui/fullscreen-modal";
import { useAlerts, useFloorDetail, useFloors, useOpsSummary } from "@/lib/api/queries";

const DEMO_TODAY = "2026-07-10";

export function OverviewPage() {
  const summaryQuery = useOpsSummary(DEMO_TODAY);
  const floorsQuery = useFloors();
  const alerts = useAlerts();

  const [building, setBuilding] = useState("");
  const [level, setLevel] = useState(0);
  const [selectedBedId, setSelectedBedId] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  // Default to the first floor entry once the floor list has loaded.
  useEffect(() => {
    const floors = floorsQuery.data;
    if (!floors || floors.length === 0 || building) return;
    setBuilding(floors[0].building);
    setLevel(floors[0].level);
  }, [floorsQuery.data, building]);

  const floorDetailQuery = useFloorDetail(building, level);
  const summary = summaryQuery.data;

  const handleSelectFloor = (nextBuilding: string, nextLevel: number) => {
    setBuilding(nextBuilding);
    setLevel(nextLevel);
    setSelectedBedId("");
  };

  // Shared by the card and the fullscreen modal so both views stay in sync.
  const floorPlanProps = {
    floors: floorsQuery.data ?? [],
    building,
    level,
    floorDetail: floorDetailQuery.data,
    selectedBedId,
    onSelectFloor: handleSelectFloor,
    onSelectBed: setSelectedBedId,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <KpiTile
          title="Occupied"
          value={summary?.beds.occupied ?? "—"}
          tone="bad"
          hint={summary ? `${Math.round(summary.beds.occupancy_pct)}% occupancy` : undefined}
        />
        <KpiTile title="Free" value={summary?.beds.free ?? "—"} tone="good" />
        <KpiTile title="Reserved" value={summary?.beds.reserved ?? "—"} tone="warn" />
        <KpiTile
          title="Capacity"
          value={summary ? `${Math.round(summary.capacity.pct)}%` : "—"}
          hint={summary ? `${summary.capacity.current}/${summary.capacity.max}` : undefined}
        />
        <KpiTile
          title="Active visits"
          value={summary?.visits.active ?? "—"}
          hint={summary ? `${summary.visits.active_inpatient} in · ${summary.visits.active_outpatient} out` : undefined}
        />
        <KpiTile title="Appts today" value={summary?.appointments_on_date ?? "—"} hint={DEMO_TODAY} />
        <KpiTile title="Patients" value={summary?.patients.total ?? "—"} />
        <KpiTile title="Staff" value={summary?.employees.total ?? "—"} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Uniklikum X floor plan</CardTitle>
            <CardDescription>Live ward layout, rooms, and bed occupancy by building and floor</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <HospitalFloorPlan {...floorPlanProps} onFullscreen={() => setFullscreen(true)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Operational alerts</CardTitle></CardHeader>
          <CardContent><AlertsTicker alerts={alerts.data ?? []} /></CardContent>
        </Card>
      </div>

      <FullscreenModal
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title="Uniklikum X floor plan"
      >
        <HospitalFloorPlan {...floorPlanProps} />
      </FullscreenModal>
    </div>
  );
}
