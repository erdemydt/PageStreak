import { TFunction } from "i18next";
import { COLORS } from "../themes/colors";

export type ReadingStatus = "want_to_read" | "currently_reading" | "read";

export function getStatusColor(status?: string): string {
  if (status === "currently_reading") return COLORS.status.currently_reading;
  if (status === "read") return COLORS.status.read;
  if (status === "want_to_read") return COLORS.status.want_to_read;
  return COLORS.status.unknown;
}

export function getStatusText(t: TFunction, status?: string): string {
  if (status === "currently_reading")
    return t("components.bookCard.currentlyReading");
  if (status === "read") return t("components.bookCard.read");
  if (status === "want_to_read") return t("components.bookCard.wantToRead");
  return t("components.bookCard.unknown");
}
