// Pure, deterministic structural seed generators for the hospital's physical
// layout: departments -> buildings/floors -> wards (stations) -> rooms -> beds.
//
// No DB access here. `generateStructure()` always returns the exact same
// arrays for the same code (there is no external input): it seeds a single
// mulberry32 PRNG with a fixed seed and everything else is derived from that
// stream plus loop indices, never `Math.random()` / `Date.now()` / bare
// `new Date()`.
//
// IMPORTANT cross-task handoff (see task-2-brief.md / task-2-report.md):
// Bed `status` produced here is PROVISIONAL ONLY. It is assigned via PRNG
// thresholds to roughly match a realistic ~84% OCCUPIED / ~5% RESERVED / rest
// FREE split so downstream consumers (Task 4's inserter, UI dashboards, etc.)
// have plausible-looking data out of the box. Task 3 owns pairing beds with
// active inpatient visits and MUST re-derive/override `status` per bed so
// that the exact set of OCCUPIED beds equals the active-inpatient count.
// Nothing here should be treated as authoritative bed occupancy.
import type {
  BedStatus,
  BedType,
  Gender,
  NewAppointmentRow,
  NewAppointmentTypeRow,
  NewBedRow,
  NewDepartmentRow,
  NewEmployeeRow,
  NewPatientRow,
  NewPatientVisitRow,
  NewRoomRow,
  NewSocialSecurityNumberRow,
  NewStationRow,
  RoomType,
  StationType,
} from "./schema";
import { bedMaterials } from "./schema";
import { mulberry32 } from "./prng";

// These *Seed types intentionally mirror the (unexported) shapes in
// `seed.ts`'s `*Seed` types: the row shape minus DB-assigned columns
// (`id`/`createdAt`/`updatedAt`/foreign-key ids), with `*PublicId` string
// references in their place so a later inserter (Task 4) can resolve them.
export type DepartmentSeed = Omit<
  NewDepartmentRow,
  "id" | "createdAt" | "updatedAt"
>;

export type StationSeed = Omit<
  NewStationRow,
  "id" | "departmentId" | "createdAt" | "updatedAt"
> & {
  building: string;
  floor: number;
  departmentPublicId: string;
};

export type RoomSeed = Omit<
  NewRoomRow,
  "id" | "departmentId" | "stationId" | "createdAt" | "updatedAt"
> & {
  departmentPublicId: string;
  stationPublicId: string;
};

export type BedSeed = Omit<
  NewBedRow,
  "id" | "departmentId" | "stationId" | "roomId" | "createdAt" | "updatedAt"
> & {
  departmentPublicId: string;
  stationPublicId: string;
  roomPublicId: string | null;
};

export type GeneratedStructure = {
  departments: DepartmentSeed[];
  stations: StationSeed[];
  rooms: RoomSeed[];
  beds: BedSeed[];
};

/**
 * ~34 real departments found in a large German Uniklinikum. `kuerzel` is a
 * short internal abbreviation used to build station/room names; it is not a
 * persisted column (the `departments` table has no such field).
 */
export const SEED_DEPARTMENTS: { name: string; kuerzel: string }[] = [
  { name: "Kardiologie", kuerzel: "KAR" },
  { name: "Herzchirurgie", kuerzel: "HCH" },
  { name: "Neurologie", kuerzel: "NEU" },
  { name: "Neurochirurgie", kuerzel: "NCH" },
  { name: "Hämatologie und Onkologie", kuerzel: "HÄM" },
  { name: "Gastroenterologie", kuerzel: "GAS" },
  { name: "Nephrologie", kuerzel: "NEP" },
  { name: "Pneumologie", kuerzel: "PNE" },
  { name: "Endokrinologie und Diabetologie", kuerzel: "END" },
  { name: "Rheumatologie und Klinische Immunologie", kuerzel: "RHE" },
  { name: "Allgemein- und Viszeralchirurgie", kuerzel: "AVC" },
  { name: "Unfallchirurgie und Orthopädie", kuerzel: "UCH" },
  { name: "Gefäßchirurgie", kuerzel: "GEF" },
  { name: "Thoraxchirurgie", kuerzel: "THO" },
  { name: "Urologie", kuerzel: "URO" },
  { name: "Gynäkologie und Geburtshilfe", kuerzel: "GYN" },
  { name: "Kinder- und Jugendmedizin", kuerzel: "KIJ" },
  { name: "Kinderchirurgie", kuerzel: "KCH" },
  { name: "Dermatologie und Venerologie", kuerzel: "DER" },
  { name: "Hals-Nasen-Ohrenheilkunde", kuerzel: "HNO" },
  { name: "Augenheilkunde", kuerzel: "AUG" },
  { name: "Mund-, Kiefer- und Gesichtschirurgie", kuerzel: "MKG" },
  { name: "Psychiatrie und Psychotherapie", kuerzel: "PSY" },
  { name: "Psychosomatische Medizin", kuerzel: "PSM" },
  { name: "Strahlentherapie", kuerzel: "STR" },
  { name: "Radiologie", kuerzel: "RAD" },
  { name: "Nuklearmedizin", kuerzel: "NUK" },
  { name: "Labormedizin", kuerzel: "LAB" },
  { name: "Pathologie", kuerzel: "PAT" },
  { name: "Transfusionsmedizin", kuerzel: "TRA" },
  { name: "Anästhesiologie und Intensivmedizin", kuerzel: "ANI" },
  { name: "Zentrale Notaufnahme", kuerzel: "ZNA" },
  { name: "Geriatrie", kuerzel: "GER" },
  { name: "Palliativmedizin", kuerzel: "PAL" },
];

