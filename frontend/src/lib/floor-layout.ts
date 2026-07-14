import type { BedStatus, FloorDetail, FloorPatient, FloorRoom } from "@/lib/api/types";

export interface Rect { x: number; y: number; width: number; height: number }

export interface FloorPlanGeometry {
  viewBox: { x: number; y: number; width: number; height: number };
  walls: Rect[];
  corridors: Rect[];
  serviceCores: { rect: Rect; label: string }[];
  wards: { name: string; department: string; labelPos: { x: number; y: number } }[];
  rooms: {
    id: string; name: string; roomType: string; rect: Rect;
    isSecretariat: boolean; occupied: number; capacity: number;
  }[];
  beds: {
    id: string; status: BedStatus; x: number; y: number;
    room: string; ward: string; department: string; patient?: FloorPatient;
  }[];
}

// Fixed canvas the SVG scales to fill its container (preserveAspectRatio).
const VIEW_W = 1600;
const VIEW_H = 900;

const MARGIN = 40;
const HEADER_HEIGHT = 30;
const SPINE_HEIGHT = 70;
const CORE_SIZE = 60;
const WARD_GAP = 24;
const ROOM_GAP = 8;
const WALL_THICKNESS = 6;
const DIVIDER_THICKNESS = 4;
const NURSE_STRIP_RATIO = 0.22;
const ROOM_WIDTH_BASE = 0.86;
const JITTER_AMPLITUDE = 0.08;

/** Deterministic FNV-1a style string hash mapped into [0, 1). No Math.random / Date.now. */
function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Deterministic jitter in [-amplitude, +amplitude], seeded by index/id strings. */
function jitter(seed: string, amplitude = JITTER_AMPLITUDE): number {
  return (hashUnit(seed) * 2 - 1) * amplitude;
}

function isSecretariat(room: FloorRoom): boolean {
  return room.room_type.toUpperCase() === "SECRETARIAT";
}

function bedPoints(rect: Rect, count: number): { x: number; y: number }[] {
  if (count <= 0) return [];
  const cols = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / cols);
  const insetX = Math.min(rect.width * 0.22, 14);
  const insetY = Math.min(rect.height * 0.22, 14);
  const usableWidth = Math.max(1, rect.width - insetX * 2);
  const usableHeight = Math.max(1, rect.height - insetY * 2);

  return Array.from({ length: count }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      x: rect.x + insetX + ((col + 0.5) / cols) * usableWidth,
      y: rect.y + insetY + ((row + 0.5) / rows) * usableHeight,
    };
  });
}

/**
 * Stacks rooms vertically inside a zone, filling its full height exactly
 * (sum of room heights + gaps === zone.height). Room height varies by a
 * deterministic per-room jitter weight; room width is anchored to the
 * zone's outer edge (away from the branch corridor) and jittered inward.
 */
function stackZone(
  zone: Rect,
  rooms: FloorRoom[],
  wardId: string,
  side: "left" | "right",
  reverse: boolean,
): { room: FloorRoom; rect: Rect }[] {
  if (rooms.length === 0) return [];
  const ordered = reverse ? [...rooms].reverse() : rooms;
  const weights = ordered.map((room) => 1 + jitter(`${wardId}:${room.id}:h`));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const gapTotal = ROOM_GAP * (ordered.length - 1);
  const availableHeight = Math.max(1, zone.height - gapTotal);

  let cursorY = zone.y;
  return ordered.map((room, index) => {
    const height = (availableHeight * weights[index]) / totalWeight;
    const width = zone.width * (ROOM_WIDTH_BASE + jitter(`${wardId}:${room.id}:w`));
    const x = side === "left" ? zone.x : zone.x + zone.width - width;
    const rect: Rect = { x, y: cursorY, width, height };
    cursorY += height + ROOM_GAP;
    return { room, rect };
  });
}

