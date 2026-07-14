import { describe, expect, test } from "bun:test";
import { berlinTimestamp } from "../src/api/time";

describe("Berlin time helpers", () => {
  test("formats winter timestamps with the CET offset", () => {
    expect(berlinTimestamp(new Date("2026-01-15T12:00:00.000Z"))).toBe(
      "2026-01-15T13:00:00.000+01:00",
    );
  });

  test("formats summer timestamps with the CEST offset", () => {
    expect(berlinTimestamp(new Date("2026-07-15T12:00:00.000Z"))).toBe(
      "2026-07-15T14:00:00.000+02:00",
    );
  });
});
