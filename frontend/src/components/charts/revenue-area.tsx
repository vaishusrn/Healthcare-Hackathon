import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import type { RevenuePoint } from "@/lib/api/types";

const config = {
  revenue: { label: "Revenue", color: "hsl(221 83% 53%)" },
  cost: { label: "Cost", color: "hsl(0 72% 51%)" },
} satisfies ChartConfig;

export function RevenueArea({ data }: { data: RevenuePoint[] }) {
  return (
    <ChartContainer config={config} className="h-[320px] w-full">
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={40}
          fontSize={12}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" fill="var(--color-revenue)" fillOpacity={0.15} />
        <Area dataKey="cost" type="monotone" stroke="var(--color-cost)" fill="var(--color-cost)" fillOpacity={0.1} />
      </AreaChart>
    </ChartContainer>
  );
}