/** ~10 themed building ("Haus") names the hospital campus is split across. */
export const BUILDINGS: string[] = [
  "Haus 1 – Bettenhaus",
  "Haus 2 – Herzzentrum",
  "Haus 3 – Frauen- und Kinderklinik",
  "Haus 4 – Kopfklinik",
  "Haus 5 – Chirurgie",
  "Haus 6 – Onkologisches Zentrum",
  "Haus 7 – Neurozentrum",
  "Haus 8 – Innere Medizin",
  "Haus 9 – Notfallzentrum",
  "Haus 10 – Institute",
];

const FLOORS_PER_BUILDING = 7;
const TOTAL_SLOTS = BUILDINGS.length * FLOORS_PER_BUILDING;

const SINGLE_ROOM_TYPES: RoomType[] = [
  "SINGLE_ROOM_STANDARD",
  "SINGLE_ROOM_INFECTIOUS",
  "SINGLE_ROOM_AIRLOCK",
];

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/**
 * Generate the full deterministic structural seed: departments, wards
 * (stations), rooms (incl. secretariats), and beds. Pure function — same
 * output every call, no DB, no wall-clock, no `Math.random()`.
 */
export function generateStructure(): GeneratedStructure {
  const rnd = mulberry32(1);

  const departments: DepartmentSeed[] = [];
  const stations: StationSeed[] = [];
  const rooms: RoomSeed[] = [];
  const beds: BedSeed[] = [];

  let globalWardIndex = 0;
  let stationCounter = 0;
  let roomCounter = 0;
  let bedCounter = 0;

  // Tracks how many wards have already landed on a given (building, floor)
  // slot, purely so we can hand out a stable "wing letter" (A, B, C, ...) per
  // slot — index-derived, not randomized.
  const slotWardOrdinals = new Map<number, number>();

  SEED_DEPARTMENTS.forEach((department, departmentIndex) => {
    const departmentPublicId = `dep_Berlin${pad(departmentIndex + 1, 6)}`;

    // 8-15 wards per department (~11.5 average * 34 departments ~= 390 wards,
    // comfortably inside the [300, 420] station scale target).
    const wardCount = 8 + Math.floor(rnd() * 8);
    const intensiveWardThreshold = Math.ceil(wardCount * 0.25);

    let departmentBedTotal = 0;
    let departmentOccupiedTotal = 0;

    for (let wardIndex = 0; wardIndex < wardCount; wardIndex += 1) {
      const slot = globalWardIndex % TOTAL_SLOTS;
      const buildingIndex = Math.floor(slot / FLOORS_PER_BUILDING);
      const floor = (slot % FLOORS_PER_BUILDING) + 1;
      const building = BUILDINGS[buildingIndex]!;

      const slotOrdinal = slotWardOrdinals.get(slot) ?? 0;
      slotWardOrdinals.set(slot, slotOrdinal + 1);
      const letter = String.fromCharCode(65 + (slotOrdinal % 26));

      const stationType: StationType =
        wardIndex < intensiveWardThreshold ? "INTENSIVE" : "NORMAL";

      stationCounter += 1;
      const stationPublicId = `sta_Berlin${pad(stationCounter, 6)}`;

      stations.push({
        publicId: stationPublicId,
        name: `Station ${department.kuerzel} ${letter}${floor}`,
        stationType,
        building,
        floor,
        departmentPublicId,
      });

      // 12-19 patient rooms per ward (~15.5 average), tuned so total rooms
      // (patient + secretariat) land inside the [6000, 8500] scale target
      // and total beds land inside the [9500, 12500] scale target.
      const patientRoomCount = 12 + Math.floor(rnd() * 8);
      // 1-2 dedicated secretariat rooms, plus exactly 1 Stationszimmer below
      // -> every ward gets >= 2 SECRETARIAT rooms.
      const secretariatExtras = 1 + Math.floor(rnd() * 2);

      let roomOrdinal = 0;

      for (let r = 0; r < patientRoomCount; r += 1) {
        roomOrdinal += 1;
        roomCounter += 1;
        const roomPublicId = `roo_Berlin${pad(roomCounter, 6)}`;

        // Mostly 1-2 beds/room, occasionally a 3-4 bed group room.
        let bedCount: number;
        if (rnd() < 0.15) {
          bedCount = rnd() < 0.5 ? 3 : 4;
        } else {
          bedCount = rnd() < 0.5 ? 1 : 2;
        }

        const roomType: RoomType =
          bedCount === 1
            ? SINGLE_ROOM_TYPES[roomOrdinal % SINGLE_ROOM_TYPES.length]!
            : "GROUP_ROOM";

        rooms.push({
          publicId: roomPublicId,
          name: `H${floor}-${letter}.${pad(roomOrdinal, 2)}`,
          roomType,
          departmentPublicId,
          stationPublicId,
        });

        const bedType: BedType =
          stationType === "INTENSIVE" ? "INTENSIVE_CARE" : "STANDARD";

        for (let b = 0; b < bedCount; b += 1) {
          bedCounter += 1;

          // Provisional-only status (see module doc comment above): ~84%
          // OCCUPIED / ~5% RESERVED / rest FREE. Task 3 reconciles this
          // against actual active-inpatient pairings.
          const statusRoll = rnd();
          const status: BedStatus =
            statusRoll < 0.84
              ? "OCCUPIED"
              : statusRoll < 0.89
                ? "RESERVED"
                : "FREE";

          beds.push({
            publicId: `bed_Berlin${pad(bedCounter, 6)}`,
            bedType,
            status,
            material: bedMaterials[bedCounter % bedMaterials.length]!,
            departmentPublicId,
            stationPublicId,
            roomPublicId,
          });

          departmentBedTotal += 1;
          if (status === "OCCUPIED") {
            departmentOccupiedTotal += 1;
          }
        }
      }

      for (let s = 0; s < secretariatExtras; s += 1) {
        roomOrdinal += 1;
        roomCounter += 1;

        rooms.push({
          publicId: `roo_Berlin${pad(roomCounter, 6)}`,
          name:
            secretariatExtras === 1
              ? `Sekretariat ${department.kuerzel}`
              : `Sekretariat ${department.kuerzel} ${s + 1}`,
          roomType: "SECRETARIAT",
          departmentPublicId,
          stationPublicId,
        });
      }

      roomOrdinal += 1;
      roomCounter += 1;
      rooms.push({
        publicId: `roo_Berlin${pad(roomCounter, 6)}`,
        name: "Stationszimmer",
        roomType: "SECRETARIAT",
        departmentPublicId,
        stationPublicId,
      });

      globalWardIndex += 1;
    }

    departments.push({
      publicId: departmentPublicId,
      name: department.name,
      maxCapacity: departmentBedTotal,
      currentCapacity: departmentOccupiedTotal,
    });
  });

  return { departments, stations, rooms, beds };
}

