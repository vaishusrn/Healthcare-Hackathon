import type { BedStatus } from "./api/types";

export const STATUS_COLOR: Record<BedStatus, string> = {
  FREE: "#10b981",
  RESERVED: "#f59e0b",
  OCCUPIED: "#f43f5e",
};
