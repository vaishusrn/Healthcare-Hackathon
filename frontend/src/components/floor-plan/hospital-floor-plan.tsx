import type { ChangeEvent, KeyboardEvent } from "react";
import { useMemo } from "react";
import { BedDouble, Building2, Layers, Maximize2 } from "lucide-react";
import { BedInspector } from "@/components/three/bed-inspector";
import { Skeleton } from "@/components/ui/skeleton";
import type { BedStatus, FloorDetail, FloorSummary } from "@/lib/api/types";
import { computeFloorPlan, type FloorPlanGeometry, type Rect } from "@/lib/floor-layout";
import { STATUS_COLOR } from "@/lib/status-colors";

const STATUS_LABEL: Record<BedStatus, string> = {
  FREE: "Free",
  RESERVED: "Reserved",
  OCCUPIED: "Occupied",
};

const ACCENT_PALETTE = [
  "#2563eb", "#0f766e", "#9333ea", "#ea580c", "#0891b2", "#be123c",
  "#4d7c0f", "#7c3aed", "#c2410c", "#0369a1", "#15803d", "#b45309",
];

/** Deterministic FNV-1a style string hash mapped into [0, 1). */
function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function accentForDepartment(department: string): string {
  const index = Math.floor(hashUnit(department) * ACCENT_PALETTE.length) % ACCENT_PALETTE.length;
  return ACCENT_PALETTE[index];
}

function boundingRect(rects: Rect[], pad: number): Rect {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
}

interface WardZone {
  key: string;
  name: string;
  accent: string;
  rects: Rect[];
  labelPos: { x: number; y: number };
}

/**
 * Derives a tinted background zone per ward from the room + nurse-station
 * rects that belong to it (geometry itself is dumb and only exposes a
 * label position). Rooms are split into a top and bottom cluster so the
 * tint never bleeds across the central spine corridor.
 */
function buildWardZones(floor: FloorDetail, geometry: FloorPlanGeometry): WardZone[] {
  const viewMidY = geometry.viewBox.height / 2;

  return floor.wards.map((ward, index) => {
    const roomIds = new Set(ward.rooms.map((r) => r.id));
    const rects = geometry.rooms.filter((r) => roomIds.has(r.id)).map((r) => r.rect);

    const core = geometry.serviceCores.find((c) => c.label === `${ward.name} · Station`);
    if (core) rects.push(core.rect);

    const top: Rect[] = [];
    const bottom: Rect[] = [];
    for (const rect of rects) {
      (rect.y + rect.height / 2 < viewMidY ? top : bottom).push(rect);
    }

    const zoneRects = [top, bottom].filter((group) => group.length > 0).map((group) => boundingRect(group, 10));

    return {
      key: ward.id,
      name: ward.name,
      accent: accentForDepartment(ward.department),
      rects: zoneRects,
      labelPos: geometry.wards[index]?.labelPos ?? { x: 0, y: 0 },
    };
  });
}