// ---------------------------------------------------------------------------
// Task 3: people + activity generators (SSNs, patients, employees, patient
// visits, appointment types, appointments). Still pure and deterministic:
// everything below is built from fixed index arithmetic (prime-multiplier
// modulo pool lookups) plus a single seeded `mulberry32` stream consumed in a
// fixed order — never `Math.random()` / `Date.now()` / a bare `new Date()`.
// Date arithmetic (`addDays`) is done with plain calendar math, not `Date`.
//
// BED-STATUS RECONCILIATION HANDOFF (see the module doc-comment above):
// `generateStructure()` only ever produces PROVISIONAL bed `status`.
// `generatePeople(structure)` is what actually owns bed occupancy:
//   1. It pins the first `INPATIENT_ACTIVE_COUNT` provisionally-OCCUPIED
//      beds (falling back to any other bed, in array order, if that pool
//      ever runs short) to distinct ACTIVE INPATIENT visits.
//   2. It returns the *entire* beds array again, under the `beds` key of its
//      result, with `status` overwritten so that:
//        - every pinned bed is OCCUPIED,
//        - every other bed keeps its Task 2 FREE/RESERVED provisional
//          status untouched,
//        - the small leftover of beds that were provisionally OCCUPIED but
//          didn't get pinned to a visit are re-rolled FREE/RESERVED off the
//          same PRNG stream (keeping a "some reserved" mix).
// Callers (Task 4's inserter) MUST insert `generatePeople(structure).beds`
// instead of `structure.beds` — that is the reconciled version, and it is
// the only one where "OCCUPIED bed count === active INPATIENT visit count"
// holds exactly.
// ---------------------------------------------------------------------------

export type SocialSecurityNumberSeed = Omit<
  NewSocialSecurityNumberRow,
  "id" | "createdAt" | "updatedAt"
>;

export type PatientSeed = Omit<
  NewPatientRow,
  "id" | "socialSecurityNumberId" | "createdAt" | "updatedAt"
> & {
  socialSecurityNumberPublicId: string;
};

export type EmployeeSeed = Omit<
  NewEmployeeRow,
  "id" | "departmentId" | "createdAt" | "updatedAt"
> & {
  departmentPublicId: string;
};

export type PatientVisitSeed = Omit<
  NewPatientVisitRow,
  | "id"
  | "patientId"
  | "departmentId"
  | "stationId"
  | "roomId"
  | "bedId"
  | "createdAt"
  | "updatedAt"
> & {
  patientPublicId: string;
  departmentPublicId: string;
  stationPublicId: string | null;
  roomPublicId: string | null;
  bedPublicId: string | null;
};

export type AppointmentTypeSeed = Omit<
  NewAppointmentTypeRow,
  "id" | "departmentId" | "createdAt" | "updatedAt"
> & {
  departmentPublicId: string;
};

export type AppointmentSeed = Omit<
  NewAppointmentRow,
  "id" | "patientId" | "appointmentTypeId" | "createdAt" | "updatedAt"
> & {
  patientPublicId: string;
  appointmentTypePublicId: string;
};

export type GeneratedPeople = {
  socialSecurityNumbers: SocialSecurityNumberSeed[];
  patients: PatientSeed[];
  employees: EmployeeSeed[];
  patientVisits: PatientVisitSeed[];
  appointmentTypes: AppointmentTypeSeed[];
  appointments: AppointmentSeed[];
  /**
   * Reconciled beds — see the handoff note above. This OVERRIDES
   * `structure.beds`; it is not the same array (status has been rewritten).
   */
  beds: BedSeed[];
};

const PERSON_COUNT = 64_324;
const EMPLOYEE_COUNT = 1000;
const INPATIENT_ACTIVE_COUNT = 9270;
const OUTPATIENT_ACTIVE_COUNT = 3971;
const DISCHARGED_VISIT_COUNT = 6000;
const APPOINTMENT_COUNT = 5000;

