import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BookWithStats } from "../../db/repos/books";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { FONTS, TYPE } from "../../themes/typography";
import { formatDuration, formatShortDate } from "../../utils/format";
import { computeBookProgress } from "../../utils/readingProgress";
import BookCover from "../ui/BookCover";
import ProgressRule from "../ui/ProgressRule";

/** One book in the Library: tap opens it, long-press for status and delete */
export default function LibraryRow({
  book,
  onPress,
  onLongPress,
}: {
  book: BookWithStats;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { t } = useTranslation();
  const reading = book.reading_status === "currently_reading";
  const { percentage } = computeBookProgress(book);

  const meta = reading
    ? [
        book.page > 0 ? t("today.percent", { percent: percentage }) : null,
        book.reading_time > 0 ? formatDuration(book.reading_time) : null,
      ]
    : book.reading_status === "read"
      ? [
          book.date_finished
            ? t("library.finishedOn", { date: formatShortDate(book.date_finished) })
            : t("library.read"),
        ]
      : [
          book.page === 1
            ? t("bookPage.pagesValueOne")
            : book.page > 0
              ? t("library.pages", { count: book.page })
              : null,
        ];
  const metaText = meta.filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityHint={t("library.rowHint")}
      accessibilityActions={[{ name: "longpress", label: t("library.rowMenu") }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "longpress") onLongPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <BookCover
        uri={book.cover_url}
        title={book.name}
        author={book.author}
        width={44}
      />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {book.name}
        </Text>
        {book.author ? (
          <Text style={styles.author} numberOfLines={1}>
            {book.author}
          </Text>
        ) : null}
        {metaText ? <Text style={styles.meta}>{metaText}</Text> : null}
        {reading && book.page > 0 && (
          <ProgressRule
            progress={percentage / 100}
            color={COLORS.ink.primary}
            style={styles.rule}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[4],
    paddingVertical: SPACING[3],
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    lineHeight: 23,
    color: COLORS.ink.primary,
  },
  author: {
    ...TYPE.meta,
    fontFamily: FONTS.serifItalic,
  },
  meta: {
    ...TYPE.meta,
    marginTop: 2,
  },
  rule: {
    marginTop: SPACING[2],
    maxWidth: 160,
  },
});
