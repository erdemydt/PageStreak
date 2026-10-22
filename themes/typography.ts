import { COLORS } from "./colors";

// Font family names as registered by app/_layout.tsx (useFonts). Custom fonts on iOS
// pick their weight from the family, so styles set fontFamily and never fontWeight.
export const FONTS = {
  serif: "Newsreader_400Regular",
  serifItalic: "Newsreader_400Regular_Italic",
  serifMedium: "Newsreader_500Medium",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemiBold: "Inter_600SemiBold",
};

export const TYPE = {
  // Folio scale: serif for headings and numbers, sans for UI text
  display: {
    fontFamily: FONTS.serif,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.3,
    color: COLORS.ink.primary,
  },
  numeral: {
    fontFamily: FONTS.serif,
    fontSize: 60,
    lineHeight: 64,
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums" as const],
    color: COLORS.ink.primary,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.ink.primary,
  },
  headline: {
    fontFamily: FONTS.serif,
    fontSize: 21,
    lineHeight: 27,
    color: COLORS.ink.primary,
  },
  byline: {
    fontFamily: FONTS.serifItalic,
    fontSize: 17,
    lineHeight: 23,
    color: COLORS.ink.secondary,
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.ink.secondary,
  },
  bodyStrong: {
    fontFamily: FONTS.sansMedium,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.ink.primary,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.ink.primary,
  },
  meta: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.ink.tertiary,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    // Uppercase the text with toAppUpperCase (textTransform isn't locale-aware)
    color: COLORS.ink.secondary,
  },

  // Legacy names, used by screens not yet rebuilt in Folio
  pageTitle: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    lineHeight: 38,
    color: COLORS.ink.primary,
  },
  sectionTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.ink.primary,
  },
  cardTitle: {
    fontFamily: FONTS.serifMedium,
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.ink.primary,
  },
};
