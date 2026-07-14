import { describe, expect, it } from "vitest";
import {
  SEED_DEPARTMENTS, alerts, departmentFinancials, financialSummary,
  invoices, mulberry32, revenueTrend, staffing,
} from "./generators";

describe("mulberry32", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(42); const b = mulberry32(42);
    expect(a()).toBe(b());
  });
});

describe("financialSummary", () => {
  it("is deterministic and internally consistent", () => {
    const s = financialSummary(1);
    expect(financialSummary(1)).toEqual(s);
    expect(s.payer_mix.statutory + s.payer_mix.private).toBe(100);
    expect(s.revenue_today).toBeGreaterThan(0);
  });
});

describe("revenueTrend", () => {
  it("returns `days` ascending points ending at endDate", () => {
    const t = revenueTrend(30, 1, "2026-07-10");
    expect(t).toHaveLength(30);
    expect(t[t.length - 1].date).toBe("2026-07-10");
    expect(t[0].date < t[t.length - 1].date).toBe(true);
  });
});

describe("departmentFinancials / staffing", () => {
  it("cover every seed department", () => {
    expect(departmentFinancials(1).map((d) => d.department)).toEqual(SEED_DEPARTMENTS);
    expect(staffing(1)).toHaveLength(SEED_DEPARTMENTS.length);
  });
});

describe("invoices / alerts", () => {
  it("produce the requested shapes deterministically", () => {
    expect(invoices(20, 1)).toHaveLength(20);
    expect(invoices(20, 1)).toEqual(invoices(20, 1));
    const a = alerts(1);
    expect(a.length).toBeGreaterThan(0);
    expect(["INFO", "WARNING", "CRITICAL"]).toContain(a[0].severity);
  });
});
