import { Link, useParams } from "@tanstack/react-router";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { StatusDot } from "@/components/kpi/status-dot";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoomOccupancy } from "@/lib/api/queries";
import { fullName } from "@/lib/format";

export function RoomPage() {
  const { roomId } = useParams({ strict: false }) as { roomId?: string };
  const query = useRoomOccupancy(roomId ?? "");

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Room</h1>
        <p className="text-muted-foreground">Room not found.</p>
        <Link to="/logistics" className="text-sm text-primary underline">Back to Logistics</Link>
      </div>
    );
  }

  const { room, beds } = query.data;
  const occupied = beds.filter((b) => b.status === "OCCUPIED").length;
  const reserved = beds.filter((b) => b.status === "RESERVED").length;
  const free = beds.filter((b) => b.status === "FREE").length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link to="/logistics" className="text-xs text-muted-foreground hover:underline">← Logistics</Link>
        <h1 className="text-2xl font-semibold">{room.name}</h1>
        <p className="text-sm text-muted-foreground">
          {room.room_type} · {room.department} · {room.station}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile title="Beds" value={room.bed_capacity} />
        <KpiTile title="Occupied" value={occupied} tone="bad" />
        <KpiTile title="Reserved" value={reserved} tone="warn" />
        <KpiTile title="Free" value={free} tone="good" />
      </div>

      <Card>
        <CardHeader><CardTitle>Beds &amp; occupants</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {beds.length === 0 ? (
            <p className="text-sm text-muted-foreground">This room has no beds (e.g. a secretariat).</p>
          ) : (
            beds.map((bed) => (
              <div key={bed.id} className="flex items-center justify-between rounded-md border px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusDot status={bed.status} />
                  <div>
                    <div className="text-sm font-medium">{bed.id}</div>
                    <div className="text-xs text-muted-foreground">{bed.bed_type} · {bed.material}</div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  {bed.occupant ? (
                    <Link
                      to="/patients/$patientId"
                      params={{ patientId: bed.occupant.patient_id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {fullName(bed.occupant.first_name, bed.occupant.last_name)}
                      <span className="ml-2 text-xs text-muted-foreground">#{bed.occupant.patient_number}</span>
                    </Link>
                  ) : (
                    <Badge variant="outline">{bed.status === "FREE" ? "Empty" : bed.status}</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
