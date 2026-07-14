import type { ColumnDef } from "@tanstack/react-table";
import { RevenueArea } from "@/components/charts/revenue-area";
import { DataTable } from "@/components/data-table";
import { KpiTile } from "@/components/kpi/kpi-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useDepartmentFinancials, useFinancialSummary, useInvoices, useRevenueTrend,
} from "@/lib/api/queries";
import type { Invoice } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";

const invoiceColumns: ColumnDef<Invoice, any>[] = [
  { header: "Invoice", accessorKey: "id" },
  { header: "Department", accessorKey: "department" },
  { header: "Payer", accessorKey: "payer" },
  { header: "Type", accessorKey: "insurance_type" },
  { header: "Amount", cell: ({ row }) => formatCurrency(row.original.amount) },
  { header: "Status", cell: ({ row }) => {
      const s = row.original.status;
      return <Badge variant={s === "PAID" ? "secondary" : s === "OPEN" ? "default" : "destructive"}>{s}</Badge>;
    } },
];

export function FinancialPage() {
  const summary = useFinancialSummary();
  const trend = useRevenueTrend(30);
  const byDept = useDepartmentFinancials();
  const invoices = useInvoices();
  const s = summary.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Financial</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile title="Revenue today" value={s ? formatCurrency(s.revenue_today) : "—"} tone="good" />
        <KpiTile title="Revenue MTD" value={s ? formatCurrency(s.revenue_mtd) : "—"} />
        <KpiTile title="Outstanding" value={s ? formatCurrency(s.outstanding) : "—"} tone="warn" />
        <KpiTile title="Margin" value={s ? `${s.margin_pct}%` : "—"} hint={s ? `Payer mix ${s.payer_mix.statutory}/${s.payer_mix.private}` : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue vs cost — last 30 days</CardTitle></CardHeader>
        <CardContent><RevenueArea data={trend.data ?? []} /></CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue by department</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(byDept.data ?? []).map((d) => (
              <div key={d.department} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{d.department}</span>
                <span className="tabular-nums">{formatCurrency(d.revenue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Outstanding invoices</CardTitle></CardHeader>
          <CardContent><DataTable columns={invoiceColumns} data={invoices.data ?? []} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
