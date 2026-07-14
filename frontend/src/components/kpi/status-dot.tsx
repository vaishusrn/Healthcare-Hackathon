import type { BedStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TONE: Record<BedStatus, string> = {
  FREE: "bg-emerald-500", RESERVED: "bg-amber-500", OCCUPIED: "bg-rose-500",
};
export function StatusDot({ status, className }: { status: BedStatus; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", TONE[status], className)} />;
}
