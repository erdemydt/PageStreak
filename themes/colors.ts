// Folio: the PageStreak design language (paper, ink, forest green, marigold for streaks).
// FOLIO holds the palette by role; dark mode will add a second palette with the same keys.
// New code uses the role tokens (paper, ink, line, accent, streak); the legacy keys below
// are mapped onto the Folio palette until every screen has moved over.
const FOLIO = {
  paper: "#F5F1E8",
  paperRaised: "#FBF8F1",
  paperSunken: "#EDE7DA",
  ink: "#1B1A17",
  inkSecondary: "#5F594F",
  // AA (4.5:1) on paper and paperRaised
  inkTertiary: "#6B645A",
  inkDisabled: "#A39B8D",
  hairline: "#E2D9C8",
  hairlineStrong: "#CFC5B1",
  forest: "#1F5A3D",
  forestPressed: "#163F2B",
  forestSoft: "#E4ECE3",
  marigold: "#D9A441",
  marigoldInk: "#9A6B12",
  marigoldSoft: "#F6EBD3",
  clay: "#B23A24",
  claySoft: "#F7E3DC",
};

export const COLORS = {
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",

  // Role tokens (use these in new code)
  paper: {
    base: FOLIO.paper,
    raised: FOLIO.paperRaised,
    sunken: FOLIO.paperSunken,
  },
  ink: {
    primary: FOLIO.ink,
    secondary: FOLIO.inkSecondary,
    tertiary: FOLIO.inkTertiary,
    disabled: FOLIO.inkDisabled,
    // Text on an ink or forest fill
    onFill: FOLIO.paper,
  },
  line: {
    hairline: FOLIO.hairline,
    strong: FOLIO.hairlineStrong,
  },
  streak: {
    fill: FOLIO.marigold,
    ink: FOLIO.marigoldInk,
    soft: FOLIO.marigoldSoft,
  },
  destructive: {
    ink: FOLIO.clay,
    soft: FOLIO.claySoft,
  },
  // Book spines and drawn covers (when a book has no cover image)
  cover: {
    spines: ["#1F5A3D", "#2C4A52", "#9A6B12", "#7A2E22", "#3E5C3A", "#4A3B5C", "#1B1A17"],
    ink: "#EFE6D2",
    crease: "rgba(255, 255, 255, 0.2)",
  },

  // Legacy brand tokens (mapped onto Folio)
  primary: FOLIO.forest,
  primaryDark: FOLIO.forestPressed,
  success: "#3F7A55",
  warning: "#B07A22",
  info: "#A0573A",
  danger: FOLIO.clay,
  dangerLight: FOLIO.claySoft,
  neutral: {
    50: FOLIO.paper,
    100: FOLIO.paperSunken,
    200: FOLIO.hairline,
    300: FOLIO.hairlineStrong,
    400: "#8A8276",
    500: FOLIO.inkSecondary,
    700: "#3A352E",
    800: FOLIO.ink,
  },

  surface: {
    page: FOLIO.paper,
    raised: FOLIO.paperRaised,
    muted: FOLIO.paperSunken,
    interactive: FOLIO.forestSoft,
  },
  text: {
    primary: FOLIO.ink,
    secondary: FOLIO.inkSecondary,
    tertiary: FOLIO.inkTertiary,
    inverse: "#FFFFFF",
  },
  accent: {
    primary: FOLIO.forest,
    soft: FOLIO.forestSoft,
    strong: FOLIO.forestPressed,
  },

  overlay: "rgba(27, 26, 23, 0.45)",
  status: {
    currently_reading: "#2C5E4E",
    read: "#3A6E4A",
    // AA (4.5:1) with white badge text
    want_to_read: "#8F621F",
    unknown: FOLIO.inkSecondary,
  },
  state: {
    infoSoft: "#F3E5DC",
    infoStrong: "#8A4C2D",
    successSoft: "#E8F0E6",
    cardAccent: FOLIO.paperSunken,
    primarySoft: FOLIO.forestSoft,
    primarySoftAlt: "#EEF2EB",
    warningSoft: FOLIO.marigoldSoft,
    warningBorder: "#E3C995",
    warningText: "#7F5A1E",
    dangerSoft: FOLIO.claySoft,
    dangerBorder: "#E3B5A8",
    dangerText: "#962F1C",
    dangerStrong: "#C2472F",
    successBorder: "#BFD8C3",
    successText: "#2D6B44",
    infoBorder: "#B9D6CF",
    accentCyan: "#2C6B6A",
    accentCyanDark: "#245857",
    accentRose: "#A2566E",
    readingHeat1: "#E1E8DE",
    readingHeat2: "#C6D6C6",
    readingHeat3: "#9DB9A3",
    readingHeat4: "#5E8A6E",
    readingHeat5: FOLIO.forest,
    progressLow: "#8BA691",
    progressBase: FOLIO.hairline,
  },
};