const REFERENCE_YEAR = 2026;
const REFERENCE_MONTH = 7;
const REFERENCE_DAY = 10;
const REFERENCE_DATE = `${REFERENCE_YEAR}-${pad(REFERENCE_MONTH, 2)}-${pad(REFERENCE_DAY, 2)}`;

const MALE_FIRST_NAMES: string[] = [
  "Lukas", "Maximilian", "Leon", "Paul", "Elias", "Felix", "Jonas", "Noah", "Ben", "Finn",
  "Luis", "Julian", "David", "Tim", "Niklas", "Tom", "Jan", "Moritz", "Erik", "Anton",
  "Emil", "Karl", "Simon", "Fabian", "Sebastian", "Florian", "Matthias", "Stefan", "Michael", "Thomas",
  "Andreas", "Christian", "Markus", "Peter", "Klaus", "Wolfgang", "Dieter", "Günther", "Rolf", "Uwe",
];

const FEMALE_FIRST_NAMES: string[] = [
  "Emma", "Mia", "Hannah", "Lena", "Lea", "Sofia", "Emilia", "Anna", "Marie", "Laura",
  "Sarah", "Julia", "Clara", "Johanna", "Lina", "Maja", "Ida", "Frieda", "Charlotte", "Amelie",
  "Katharina", "Nadine", "Sabine", "Petra", "Claudia", "Andrea", "Susanne", "Monika", "Ingrid", "Helga",
  "Renate", "Ursula", "Gisela", "Christine", "Birgit", "Karin", "Martina", "Angelika", "Brigitte", "Elke",
];

const LAST_NAMES: string[] = [
  "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
  "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann",
  "Braun", "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Krause", "Meier", "Lehmann",
  "Schmid", "Schulze", "Maier", "Köhler", "Herrmann", "König", "Walter", "Mayer", "Huber", "Kaiser",
  "Fuchs", "Peters", "Lang", "Scholz", "Möller", "Weiß", "Jung", "Hahn", "Schubert", "Vogel",
  "Friedrich", "Keller", "Günther", "Frank", "Berger", "Winkler", "Roth", "Beck", "Lorenz", "Albrecht",
];

/** ~30 real German cities used as patient birthplaces, paired with a real area code. */
const CITIES: { name: string; areaCode: string }[] = [
  { name: "Berlin", areaCode: "30" },
  { name: "Hamburg", areaCode: "40" },
  { name: "München", areaCode: "89" },
  { name: "Köln", areaCode: "221" },
  { name: "Frankfurt am Main", areaCode: "69" },
  { name: "Stuttgart", areaCode: "711" },
  { name: "Düsseldorf", areaCode: "211" },
  { name: "Dortmund", areaCode: "231" },
  { name: "Essen", areaCode: "201" },
  { name: "Leipzig", areaCode: "341" },
  { name: "Bremen", areaCode: "421" },
  { name: "Dresden", areaCode: "351" },
  { name: "Hannover", areaCode: "511" },
  { name: "Nürnberg", areaCode: "911" },
  { name: "Duisburg", areaCode: "203" },
  { name: "Bochum", areaCode: "234" },
  { name: "Wuppertal", areaCode: "202" },
  { name: "Bielefeld", areaCode: "521" },
  { name: "Bonn", areaCode: "228" },
  { name: "Münster", areaCode: "251" },
  { name: "Mannheim", areaCode: "621" },
  { name: "Karlsruhe", areaCode: "721" },
  { name: "Augsburg", areaCode: "821" },
  { name: "Wiesbaden", areaCode: "611" },
  { name: "Mönchengladbach", areaCode: "2161" },
  { name: "Braunschweig", areaCode: "531" },
  { name: "Kiel", areaCode: "431" },
  { name: "Chemnitz", areaCode: "371" },
  { name: "Magdeburg", areaCode: "391" },
  { name: "Freiburg im Breisgau", areaCode: "761" },
];

/** ~10 statutory ("gesetzlich") health insurance providers. */
const STATUTORY_PROVIDERS: string[] = [
  "Techniker Krankenkasse", "AOK Bayern", "AOK Baden-Württemberg", "Barmer", "DAK-Gesundheit",
  "IKK classic", "BKK VBU", "HEK Hanseatische Krankenkasse", "Knappschaft", "AOK Hessen",
];

/** ~6 private ("privat") health insurance providers. */
const PRIVATE_PROVIDERS: string[] = [
  "Debeka Krankenversicherung", "Allianz Private Krankenversicherung", "Signal Iduna Krankenversicherung",
  "Barmenia Krankenversicherung", "DKV Deutsche Krankenversicherung", "Axa Krankenversicherung",
];

/**
 * Employee positions with male/female wording and a relative weight (more
 * Pflegefachkraft than Chefarzt/-ärztin, matching real staffing ratios).
 * Weights sum to 20, so `i % 20` indexes into the flattened slot list below.
 */
const EMPLOYEE_POSITION_DEFS: { male: string; female: string; weight: number }[] = [
  { male: "Pflegefachkraft", female: "Pflegefachkraft", weight: 6 },
  { male: "Assistenzarzt", female: "Assistenzärztin", weight: 3 },
  { male: "Facharzt", female: "Fachärztin", weight: 3 },
  { male: "Oberarzt", female: "Oberärztin", weight: 2 },
  { male: "Chefarzt", female: "Chefärztin", weight: 1 },
  { male: "Stationsleitung", female: "Stationsleitung", weight: 1 },
  { male: "Pflegeleitung", female: "Pflegeleitung", weight: 1 },
  { male: "MTRA", female: "MTRA", weight: 1 },
  { male: "MTLA", female: "MTLA", weight: 1 },
  { male: "Physiotherapeut", female: "Physiotherapeutin", weight: 1 },
];

