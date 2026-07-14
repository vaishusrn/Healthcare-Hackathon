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
