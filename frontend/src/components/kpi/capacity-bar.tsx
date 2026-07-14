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
