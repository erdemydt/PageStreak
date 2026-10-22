import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { EnhancedBook } from "../db/db";
import { getBook } from "../db/repos/books";
import { SessionWithBook } from "../db/repos/sessions";
import { SPACING } from "../themes/spacing";
import { FONTS, TYPE } from "../themes/typography";
import { getTodayDateString } from "../utils/dateUtils";
import { getEnhancedBookProgress } from "../utils/readingProgress";
import SessionDatePicker from "./SessionDatePicker";
import {
  FieldGroup,
  MinutesField,
  NotesField,
  PagesField,
} from "./session/SessionFields";
import Button from "./ui/Button";
import Sheet from "./ui/Sheet";

/** Edit or delete one reading session (hosted by SessionSheetsProvider) */
interface EditSessionModalProps {
  visible: boolean;
  session: SessionWithBook | null;
  onClose: () => void;
  onSave: (
    sessionId: number,
    minutes: number,
    notes: string,
    pages: number | undefined,
    date: string,
  ) => void;
  onDelete: (sessionId: number) => void;
}

export default function EditSessionModal({
  visible,
  session,
  onClose,
  onSave,
  onDelete,
}: EditSessionModalProps) {
  const [minutes, setMinutes] = useState("");
  const [pages, setPages] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionDate, setSessionDate] = useState(getTodayDateString());
  const [loading, setLoading] = useState(false);
  const [bookData, setBookData] = useState<EnhancedBook | null>(null);
  const [remainingPages, setRemainingPages] = useState<number>(0);
  const { t } = useTranslation();

  useEffect(() => {
    const loadBookData = async () => {
      if (session) {
        try {
          setBookData(await getBook(session.book_id));
        } catch (error) {
          console.error("Error loading book data:", error);
        }
      }
    };

    if (session) {
      setMinutes(session.minutes_read.toString());
      setPages(session.pages_read ? session.pages_read.toString() : "");
      setNotes(session.notes || "");
      setSessionDate(session.date);
      loadBookData();
    } else {
      setMinutes("");
      setPages("");
      setNotes("");
      setBookData(null);
    }
    // Also re-run on each open: Cancel keeps the same session object, and
    // its unsaved edits (incl. the date) must not survive a reopen
  }, [session, visible]);

  const calculateRemainingPages = async () => {
    if (!bookData || !session) {
      setRemainingPages(0);
      return;
    }

    try {
      const progress = await getEnhancedBookProgress(
        bookData.id,
        bookData.page,
        bookData.current_page || 0,
      );
      const remaining = bookData.page - progress.pagesRead;
      // Add back the pages from the current session being edited, since we can modify them
      const sessionPages = session.pages_read || 0;
      setRemainingPages(Math.max(0, remaining + sessionPages));
    } catch (error) {
      console.error("Error calculating remaining pages:", error);
      const sessionPages = session.pages_read || 0;
      setRemainingPages(
        bookData.page - (bookData.current_page || 0) + sessionPages,
      );
    }
  };

  useEffect(() => {
    if (bookData) {
      calculateRemainingPages();
    }
  }, [bookData]);

  const handleSave = async () => {
    if (
      !session ||
      !minutes.trim() ||
      isNaN(Number(minutes)) ||
      Number(minutes) <= 0
    ) {
      Alert.alert(
        t("components.readingLogsEditModal.invalidInput"),
        t("components.readingLogsEditModal.enterValidMinutes"),
      );
      return;
    }

    // Validate pages if provided
    if (pages.trim() && (isNaN(Number(pages)) || Number(pages) <= 0)) {
      Alert.alert(
        t("components.readingLogsEditModal.invalidInput"),
        t("components.readingTimeLogger.enterValidPages"),
      );
      return;
    }

    // Validate pages don't exceed remaining pages
    if (pages.trim() && Number(pages) > remainingPages) {
      Alert.alert(
        t("components.readingTimeLogger.tooManyPages"),
        t("components.readingTimeLogger.tooManyPagesMessage", {
          pages: Number(pages),
          remaining: remainingPages,
          bookName: bookData?.name || session.book_name,
        }),
      );
      return;
    }

    setLoading(true);
    try {
      const pagesValue = pages.trim() ? Number(pages) : undefined;
      await onSave(
        session.id,
        Number(minutes),
        notes.trim(),
        pagesValue,
        sessionDate,
      );
      onClose();
    } catch {
      Alert.alert(
        t("components.readingLogsEditModal.updateError"),
        t("components.readingLogsEditModal.updateErrorMessage"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!session) return;

    Alert.alert(
      t("components.readingLogsEditModal.deleteConfirmTitle"),
      t("components.readingLogsEditModal.deleteConfirmMessage"),
      [
        {
          text: t("components.readingLogsEditModal.deleteConfirmCancel"),
          style: "cancel",
        },
        {
          text: t("components.readingLogsEditModal.deleteConfirmDelete"),
          style: "destructive",
          onPress: () => {
            onDelete(session.id);
            onClose();
          },
        },
      ],
    );
  };

  const scrollRef = useRef<ScrollView>(null);

  if (!session) return null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t("components.readingLogsEditModal.title")}
      dismissible={!loading}
      scrollRef={scrollRef}
      footer={
        <>
          <Button
            title={t("components.readingLogsEditModal.deleteSession")}
            variant="destructive"
            onPress={handleDelete}
            disabled={loading}
          />
          <Button
            title={t("components.readingLogsEditModal.save")}
            onPress={handleSave}
            loading={loading}
            grow
          />
        </>
      }
    >
      <View style={styles.book}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {session.book_name}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>
          {session.book_author}
        </Text>
      </View>

      <FieldGroup label={t("components.sessionDate.title")}>
        <SessionDatePicker value={sessionDate} onChange={setSessionDate} />
      </FieldGroup>

      <MinutesField value={minutes} onChange={setMinutes} />

      <PagesField
        value={pages}
        onChange={setPages}
        remaining={remainingPages}
        enabled={!!bookData && remainingPages > 0}
        disabledHint={
          bookData
            ? t("components.readingTimeLogger.noPagesToLog")
            : t("components.readingTimeLogger.selectBookFirst")
        }
        total={bookData?.page}
      />

      <NotesField
        value={notes}
        onChange={setNotes}
        label={t("components.readingLogsEditModal.notesLabel")}
        placeholder={t("components.readingLogsEditModal.notesPlaceholder")}
        onFocus={() =>
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250)
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  book: {
    gap: 2,
    paddingBottom: SPACING[4],
  },
  bookTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 28,
    color: TYPE.headline.color,
  },
  bookAuthor: TYPE.byline,
});