export function computeFloorPlan(floor: FloorDetail): FloorPlanGeometry {
  const walls: Rect[] = [
    { x: 0, y: 0, width: VIEW_W, height: WALL_THICKNESS },
    { x: 0, y: VIEW_H - WALL_THICKNESS, width: VIEW_W, height: WALL_THICKNESS },
    { x: 0, y: 0, width: WALL_THICKNESS, height: VIEW_H },
    { x: VIEW_W - WALL_THICKNESS, y: 0, width: WALL_THICKNESS, height: VIEW_H },
  ];

  const spineY = VIEW_H / 2 - SPINE_HEIGHT / 2;
  const corridors: Rect[] = [{ x: MARGIN, y: spineY, width: VIEW_W - 2 * MARGIN, height: SPINE_HEIGHT }];

  const serviceCores: { rect: Rect; label: string }[] = [
    { rect: { x: MARGIN, y: spineY, width: CORE_SIZE, height: SPINE_HEIGHT }, label: "Treppe" },
    { rect: { x: VIEW_W - MARGIN - CORE_SIZE, y: spineY, width: CORE_SIZE, height: SPINE_HEIGHT }, label: "Aufzug" },
    { rect: { x: VIEW_W / 2 - CORE_SIZE / 2, y: spineY, width: CORE_SIZE, height: SPINE_HEIGHT }, label: "WC" },
  ];

  const wardsOut: FloorPlanGeometry["wards"] = [];
  const roomsOut: FloorPlanGeometry["rooms"] = [];
  const bedsOut: FloorPlanGeometry["beds"] = [];

  const wards = floor.wards;
  const n = wards.length;

  if (n === 0) {
    return {
      viewBox: { x: 0, y: 0, width: VIEW_W, height: VIEW_H },
      walls, corridors, serviceCores,
      wards: wardsOut, rooms: roomsOut, beds: bedsOut,
    };
  }

  const innerX = MARGIN + CORE_SIZE + WARD_GAP;
  const innerWidth = VIEW_W - 2 * (MARGIN + CORE_SIZE + WARD_GAP);
  const colWidth = (innerWidth - (n - 1) * WARD_GAP) / n;

  const topZoneHeight = spineY - MARGIN - HEADER_HEIGHT;
  const bottomZoneY = spineY + SPINE_HEIGHT;
  const bottomZoneHeight = VIEW_H - MARGIN - bottomZoneY;

  wards.forEach((ward, wardIndex) => {
    const colX = innerX + wardIndex * (colWidth + WARD_GAP);

    if (wardIndex > 0) {
      const gapMidX = colX - WARD_GAP / 2;
      walls.push({
        x: gapMidX - DIVIDER_THICKNESS / 2, y: MARGIN,
        width: DIVIDER_THICKNESS, height: VIEW_H - 2 * MARGIN,
      });
    }

    const branchWidth = Math.min(90, Math.max(40, colWidth * 0.28), colWidth * 0.4);
    const branchX = colX + colWidth / 2 - branchWidth / 2;
    corridors.push({ x: branchX, y: MARGIN, width: branchWidth, height: VIEW_H - 2 * MARGIN });

    const leftColX = colX;
    const leftColWidth = branchX - colX;
    const rightColX = branchX + branchWidth;
    const rightColWidth = colX + colWidth - rightColX;

    const zoneTL: Rect = { x: leftColX, y: MARGIN + HEADER_HEIGHT, width: leftColWidth, height: topZoneHeight };
    const zoneBLFull: Rect = { x: leftColX, y: bottomZoneY, width: leftColWidth, height: bottomZoneHeight };
    const zoneTR: Rect = { x: rightColX, y: MARGIN + HEADER_HEIGHT, width: rightColWidth, height: topZoneHeight };
    const zoneBR: Rect = { x: rightColX, y: bottomZoneY, width: rightColWidth, height: bottomZoneHeight };

    // Nurse station: carved from the top of the bottom-left zone (nearest the spine junction).
    const nurseHeight = Math.min(CORE_SIZE, zoneBLFull.height * NURSE_STRIP_RATIO);
    const nurseRect: Rect = { x: zoneBLFull.x, y: zoneBLFull.y, width: zoneBLFull.width, height: nurseHeight };
    const zoneBL: Rect = {
      x: zoneBLFull.x,
      y: zoneBLFull.y + nurseHeight + ROOM_GAP,
      width: zoneBLFull.width,
      height: Math.max(1, zoneBLFull.height - nurseHeight - ROOM_GAP),
    };
    serviceCores.push({ rect: nurseRect, label: `${ward.name} · Station` });

    const { secretariat, patient } = ward.rooms.reduce<{ secretariat: FloorRoom[]; patient: FloorRoom[] }>(
      (acc, room) => {
        if (isSecretariat(room)) acc.secretariat.push(room);
        else acc.patient.push(room);
        return acc;
      },
      { secretariat: [], patient: [] },
    );

    // Secretariat rooms live at the ward head, near the spine: reversed order
    // so the first secretariat room lands closest to the spine junction.
    const placedSecretariat = stackZone(zoneTR, secretariat, ward.id, "right", true);

    const patientZones: { zone: Rect; side: "left" | "right" }[] =
      secretariat.length > 0
        ? [
            { zone: zoneTL, side: "left" },
            { zone: zoneBL, side: "left" },
            { zone: zoneBR, side: "right" },
          ]
        : [
            { zone: zoneTL, side: "left" },
            { zone: zoneBL, side: "left" },
            { zone: zoneBR, side: "right" },
            { zone: zoneTR, side: "right" },
          ];

    const perZoneRooms: FloorRoom[][] = patientZones.map(() => []);
    patient.forEach((room, index) => {
      perZoneRooms[index % patientZones.length].push(room);
    });

    const placedPatient = patientZones.flatMap((pz, zoneIndex) =>
      stackZone(pz.zone, perZoneRooms[zoneIndex], ward.id, pz.side, false),
    );

    for (const { room, rect } of [...placedSecretariat, ...placedPatient]) {
      const secretariatFlag = isSecretariat(room);
      roomsOut.push({
        id: room.id,
        name: room.name,
        roomType: room.room_type,
        rect,
        isSecretariat: secretariatFlag,
        occupied: room.current_capacity,
        capacity: room.bed_capacity,
      });

      if (!secretariatFlag) {
        const points = bedPoints(rect, room.beds.length);
        room.beds.forEach((bed, bedIndex) => {
          const point = points[bedIndex];
          bedsOut.push({
            id: bed.id,
            status: bed.status,
            x: point.x,
            y: point.y,
            room: room.name,
            ward: ward.name,
            department: ward.department,
            patient: bed.patient,
          });
        });
      }
    }

    wardsOut.push({
      name: ward.name,
      department: ward.department,
      labelPos: { x: colX + colWidth / 2, y: MARGIN + HEADER_HEIGHT / 2 + 5 },
    });
  });

  return {
    viewBox: { x: 0, y: 0, width: VIEW_W, height: VIEW_H },
    walls, corridors, serviceCores,
    wards: wardsOut, rooms: roomsOut, beds: bedsOut,
  };
}