const EMPLOYEE_POSITION_SLOTS: { male: string; female: string }[] =
  EMPLOYEE_POSITION_DEFS.flatMap((def) =>
    Array.from({ length: def.weight }, () => ({
      male: def.male,
      female: def.female,
    })),
  );

/** 3 realistic appointment-type names per department, keyed by exact department name. */
const APPOINTMENT_TYPE_NAMES_BY_DEPARTMENT: Record<
  string,
  [string, string, string]
> = {
  "Kardiologie": ["Kardiologische Sprechstunde", "Herzultraschall", "Belastungs-EKG"],
  "Herzchirurgie": ["Herzchirurgische Sprechstunde", "Präoperative Planung Herz-OP", "Postoperative Nachsorge Herz-OP"],
  "Neurologie": ["Neurologische Erstvorstellung", "EEG-Diagnostik", "Kopfschmerzsprechstunde"],
  "Neurochirurgie": ["Neurochirurgische Sprechstunde", "Präoperative Planung Neurochirurgie", "Postoperative Nachsorge Neurochirurgie"],
  "Hämatologie und Onkologie": ["Onkologische Erstvorstellung", "Chemotherapie-Kontrolle", "Hämatologische Sprechstunde"],
  "Gastroenterologie": ["Gastroenterologische Sprechstunde", "Endoskopie-Vorgespräch", "Koloskopie-Nachsorge"],
  "Nephrologie": ["Nephrologische Sprechstunde", "Dialyse-Kontrolle", "Nierenfunktionsdiagnostik"],
  "Pneumologie": ["Pneumologische Sprechstunde", "Lungenfunktionsprüfung", "Schlafapnoe-Diagnostik"],
  "Endokrinologie und Diabetologie": ["Diabetes-Sprechstunde", "Schilddrüsendiagnostik", "Hormonstatus-Kontrolle"],
  "Rheumatologie und Klinische Immunologie": ["Rheumatologische Sprechstunde", "Immundiagnostik", "Gelenkultraschall"],
  "Allgemein- und Viszeralchirurgie": ["Chirurgische Sprechstunde", "Präoperative Planung Viszeralchirurgie", "Postoperative Nachsorge Viszeralchirurgie"],
  "Unfallchirurgie und Orthopädie": ["Orthopädische Untersuchung", "Gelenksprechstunde", "Frakturkontrolle"],
  "Gefäßchirurgie": ["Gefäßchirurgische Sprechstunde", "Gefäßultraschall (Doppler)", "Postoperative Nachsorge Gefäß-OP"],
  "Thoraxchirurgie": ["Thoraxchirurgische Sprechstunde", "Präoperative Planung Thorax-OP", "Postoperative Nachsorge Thorax-OP"],
  "Urologie": ["Urologische Sprechstunde", "Prostatadiagnostik", "Blasenspiegelung"],
  "Gynäkologie und Geburtshilfe": ["Gynäkologische Untersuchung", "Schwangerenvorsorge", "Ultraschall Gynäkologie"],
  "Kinder- und Jugendmedizin": ["Kinder-Vorsorge", "Impfberatung", "Kinderärztliche Sprechstunde"],
  "Kinderchirurgie": ["Kinderchirurgische Sprechstunde", "Präoperative Planung Kinderchirurgie", "Postoperative Nachsorge Kinderchirurgie"],
  "Dermatologie und Venerologie": ["Hautkrebs-Vorsorge", "Dermatologische Sprechstunde", "Allergiediagnostik"],
  "Hals-Nasen-Ohrenheilkunde": ["HNO-Sprechstunde", "Hörtest", "Nasennebenhöhlendiagnostik"],
  "Augenheilkunde": ["Augenärztliche Untersuchung", "Sehtest", "Glaukom-Vorsorge"],
  "Mund-, Kiefer- und Gesichtschirurgie": ["MKG-Sprechstunde", "Präoperative Planung MKG-OP", "Postoperative Nachsorge MKG-OP"],
  "Psychiatrie und Psychotherapie": ["Psychiatrische Erstvorstellung", "Psychotherapeutische Sprechstunde", "Medikamentöse Verlaufskontrolle"],
  "Psychosomatische Medizin": ["Psychosomatische Sprechstunde", "Entspannungstherapie-Beratung", "Verlaufsgespräch"],
  "Strahlentherapie": ["Strahlentherapie-Planung", "Bestrahlungssitzung", "Nachsorge Strahlentherapie"],
  "Radiologie": ["MRT-Untersuchung", "CT-Untersuchung", "Röntgen Thorax"],
  "Nuklearmedizin": ["Szintigraphie", "PET-CT-Untersuchung", "Schilddrüsenszintigraphie"],
  "Labormedizin": ["Laborbefundbesprechung", "Blutentnahme", "Mikrobiologische Diagnostik"],
  "Pathologie": ["Histopathologische Begutachtung", "Zytologische Untersuchung", "Obduktionsbesprechung"],
  "Transfusionsmedizin": ["Blutspende-Untersuchung", "Verträglichkeitstestung", "Eigenblutspende-Beratung"],
  "Anästhesiologie und Intensivmedizin": ["Prämedikationsgespräch", "Intensivmedizinische Visite", "Schmerztherapie-Sprechstunde"],
  "Zentrale Notaufnahme": ["Notfallsprechstunde", "Wundversorgung", "Akutdiagnostik"],
  "Geriatrie": ["Geriatrisches Assessment", "Sturzprävention-Beratung", "Demenzdiagnostik"],
  "Palliativmedizin": ["Palliativmedizinische Beratung", "Schmerztherapie Palliativ", "Angehörigengespräch"],
};

