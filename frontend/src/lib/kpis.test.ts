import { describe, expect, it } from "vitest";
import type { Department } from "./api/types";
import { departmentUtilization, pct } from "./kpis";

describe("pct", () => {
  it("returns 0 when whole is 0", () => expect(pct(3, 0)).toBe(0));
  it("rounds to one decimal", () => expect(pct(1, 3)).toBe(33.3));
});

describe("departmentUtilization", () => {
  it("maps departments to utilization rows with name and pct", () => {
    const deps = [
      { name: "Cardiology", current_capacity: 15, max_capacity: 30 },
      { name: "Neurology", current_capacity: 5, max_capacity: 0 },
    ] as Department[];
    expect(departmentUtilization(deps)).toEqual([
      { department: "Cardiology", current: 15, max: 30, pct: 50 },
      { department: "Neurology", current: 5, max: 0, pct: 0 },
    ]);
  });
});
