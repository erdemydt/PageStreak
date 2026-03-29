import { COLORS } from "./colors";

export const TYPE = {
  pageTitle: {
    fontSize: 32,
    fontWeight: "600" as const,
    color: COLORS.text.primary,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "600" as const,
    color: COLORS.text.primary,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: COLORS.text.primary,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: COLORS.text.secondary,
  },
  meta: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: COLORS.text.tertiary,
  },
};
