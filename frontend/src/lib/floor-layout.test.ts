import { describe, expect, it } from "vitest";
import type { FloorDetail, FloorPatient, FloorWard } from "./api/types";
import { computeFloorPlan } from "./floor-layout";

const EPS = 0.01;

const patientAnna: FloorPatient = { first_name: "Anna", last_name: "Weber", patient_number: "P-1" };

const wardA: FloorWard = {
  id: "ward-a",
  name: "Kardiologie Normalstation",
  station_type: "NORMAL",
  department: "Kardiologie",
  rooms: [
    { id: "r1", name: "Sekretariat A", room_type: "SECRETARIAT", bed_capacity: 0, current_capacity: 0, beds: [] },
    {
      id: "r2", name: "Zimmer 101", room_type: "DOUBLE", bed_capacity: 2, current_capacity: 1,
      beds: [
        { id: "b1", status: "OCCUPIED", room: "Zimmer 101", patient: patientAnna },
        { id: "b2", status: "FREE", room: "Zimmer 101" },
      ],
    },
    {
      id: "r3", name: "Zimmer 102", room_type: "DOUBLE", bed_capacity: 2, current_capacity: 2,
      beds: [
        { id: "b3", status: "OCCUPIED", room: "Zimmer 102" },
        { id: "b4", status: "RESERVED", room: "Zimmer 102" },
      ],
    },
    {
      id: "r4", name: "Zimmer 103", room_type: "SINGLE", bed_capacity: 1, current_capacity: 1,
      beds: [{ id: "b5", status: "OCCUPIED", room: "Zimmer 103" }],
    },
  ],
};

const wardB: FloorWard = {
  id: "ward-b",
  name: "Intensivstation",
  station_type: "INTENSIVE",
  department: "Intensivmedizin",
  rooms: [
    {
      id: "r5", name: "ICU 1", room_type: "SINGLE", bed_capacity: 1, current_capacity: 0,
      beds: [{ id: "b6", status: "FREE", room: "ICU 1" }],
    },
    {
      id: "r6", name: "ICU 2", room_type: "DOUBLE", bed_capacity: 2, current_capacity: 1,
      beds: [
        { id: "b7", status: "OCCUPIED", room: "ICU 2" },
        { id: "b8", status: "FREE", room: "ICU 2" },
      ],
    },
    {
      id: "r10", name: "ICU 3", room_type: "SINGLE", bed_capacity: 1, current_capacity: 1,
      beds: [{ id: "b12", status: "OCCUPIED", room: "ICU 3" }],
    },
    {
      id: "r11", name: "ICU 4", room_type: "DOUBLE", bed_capacity: 2, current_capacity: 0,
      beds: [
        { id: "b13", status: "FREE", room: "ICU 4" },
        { id: "b14", status: "FREE", room: "ICU 4" },
      ],
    },
  ],
};

const wardC: FloorWard = {
  id: "ward-c",
  name: "Chirurgie",
  station_type: "NORMAL",
  department: "Chirurgie",
  rooms: [
    { id: "r7", name: "Sekretariat C", room_type: "SECRETARIAT", bed_capacity: 0, current_capacity: 0, beds: [] },
    {
      id: "r8", name: "Zimmer 201", room_type: "DOUBLE", bed_capacity: 2, current_capacity: 2,
      beds: [
        { id: "b9", status: "OCCUPIED", room: "Zimmer 201" },
        { id: "b10", status: "RESERVED", room: "Zimmer 201" },
      ],
    },
    {
      id: "r9", name: "Zimmer 202", room_type: "SINGLE", bed_capacity: 1, current_capacity: 0,
      beds: [{ id: "b11", status: "FREE", room: "Zimmer 202" }],
    },
  ],
};

const floor: FloorDetail = { building: "Haus A", level: 1, label: "1. OG", wards: [wardA, wardB, wardC] };

function allInputRoomIds(f: FloorDetail): string[] {
  return f.wards.flatMap((w) => w.rooms.map((r) => r.id));
}

function totalInputBeds(f: FloorDetail): number {
  return f.wards.flatMap((w) => w.rooms).reduce((sum, r) => sum + r.beds.length, 0);
}

function rectWithinBounds(rect: { x: number; y: number; width: number; height: number }, viewBox: { width: number; height: number }) {
  expect(rect.x).toBeGreaterThanOrEqual(-EPS);
  expect(rect.y).toBeGreaterThanOrEqual(-EPS);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewBox.width + EPS);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewBox.height + EPS);
}