const VISIT_TIME_SLOTS: string[] = [
  "06:15", "07:30", "08:45", "09:15", "10:30", "11:45",
  "13:00", "14:15", "15:30", "16:45", "18:00", "19:15",
  "20:30", "21:45", "22:15",
];

const APPOINTMENT_TIME_SLOTS: string[] = [
  "08:00", "08:45", "09:30", "10:15", "11:00", "11:45",
  "13:00", "13:45", "14:30", "15:15", "16:00",
];

/** The 15 contiguous dates 2026-07-06 .. 2026-07-20 that appointments are scheduled across. */
const APPOINTMENT_DATES: string[] = Array.from(
  { length: 15 },
  (_, index) => `2026-07-${pad(6 + index, 2)}`,
);

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const lengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  return lengths[month - 1]!;
}

/**
 * Pure calendar-math date shift ("YYYY-MM-DD" + N days -> "YYYY-MM-DD").
 * Deliberately avoids the `Date` object entirely so it can never depend on
 * the host's clock or timezone.
 */
function addDays(dateStr: string, delta: number): string {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  let year = Number(yearStr);
  let month = Number(monthStr);
  let day = Number(dayStr) + delta;

  while (day < 1) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    day += daysInMonth(year, month);
  }
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * Generate the full deterministic "people + activity" seed: social security
 * numbers, patients, employees, patient visits (active inpatient/outpatient
 * + discharged history), appointment types, and appointments — plus the
 * reconciled `beds` array (see the handoff note above `generatePeople`).
 * Pure function of `structure`: same output every call, no DB, no
 * wall-clock, no `Math.random()`.
 */
