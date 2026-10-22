import { COLORS } from "../themes/colors";

export type { ReadingStatus } from "../types/models";

export function getStatusColor(status?: string): string {
  if (status === "currently_reading") return COLORS.status.currently_reading;
  if (status === "read") return COLORS.status.read;
  if (status === "want_to_read") return COLORS.status.want_to_read;
  return COLORS.status.unknown;
}
