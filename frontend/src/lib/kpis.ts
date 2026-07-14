import type { Department } from "./api/types";

export function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function departmentUtilization(departments: Department[]) {
  return departments.map((d) => ({
    department: d.name,
    current: d.current_capacity,
    max: d.max_capacity,
    pct: pct(d.current_capacity, d.max_capacity),
  }));
}
