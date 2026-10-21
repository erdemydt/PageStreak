import i18n from "../i18n";

/**
 * Genres are stored as stable keys (e.g. "sciFi") in
 * user_preferences.preferred_genres (comma-separated) and translated only for
 * display. Older versions stored labels: English names from Profile, or the
 * label in whatever language onboarding ran in. normalizeGenre maps those
 * back to keys, so existing data keeps working after a language switch.
 */
export const GENRE_KEYS = [
  "fiction",
  "nonFiction",
  "mystery",
  "romance",
  "sciFi",
  "fantasy",
  "biography",
  "history",
  "selfHelp",
  "business",
  "poetry",
  "philosophy",
  "thriller",
  "horror",
  "adventure",
  "comedy",
  "drama",
  "educational",
] as const;

const SUPPORTED_LANGUAGES = ["en", "tr"];

const isGenreKey = (value: string): boolean =>
  (GENRE_KEYS as readonly string[]).includes(value);

/** A stored value (key or legacy label in any app language) -> its key; unknown values pass through */
export function normalizeGenre(value: string): string {
  const trimmed = value.trim();
  if (isGenreKey(trimmed)) return trimmed;
  for (const lng of SUPPORTED_LANGUAGES) {
    const key = GENRE_KEYS.find(
      (genre) => i18n.t(`intro.genres.options.${genre}`, { lng }) === trimmed,
    );
    if (key) return key;
  }
  return trimmed;
}

/** Parse the stored comma-separated list into unique, normalized keys */
export function parseGenres(stored?: string | null): string[] {
  if (!stored) return [];
  const keys = stored
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean)
    .map(normalizeGenre);
  return [...new Set(keys)];
}

/** Display label in the current app language */
export function genreLabel(value: string): string {
  return isGenreKey(value) ? i18n.t(`intro.genres.options.${value}`) : value;
}
