import type {
  Alert, AlertSeverity, DepartmentFinancial, FinancialSummary,
  Invoice, InvoiceStatus, RevenuePoint, StaffingEntry,
} from "../lib/api/types";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED_DEPARTMENTS = [
  "Kardiologie", "Zentrale Notaufnahme", "Kinder- und Jugendmedizin", "Radiologie",
  "Orthopädie und Unfallchirurgie", "Neurologie", "Onkologie", "Gastroenterologie",
  "Nephrologie", "Pneumologie", "Geriatrie", "Anästhesiologie und Intensivmedizin",
];

const PAYERS = [
  "Techniker Krankenkasse", "AOK Bayern", "Barmer", "DAK-Gesundheit",
  "Debeka Krankenversicherung", "Allianz Private Krankenversicherung",
];

const round = (n: number) => Math.round(n);

function isoMinus(endDate: string, daysBack: number): string {
  // endDate is "YYYY-MM-DD"; subtract days using UTC math (deterministic).
  const [y, m, d] = endDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - daysBack));
  return dt.toISOString().slice(0, 10);
}

export function financialSummary(seed = 1): FinancialSummary {
  const rnd = mulberry32(seed);
  const revenue_today = round(180_000 + rnd() * 120_000);
  const cost_today = round(revenue_today * (0.6 + rnd() * 0.15));
  const statutory = round(62 + rnd() * 16); // correlates to real ~70/30 split
  return {
    revenue_today,
    revenue_mtd: round(revenue_today * (9 + rnd() * 4)),
    outstanding: round(200_000 + rnd() * 300_000),
    cost_today,
    margin_pct: Math.round(((revenue_today - cost_today) / revenue_today) * 1000) / 10,
    payer_mix: { statutory, private: 100 - statutory },
  };
}

export function revenueTrend(days: number, seed = 1, endDate = "2026-07-10"): RevenuePoint[] {
  const rnd = mulberry32(seed);
  const out: RevenuePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const revenue = round(150_000 + rnd() * 150_000);
    out.push({ date: isoMinus(endDate, i), revenue, cost: round(revenue * (0.55 + rnd() * 0.2)) });
  }
  return out;
}

export function departmentFinancials(seed = 1): DepartmentFinancial[] {
  const rnd = mulberry32(seed);
  return SEED_DEPARTMENTS.map((department) => {
    const revenue = round(40_000 + rnd() * 260_000);
    return { department, revenue, cost: round(revenue * (0.55 + rnd() * 0.25)) };
  });
}

const INVOICE_STATUSES: InvoiceStatus[] = ["PAID", "PAID", "OPEN", "OVERDUE"];

export function invoices(count: number, seed = 1): Invoice[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const isPrivate = rnd() > 0.7;
    return {
      id: `inv_${String(i + 1).padStart(5, "0")}`,
      department: SEED_DEPARTMENTS[i % SEED_DEPARTMENTS.length],
      payer: PAYERS[Math.floor(rnd() * PAYERS.length)],
      insurance_type: isPrivate ? "PRIVATE" : "STATUTORY",
      amount: round(400 + rnd() * 9_600),
      status: INVOICE_STATUSES[Math.floor(rnd() * INVOICE_STATUSES.length)],
      issued_date: isoMinus("2026-07-10", Math.floor(rnd() * 45)),
    };
  });
}

const ALERT_TEMPLATES: { severity: AlertSeverity; category: string; message: string }[] = [
  { severity: "CRITICAL", category: "CAPACITY", message: "ICU occupancy above 95%" },
  { severity: "WARNING", category: "CAPACITY", message: "Department nearing max capacity" },
  { severity: "WARNING", category: "STAFFING", message: "Night shift understaffed" },
  { severity: "INFO", category: "LOGISTICS", message: "Bed cleaning completed" },
  { severity: "CRITICAL", category: "EMERGENCY", message: "Incoming trauma — Schockraum on standby" },
  { severity: "INFO", category: "APPOINTMENTS", message: "Peak outpatient volume in the next hour" },
];

export function alerts(seed = 1): Alert[] {
  const rnd = mulberry32(seed);
  return ALERT_TEMPLATES.map((t, i) => ({
    id: `alt_${i + 1}`,
    severity: t.severity, category: t.category, message: t.message,
    department: SEED_DEPARTMENTS[Math.floor(rnd() * SEED_DEPARTMENTS.length)],
    created_at: `2026-07-10T09:${String(i).padStart(2, "0")}:00.000+02:00`,
  }));
}

export function staffing(seed = 1): StaffingEntry[] {
  const rnd = mulberry32(seed);
  return SEED_DEPARTMENTS.map((department) => {
    const total = 8 + Math.floor(rnd() * 22);
    const on_shift = Math.floor(total * (0.4 + rnd() * 0.4));
    return { department, on_shift, on_call: Math.floor(rnd() * 4), total };
  });
}
