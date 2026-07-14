import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/kpi/status-dot";
import type { BedStatus } from "@/lib/api/types";
import type { FloorPlanGeometry } from "@/lib/floor-layout";
import { fullName } from "@/lib/format";

type PlanBed = FloorPlanGeometry["beds"][number];

const STATUS_LABEL: Record<BedStatus, string> = {
  FREE: "Free",
  RESERVED: "Reserved",
  OCCUPIED: "Occupied",
};

export function BedInspector({ bed, onClose }: { bed: PlanBed; onClose: () => void }) {
  return (
    <div className="absolute right-4 top-4 w-72 border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-base font-medium"><StatusDot status={bed.status} /> Bed</div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close bed details"><X /></Button>
      </div>
      <div className="space-y-1 px-4 pb-4 text-sm">
        <Row label="Status" value={STATUS_LABEL[bed.status]} />
        <Row label="Room" value={bed.room} />
        <Row label="Ward" value={bed.ward} />
        <Row label="Department" value={bed.department} />
        <div className="my-2 border-t" />
        {bed.patient ? (
          <>
            <Row label="Patient" value={fullName(bed.patient.first_name, bed.patient.last_name)} />
            <Row label="Patient no." value={bed.patient.patient_number} />
          </>
        ) : (
          <div className="text-muted-foreground">No patient assigned</div>
        )}
      </div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
