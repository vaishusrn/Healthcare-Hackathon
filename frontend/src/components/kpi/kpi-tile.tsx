import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiTile({
  title, value, hint, tone = "default",
}: { title: string; value: string | number; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneClass = {
    default: "text-foreground", good: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className={cn("mt-1 text-3xl font-semibold tabular-nums", toneClass)}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