export function generatePeople(structure: GeneratedStructure): GeneratedPeople {
  const rnd = mulberry32(7);

  // --- Social security numbers ---------------------------------------------
  const socialSecurityNumbers: SocialSecurityNumberSeed[] = [];
  for (let i = 0; i < PERSON_COUNT; i += 1) {
    const isStatutory = (i * 23 + 11) % 100 < 78;
    const provider = isStatutory
      ? STATUTORY_PROVIDERS[i % STATUTORY_PROVIDERS.length]!
      : PRIVATE_PROVIDERS[i % PRIVATE_PROVIDERS.length]!;

    socialSecurityNumbers.push({
      publicId: `ssn_Berlin${pad(i + 1, 6)}`,
      // Dash-free SSN number scheme (main hotfix): `DESV${100000 + i}`, e.g.
      // "DESV100001" — NO `-` or any other separator anywhere in `number`.
      number: `DESV${100000 + i + 1}`,
      healthInsuranceProvider: provider,
      insuranceType: isStatutory ? "STATUTORY" : "PRIVATE",
    });
  }

  // --- Patients (one per SSN) -----------------------------------------------
  const patients: PatientSeed[] = [];
  for (let i = 0; i < PERSON_COUNT; i += 1) {
    const sprinkle = i % 47;
    const gender: Gender =
      sprinkle === 45
        ? "NON_BINARY"
        : sprinkle === 46
          ? "UNKNOWN"
          : i % 2 === 0
            ? "MALE"
            : "FEMALE";
    const useFemalePool = i % 2 === 1;
    const firstName = useFemalePool
      ? FEMALE_FIRST_NAMES[(i * 17 + 9) % FEMALE_FIRST_NAMES.length]!
      : MALE_FIRST_NAMES[(i * 19 + 4) % MALE_FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[(i * 13 + 6) % LAST_NAMES.length]!;

    // Ages 0-98, deterministically spread; a 0-year-old must still have been
    // born on/before the REFERENCE_DATE "today".
    const age = i % 99;
    const birthYear = REFERENCE_YEAR - age;
    const birthMonth =
      age === 0
        ? 1 + ((i * 17 + 5) % REFERENCE_MONTH)
        : 1 + ((i * 17 + 5) % 12);
    const maxDay =
      age === 0 && birthMonth === REFERENCE_MONTH
        ? REFERENCE_DAY
        : daysInMonth(birthYear, birthMonth);
    const birthDay = 1 + ((i * 13 + 7) % maxDay);
    const birthDate = `${birthYear}-${pad(birthMonth, 2)}-${pad(birthDay, 2)}`;

    const city = CITIES[(i * 29 + 3) % CITIES.length]!;

    patients.push({
      publicId: `pat_Berlin${pad(i + 1, 6)}`,
      gender,
      firstName,
      lastName,
      birthDate,
      birthplace: city.name,
      socialSecurityNumberPublicId: socialSecurityNumbers[i]!.publicId,
      telephoneNumber: `+49${city.areaCode}${pad(1_000_000 + i, 7)}`,
      acceptedGdpr: true,
    });
  }

  // --- Employees -------------------------------------------------------------
  const employees: EmployeeSeed[] = [];
  for (let i = 0; i < EMPLOYEE_COUNT; i += 1) {
    const department = structure.departments[i % structure.departments.length]!;
    // Derive gender from the cycle index (floor(i / slots)) rather than i's
    // parity so it does not alias to `i % EMPLOYEE_POSITION_SLOTS.length`; that
    // aliasing pinned single-slot positions to one gender (no Chefärztin etc.).
    const isFemale =
      Math.floor(i / EMPLOYEE_POSITION_SLOTS.length) % 2 === 1;
    const firstName = isFemale
      ? FEMALE_FIRST_NAMES[(i * 11 + 5) % FEMALE_FIRST_NAMES.length]!
      : MALE_FIRST_NAMES[(i * 7 + 3) % MALE_FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[(i * 13 + 2) % LAST_NAMES.length]!;
    const positionSlot =
      EMPLOYEE_POSITION_SLOTS[i % EMPLOYEE_POSITION_SLOTS.length]!;

    employees.push({
      publicId: `emp_Berlin${pad(i + 1, 6)}`,
      firstName,
      lastName,
      position: isFemale ? positionSlot.female : positionSlot.male,
      departmentPublicId: department.publicId,
    });
  }

  // --- Appointment types (~3 per department) ----------------------------------
  const appointmentTypes: AppointmentTypeSeed[] = [];
  let appointmentTypeCounter = 0;
  structure.departments.forEach((department, departmentIndex) => {
    const names =
      APPOINTMENT_TYPE_NAMES_BY_DEPARTMENT[department.name] ??
      ([
        `${department.name} Erstvorstellung`,
        `${department.name} Kontrolltermin`,
        `${department.name} Diagnostik`,
      ] as [string, string, string]);

    names.forEach((name, slot) => {
      appointmentTypeCounter += 1;
      appointmentTypes.push({
        publicId: `aty_Berlin${pad(appointmentTypeCounter, 6)}`,
        name,
        departmentPublicId: department.publicId,
        defaultDurationMinutes:
          20 + ((departmentIndex * 7 + slot * 11) % 5) * 10,
      });
    });
  });

  // --- Bed reconciliation: pin the active-inpatient beds ----------------------
  // Take the first INPATIENT_ACTIVE_COUNT beds that Task 2 provisionally
  // marked OCCUPIED (falling back to any remaining bed, in order, if that
  // pool were ever smaller than the target — it isn't at current scale, but
  // this keeps the function correct if SEED_DEPARTMENTS/ward counts change).
  const provisionallyOccupied = structure.beds.filter(
    (bed) => bed.status === "OCCUPIED",
  );
  const pinnedBeds: BedSeed[] = provisionallyOccupied.slice(
    0,
    INPATIENT_ACTIVE_COUNT,
  );
  if (pinnedBeds.length < INPATIENT_ACTIVE_COUNT) {
    const pinnedSoFar = new Set(pinnedBeds.map((bed) => bed.publicId));
    for (const bed of structure.beds) {
      if (pinnedBeds.length >= INPATIENT_ACTIVE_COUNT) break;
      if (!pinnedSoFar.has(bed.publicId)) {
        pinnedBeds.push(bed);
        pinnedSoFar.add(bed.publicId);
      }
    }
  }
  if (pinnedBeds.length < INPATIENT_ACTIVE_COUNT) {
    throw new Error(
      `generatePeople: only ${structure.beds.length} beds available, cannot pin ${INPATIENT_ACTIVE_COUNT} active inpatient visits`,
    );
  }
  const pinnedBedPublicIds = new Set(pinnedBeds.map((bed) => bed.publicId));

  // Reconciled beds: pinned -> OCCUPIED; already FREE/RESERVED -> unchanged;
  // leftover provisionally-OCCUPIED-but-unpinned -> re-rolled FREE/RESERVED.
  const beds: BedSeed[] = structure.beds.map((bed) => {
    if (pinnedBedPublicIds.has(bed.publicId)) {
      return { ...bed, status: "OCCUPIED" as BedStatus };
    }
    if (bed.status !== "OCCUPIED") {
      return bed;
    }
    const status: BedStatus = rnd() < 0.3 ? "RESERVED" : "FREE";
    return { ...bed, status };
  });

  // --- Patient visits ----------------------------------------------------------
  const patientVisits: PatientVisitSeed[] = [];
  let globalVisitIndex = 0;
  const patientNumber = (index: number) => String(10_000 + index);

  for (let i = 0; i < INPATIENT_ACTIVE_COUNT; i += 1) {
    const bed = pinnedBeds[i]!;
    const patient = patients[globalVisitIndex % patients.length]!;
    const startedDate = addDays(REFERENCE_DATE, -(1 + (i % 60)));

    patientVisits.push({
      publicId: `pvi_Berlin${pad(globalVisitIndex + 1, 6)}`,
      patientNumber: patientNumber(globalVisitIndex),
      visitType: "INPATIENT",
      status: "ACTIVE",
      patientPublicId: patient.publicId,
      departmentPublicId: bed.departmentPublicId,
      stationPublicId: bed.stationPublicId,
      roomPublicId: bed.roomPublicId,
      bedPublicId: bed.publicId,
      startedDate,
      startedTime: VISIT_TIME_SLOTS[i % VISIT_TIME_SLOTS.length]!,
      endedDate: null,
      endedTime: null,
    });
    globalVisitIndex += 1;
  }

  for (let j = 0; j < OUTPATIENT_ACTIVE_COUNT; j += 1) {
    const patient = patients[globalVisitIndex % patients.length]!;
    const department =
      structure.departments[globalVisitIndex % structure.departments.length]!;
    const startedDate = addDays(REFERENCE_DATE, -(1 + (j % 14)));

    patientVisits.push({
      publicId: `pvi_Berlin${pad(globalVisitIndex + 1, 6)}`,
      patientNumber: patientNumber(globalVisitIndex),
      visitType: "OUTPATIENT",
      status: "ACTIVE",
      patientPublicId: patient.publicId,
      departmentPublicId: department.publicId,
      stationPublicId: null,
      roomPublicId: null,
      bedPublicId: null,
      startedDate,
      startedTime: VISIT_TIME_SLOTS[(j + 3) % VISIT_TIME_SLOTS.length]!,
      endedDate: null,
      endedTime: null,
    });
    globalVisitIndex += 1;
  }

  const activeVisitCount = INPATIENT_ACTIVE_COUNT + OUTPATIENT_ACTIVE_COUNT;
  for (let k = 0; k < DISCHARGED_VISIT_COUNT; k += 1) {
    const patient = patients[globalVisitIndex % patients.length]!;
    const isInpatient = k % 2 === 0;
    const startedDate = addDays(REFERENCE_DATE, -(30 + (k % 300)));
    const endedDate = addDays(startedDate, 1 + (k % 14));

    let departmentPublicId: string;
    let stationPublicId: string | null = null;
    let roomPublicId: string | null = null;
    let bedPublicId: string | null = null;

    if (isInpatient) {
      // Discharged history may reuse any bed (the active-only uniqueness
      // constraint on patientNumber doesn't apply, and by definition the
      // bed isn't occupied by this visit any more).
      const historyBed = structure.beds[k % structure.beds.length]!;
      departmentPublicId = historyBed.departmentPublicId;
      stationPublicId = historyBed.stationPublicId;
      roomPublicId = historyBed.roomPublicId;
      bedPublicId = historyBed.publicId;
    } else {
      departmentPublicId =
        structure.departments[
          globalVisitIndex % structure.departments.length
        ]!.publicId;
    }

    patientVisits.push({
      publicId: `pvi_Berlin${pad(globalVisitIndex + 1, 6)}`,
      // Reuses the active patient-number range; fine since the unique
      // constraint on patient_number only applies to ACTIVE visits.
      patientNumber: patientNumber(k % activeVisitCount),
      visitType: isInpatient ? "INPATIENT" : "OUTPATIENT",
      status: "DISCHARGED",
      patientPublicId: patient.publicId,
      departmentPublicId,
      stationPublicId,
      roomPublicId,
      bedPublicId,
      startedDate,
      startedTime: VISIT_TIME_SLOTS[k % VISIT_TIME_SLOTS.length]!,
      endedDate,
      endedTime: VISIT_TIME_SLOTS[(k + 2) % VISIT_TIME_SLOTS.length]!,
    });
    globalVisitIndex += 1;
  }

  // --- Appointments ------------------------------------------------------------
  // Uniqueness per (type, date, time) is guaranteed by construction: `i` is
  // decomposed into (comboIndex, offset) = (i % totalCombos, floor(i /
  // totalCombos)), a bijection onto distinct (type, date) x repeat-count
  // pairs. Within a fixed (type, date), each repeat gets a different
  // `timeIndex` (offset shifts it by +1 mod slot count each time), so the
  // full (type, date, time) triple is unique for every `i`.
  const appointments: AppointmentSeed[] = [];
  const totalCombos = appointmentTypes.length * APPOINTMENT_DATES.length;
  for (let i = 0; i < APPOINTMENT_COUNT; i += 1) {
    const comboIndex = i % totalCombos;
    const offset = Math.floor(i / totalCombos);
    const typeIndex = comboIndex % appointmentTypes.length;
    const dateIndex = Math.floor(comboIndex / appointmentTypes.length);
    const timeIndex =
      (typeIndex + dateIndex + offset) % APPOINTMENT_TIME_SLOTS.length;
    const patient = patients[i % patients.length]!;
    const appointmentType = appointmentTypes[typeIndex]!;

    appointments.push({
      publicId: `app_Berlin${pad(i + 1, 6)}`,
      scheduledDate: APPOINTMENT_DATES[dateIndex]!,
      scheduledTime: APPOINTMENT_TIME_SLOTS[timeIndex]!,
      patientPublicId: patient.publicId,
      appointmentTypePublicId: appointmentType.publicId,
    });
  }

  // --- Fixture: pat_Berlin000019 is an ambulatory outpatient -----------------
  // "Matthias Müller" (born 2008-12-25) is a normal patient who only books
  // appointments, so they must NOT be admitted: drop their active inpatient
  // visit (leaving no room, bed, station or department) and release the bed
  // they held back to FREE so it is not shown occupied without an occupant.
  // This is the ONLY hand-pinned record — every other patient, visit and bed
  // stays exactly as generated.
  const OUTPATIENT_FIXTURE_PATIENT = "pat_Berlin000019";
  const fixtureVisitIndex = patientVisits.findIndex(
    (visit) =>
      visit.patientPublicId === OUTPATIENT_FIXTURE_PATIENT &&
      visit.status === "ACTIVE",
  );
  if (fixtureVisitIndex !== -1) {
    const [releasedVisit] = patientVisits.splice(fixtureVisitIndex, 1);
    const releasedBedPublicId = releasedVisit?.bedPublicId;
    if (releasedBedPublicId) {
      const bedIndex = beds.findIndex(
        (bed) => bed.publicId === releasedBedPublicId,
      );
      if (bedIndex !== -1) {
        beds[bedIndex] = { ...beds[bedIndex]!, status: "FREE" as BedStatus };
      }
    }
  }

  return {
    socialSecurityNumbers,
    patients,
    employees,
    patientVisits,
    appointmentTypes,
    appointments,
    beds,
  };
}