export function HospitalFloorPlan({
  floors,
  building,
  level,
  floorDetail,
  selectedBedId,
  onSelectFloor,
  onSelectBed,
  onFullscreen,
}: {
  floors: FloorSummary[];
  building: string;
  level: number;
  floorDetail: FloorDetail | undefined;
  selectedBedId: string;
  onSelectFloor: (building: string, level: number) => void;
  onSelectBed: (bedId: string) => void;
  onFullscreen?: () => void;
}) {
  const geometry = useMemo(() => (floorDetail ? computeFloorPlan(floorDetail) : null), [floorDetail]);
  const wardZones = useMemo(
    () => (floorDetail && geometry ? buildWardZones(floorDetail, geometry) : []),
    [floorDetail, geometry],
  );

  const buildings = useMemo(() => [...new Set(floors.map((f) => f.building))].sort(), [floors]);
  const floorsInBuilding = useMemo(
    () => floors.filter((f) => f.building === building).sort((a, b) => a.level - b.level),
    [floors, building],
  );
  const currentSummary = floorsInBuilding.find((f) => f.level === level);
  const selectedBed = geometry?.beds.find((b) => b.id === selectedBedId) ?? null;

  const handleBuildingChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextBuilding = event.target.value;
    const nextFloors = floors.filter((f) => f.building === nextBuilding).sort((a, b) => a.level - b.level);
    onSelectFloor(nextBuilding, nextFloors[0]?.level ?? 0);
  };

  const handleFloorChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSelectFloor(building, Number(event.target.value));
  };

  const handleBedKeyDown = (event: KeyboardEvent<SVGCircleElement>, bedId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectBed(bedId);
    }
  };

  return (
    <div className="flex h-full min-h-[620px] flex-col bg-slate-50">
      <div className="flex flex-wrap items-center gap-5 border-b border-slate-200 bg-white px-4 py-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Building2 className="size-3.5" />
          Building
          <select
            className="h-8 rounded-none border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus-visible:border-slate-500"
            value={building}
            onChange={handleBuildingChange}
            disabled={buildings.length === 0}
          >
            {buildings.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Layers className="size-3.5" />
          Floor
          <select
            className="h-8 rounded-none border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus-visible:border-slate-500"
            value={level}
            onChange={handleFloorChange}
            disabled={floorsInBuilding.length === 0}
          >
            {floorsInBuilding.map((f) => (
              <option key={f.level} value={f.level}>{f.label}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3 text-xs text-slate-600">
          <BedDouble className="size-3.5" />
          {(["OCCUPIED", "RESERVED", "FREE"] as const).map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
              {STATUS_LABEL[status]}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {currentSummary && (
            <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
              <span className="tabular-nums">{currentSummary.occupied}/{currentSummary.bed_total} occupied</span>
              <span className="text-slate-400">·</span>
              <span className="tabular-nums">{Math.round(currentSummary.occupancy_pct)}%</span>
            </div>
          )}
          {onFullscreen && (
            <button
              type="button"
              onClick={onFullscreen}
              aria-label="Open floor plan fullscreen"
              className="flex items-center gap-1.5 border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Maximize2 className="size-3.5" />
              Fullscreen
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {!floorDetail ? (
          <div className="flex h-full min-h-[500px] items-center justify-center p-6">
            <div className="w-full max-w-3xl space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-[440px] w-full" />
            </div>
          </div>
        ) : !geometry || geometry.wards.length === 0 ? (
          <div className="flex h-full min-h-[500px] items-center justify-center p-6 text-sm text-muted-foreground">
            No wards found on this floor.
          </div>
        ) : (
          <svg
            className="h-full w-full"
            viewBox={`${geometry.viewBox.x} ${geometry.viewBox.y} ${geometry.viewBox.width} ${geometry.viewBox.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Floor plan ${floorDetail.label}`}
          >
            <defs>
              <pattern id="floor-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e2e8f0" strokeWidth="1" />
              </pattern>
              <pattern id="secretariat-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill="#f1f5f9" />
                <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" strokeWidth="4" />
              </pattern>
            </defs>

            <rect
              x={geometry.viewBox.x}
              y={geometry.viewBox.y}
              width={geometry.viewBox.width}
              height={geometry.viewBox.height}
              fill="url(#floor-grid)"
            />

            {wardZones.map((zone) =>
              zone.rects.map((rect, i) => (
                <rect
                  key={`${zone.key}-zone-${i}`}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  rx={6}
                  fill={`${zone.accent}12`}
                  stroke={`${zone.accent}55`}
                  strokeWidth={2}
                />
              )),
            )}

            {geometry.corridors.map((c, i) => (
              <rect key={i} x={c.x} y={c.y} width={c.width} height={c.height} rx={6} fill="#e0f2fe" stroke="#7dd3fc" strokeWidth={2} />
            ))}

            {geometry.walls.map((w, i) => (
              <rect key={i} x={w.x} y={w.y} width={w.width} height={w.height} fill="#1e293b" />
            ))}

            {geometry.serviceCores.map((core, i) => (
              <g key={i}>
                <rect
                  x={core.rect.x}
                  y={core.rect.y}
                  width={core.rect.width}
                  height={core.rect.height}
                  rx={4}
                  fill="#f1f5f9"
                  stroke="#64748b"
                  strokeWidth={1.5}
                />
                {core.rect.width > 36 && core.rect.height > 16 && (
                  <text
                    x={core.rect.x + core.rect.width / 2}
                    y={core.rect.y + core.rect.height / 2 + 4}
                    textAnchor="middle"
                    className="fill-slate-600 text-[10px] font-medium"
                  >
                    {core.label}
                  </text>
                )}
              </g>
            ))}

            {geometry.rooms.map((room) => (
              <g key={room.id}>
                <rect
                  x={room.rect.x}
                  y={room.rect.y}
                  width={room.rect.width}
                  height={room.rect.height}
                  rx={4}
                  fill={room.isSecretariat ? "url(#secretariat-hatch)" : "#ffffff"}
                  stroke={room.isSecretariat ? "#94a3b8" : "#cbd5e1"}
                  strokeWidth={1.5}
                />
                {room.rect.width > 46 && room.rect.height > 26 && (
                  <text x={room.rect.x + 6} y={room.rect.y + 15} className="fill-slate-700 text-[11px] font-medium">
                    {room.name}
                  </text>
                )}
                {!room.isSecretariat && room.rect.width > 46 && room.rect.height > 40 && (
                  <text x={room.rect.x + 6} y={room.rect.y + room.rect.height - 7} className="fill-slate-500 text-[9px] tabular-nums">
                    {room.occupied}/{room.capacity}
                  </text>
                )}
              </g>
            ))}

            {wardZones.map((zone) => {
              const pillWidth = zone.name.length * 7.5 + 18;
              return (
                <g key={`${zone.key}-label`}>
                  <rect
                    x={zone.labelPos.x - pillWidth / 2}
                    y={zone.labelPos.y - 14}
                    width={pillWidth}
                    height={20}
                    rx={4}
                    fill="#ffffff"
                    stroke={`${zone.accent}66`}
                    strokeWidth={1}
                  />
                  <text
                    x={zone.labelPos.x}
                    y={zone.labelPos.y}
                    textAnchor="middle"
                    className="fill-slate-900 text-[13px] font-semibold"
                  >
                    {zone.name}
                  </text>
                </g>
              );
            })}

            {geometry.beds.map((bed) => {
              const selected = bed.id === selectedBedId;
              const patientLabel = bed.patient ? ` · ${bed.patient.first_name} ${bed.patient.last_name}` : "";
              return (
                <circle
                  key={bed.id}
                  cx={bed.x}
                  cy={bed.y}
                  r={selected ? 9 : 6}
                  fill={STATUS_COLOR[bed.status]}
                  stroke={selected ? "#0f172a" : "#ffffff"}
                  strokeWidth={selected ? 3 : 2}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer outline-none transition"
                  aria-label={`${bed.id} ${STATUS_LABEL[bed.status]}`}
                  onClick={() => onSelectBed(bed.id)}
                  onKeyDown={(event) => handleBedKeyDown(event, bed.id)}
                >
                  <title>{`${bed.id} · ${STATUS_LABEL[bed.status]} · ${bed.room} · ${bed.ward}${patientLabel}`}</title>
                </circle>
              );
            })}
          </svg>
        )}

        {selectedBed && <BedInspector bed={selectedBed} onClose={() => onSelectBed("")} />}
      </div>
    </div>
  );
}
