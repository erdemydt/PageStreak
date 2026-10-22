import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { EnhancedBook } from "../../db/db";
import {
  BookWithStats,
  getBook,
  listBooksWithStats,
  updateBookStatus,
} from "../../db/repos/books";
import { getUserPreferences } from "../../db/repos/preferences";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { FONTS, TYPE } from "../../themes/typography";
import { parseDbDate } from "../../utils/dateUtils";
import { showToast } from "../../utils/toast";
import BookCover from "../ui/BookCover";
import Button from "../ui/Button";
import Eyebrow from "../ui/Eyebrow";
import Sheet from "../ui/Sheet";

type FinishInfo = {
  book: EnhancedBook;
  year: number;
  /** Books finished this calendar year, this one included */
  countThisYear: number;
  yearlyGoal: number;
  next: BookWithStats | null;
};

/** The moment a book is finished: where it lands in the year, and what's next */
export default function FinishSheet({
  bookId,
  visible,
  onClose,
}: {
  bookId: number | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<FinishInfo | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!visible || bookId === null) return;
    let cancelled = false;
    setInfo(null); // never flash the previous book's summary
    (async () => {
      try {
        const year = new Date().getFullYear();
        const [book, read, prefs, wantToRead] = await Promise.all([
          getBook(bookId),
          listBooksWithStats({ status: "read" }),
          getUserPreferences(),
          listBooksWithStats({ status: "want_to_read", order: "recent", limit: 1 }),
        ]);
        if (cancelled) return;
        if (!book) {
          onClose();
          return;
        }
        setInfo({
          book,
          year,
          countThisYear: read.filter(
            (b) => parseDbDate(b.date_finished)?.getFullYear() === year,
          ).length,
          yearlyGoal: prefs?.yearly_book_goal || 0,
          next: wantToRead[0] ?? null,
        });
      } catch (error) {
        console.error("Error loading the finish summary:", error);
        // Nothing to show: release the sheet so the next finish can open it
        if (!cancelled) onClose();
      }
    })();
    return () => {
      cancelled = true;
    };
    // onClose is a fresh closure each render; reload only on open/book change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, bookId]);

  const startNext = async () => {
    if (!info?.next) return;
    setStarting(true);
    try {
      await updateBookStatus(info.next.id, "currently_reading");
      onClose();
      showToast({ message: t("finish.started", { title: info.next.name }) });
    } catch (error) {
      console.error("Error starting the next book:", error);
      Alert.alert(t("error"), t("booksPage.alert.failedUpdate"));
    } finally {
      setStarting(false);
    }
  };

  const summary = !info
    ? ""
    : info.yearlyGoal <= 0
      ? t("finish.thisYear", { count: info.countThisYear, year: info.year })
      : t(
          info.countThisYear === info.yearlyGoal
            ? "finish.goalReached"
            : info.countThisYear > info.yearlyGoal
              ? "finish.pastGoal"
              : "finish.ofGoal",
          { count: info.countThisYear, goal: info.yearlyGoal, year: info.year },
        );

  return (
    <Sheet
      visible={visible && info?.book.id === bookId}
      onClose={onClose}
      dismissible={!starting}
      closeButton={false}
      footer={
        info?.next ? (
          <>
            <Button
              title={t("finish.notNow")}
              variant="secondary"
              onPress={onClose}
              disabled={starting}
            />
            <Button
              title={t("finish.startNext")}
              onPress={startNext}
              loading={starting}
              grow
            />
          </>
        ) : (
          <Button title={t("finish.done")} onPress={onClose} grow />
        )
      }
    >
      {info && (
        <View style={styles.content}>
          <BookCover
            uri={info.book.cover_url}
            title={info.book.name}
            author={info.book.author}
            width={96}
          />
          <Eyebrow color={COLORS.accent.primary}>{t("finish.eyebrow")}</Eyebrow>
          <Text style={styles.title} accessibilityRole="header">
            {info.book.name}
          </Text>
          <Text style={styles.summary}>{summary}</Text>

          {info.next && (
            <View style={styles.next}>
              <Eyebrow>{t("finish.upNext")}</Eyebrow>
              <View style={styles.nextRow}>
                <BookCover
                  uri={info.next.cover_url}
                  title={info.next.name}
                  width={40}
                />
                <View style={styles.nextText}>
                  <Text style={styles.nextTitle} numberOfLines={2}>
                    {info.next.name}
                  </Text>
                  <Text style={styles.nextAuthor} numberOfLines={1}>
                    {info.next.author}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    gap: SPACING[2],
    paddingTop: SPACING[2],
  },
  title: {
    ...TYPE.title,
    textAlign: "center",
    marginTop: SPACING[1],
  },
  summary: {
    ...TYPE.byline,
    textAlign: "center",
  },
  next: {
    alignSelf: "stretch",
    gap: SPACING[3],
    marginTop: SPACING[5],
    paddingTop: SPACING[4],
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
  },
  nextText: {
    flex: 1,
    gap: 2,
  },
  nextTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    lineHeight: 23,
    color: COLORS.ink.primary,
  },
  nextAuthor: {
    ...TYPE.meta,
    fontFamily: FONTS.serifItalic,
  },
});