describe("computeFloorPlan", () => {
  it("is deterministic across repeated calls", () => {
    const a = computeFloorPlan(floor);
    const b = computeFloorPlan(floor);
    expect(a).toEqual(b);
  });

  it("includes every input room exactly once", () => {
    const geometry = computeFloorPlan(floor);
    const inputIds = allInputRoomIds(floor).sort();
    const outputIds = geometry.rooms.map((r) => r.id).sort();
    expect(outputIds).toEqual(inputIds);
    expect(new Set(outputIds).size).toBe(outputIds.length);
  });

  it("flags SECRETARIAT rooms and gives them no beds", () => {
    const geometry = computeFloorPlan(floor);
    const secretariatRooms = geometry.rooms.filter((r) => r.isSecretariat);
    expect(secretariatRooms.map((r) => r.id).sort()).toEqual(["r1", "r7"]);

    const secretariatNames = new Set(secretariatRooms.map((r) => r.name));
    for (const bed of geometry.beds) {
      expect(secretariatNames.has(bed.room)).toBe(false);
    }
  });

  it("places exactly one bed point per input bed", () => {
    const geometry = computeFloorPlan(floor);
    expect(geometry.beds).toHaveLength(totalInputBeds(floor));
    expect(new Set(geometry.beds.map((b) => b.id)).size).toBe(geometry.beds.length);
  });

  it("keeps every rect within the viewBox", () => {
    const geometry = computeFloorPlan(floor);
    const allRects = [
      ...geometry.walls,
      ...geometry.corridors,
      ...geometry.serviceCores.map((c) => c.rect),
      ...geometry.rooms.map((r) => r.rect),
    ];
    for (const rect of allRects) rectWithinBounds(rect, geometry.viewBox);
  });

  it("does not overlap ward columns", () => {
    const geometry = computeFloorPlan(floor);
    const boxes = floor.wards.map((ward) => {
      const ids = new Set(ward.rooms.map((r) => r.id));
      const rects = geometry.rooms.filter((r) => ids.has(r.id)).map((r) => r.rect);
      const minX = Math.min(...rects.map((r) => r.x));
      const maxX = Math.max(...rects.map((r) => r.x + r.width));
      return { minX, maxX };
    });
    boxes.sort((a, b) => a.minX - b.minX);
    for (let i = 0; i < boxes.length - 1; i += 1) {
      expect(boxes[i].maxX).toBeLessThanOrEqual(boxes[i + 1].minX + EPS);
    }
  });

  it("gives every ward at least one corridor contained in its column", () => {
    const geometry = computeFloorPlan(floor);
    for (const ward of floor.wards) {
      const ids = new Set(ward.rooms.map((r) => r.id));
      const rects = geometry.rooms.filter((r) => ids.has(r.id)).map((r) => r.rect);
      const minX = Math.min(...rects.map((r) => r.x));
      const maxX = Math.max(...rects.map((r) => r.x + r.width));

      const hasContainedCorridor = geometry.corridors.some(
        (c) => c.x >= minX - EPS && c.x + c.width <= maxX + EPS,
      );
      expect(hasContainedCorridor).toBe(true);
    }
  });

  it("produces one ward summary per ward with a label inside the viewBox", () => {
    const geometry = computeFloorPlan(floor);
    expect(geometry.wards).toHaveLength(floor.wards.length);
    expect(geometry.wards.map((w) => w.name)).toEqual(floor.wards.map((w) => w.name));
    for (const ward of geometry.wards) {
      expect(ward.labelPos.x).toBeGreaterThanOrEqual(0);
      expect(ward.labelPos.x).toBeLessThanOrEqual(geometry.viewBox.width);
      expect(ward.labelPos.y).toBeGreaterThanOrEqual(0);
      expect(ward.labelPos.y).toBeLessThanOrEqual(geometry.viewBox.height);
    }
  });

  it("handles a floor with no wards without crashing", () => {
    const empty: FloorDetail = { building: "Haus A", level: 0, label: "EG", wards: [] };
    const geometry = computeFloorPlan(empty);
    expect(geometry.wards).toEqual([]);
    expect(geometry.rooms).toEqual([]);
    expect(geometry.beds).toEqual([]);
  });
});
