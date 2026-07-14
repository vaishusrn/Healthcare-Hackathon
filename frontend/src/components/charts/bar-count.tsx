import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";

const config = { value: { label: "Count", color: "hsl(221 83% 53%)" } } satisfies ChartConfig;

export function BarCount({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ChartContainer config={config} className="h-[320px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={180} tickLine={false} axisLine={false} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
