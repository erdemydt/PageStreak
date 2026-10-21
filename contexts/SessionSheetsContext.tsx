import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import EditSessionModal from "../components/EditSessionModal";
import ReadingTimeLogger from "../components/ReadingTimeLogger";
import {
  deleteSession,
  restoreSession,
  SessionWithBook,
  updateSession,
} from "../db/repos/sessions";
import { showToast } from "../utils/toast";

export type LoggerOptions = {
  /** Preselect this book (only if it's currently being read) */
  bookId?: number;
  /** YYYY-MM-DD; defaults to today */
  date?: string;
  /** Prefill, e.g. from the reading timer */
  minutes?: number;
  /** After a session is saved (screens refresh through data events anyway) */
  onSuccess?: () => void;
  /** After the sheet closes, saved or not */
  onClose?: () => void;
};

type SessionSheets = {
  openLogger: (options?: LoggerOptions) => void;
  editSession: (session: SessionWithBook) => void;
};

const SessionSheetsContext = createContext<SessionSheets | null>(null);

/**
 * Hosts the two session sheets once, at the root, so any screen can log a
 * session (Today, a book's page, History) or edit one without mounting its
 * own copy of the form.
 */
export function SessionSheetsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [loggerOptions, setLoggerOptions] = useState<LoggerOptions>({});
  const [loggerVisible, setLoggerVisible] = useState(false);
  const [editing, setEditing] = useState<SessionWithBook | null>(null);
  const [editVisible, setEditVisible] = useState(false);

  const openLogger = useCallback((options: LoggerOptions = {}) => {
    setLoggerOptions(options);
    setLoggerVisible(true);
  }, []);

  const editSession = useCallback((session: SessionWithBook) => {
    setEditing(session);
    setEditVisible(true);
  }, []);

  const closeLogger = () => {
    setLoggerVisible(false);
    loggerOptions.onClose?.();
  };

  const handleUpdate = async (
    sessionId: number,
    minutes: number,
    notes: string,
    pages: number | undefined,
    date: string,
  ) => {
    // Errors propagate: the sheet stays open and shows its own alert
    await updateSession(sessionId, { minutes, notes, pages, date });
    showToast({
      message: t("components.readingLogsEditModal.updateSuccessMessage"),
    });
  };

  const handleDelete = async (sessionId: number) => {
    try {
      const deleted = await deleteSession(sessionId);
      showToast({
        message: t("components.readingLogsEditModal.deleteSuccessMessage"),
        actionLabel: t("components.readingLogsEditModal.undo"),
        onAction: () => {
          restoreSession(deleted).catch((error) =>
            console.error("Error restoring session:", error),
          );
        },
      });
    } catch (error) {
      console.error("Error deleting session:", error);
      Alert.alert(
        t("components.readingLogsEditModal.deleteError"),
        t("components.readingLogsEditModal.deleteErrorMessage"),
      );
    }
  };

  const value = useMemo(
    () => ({ openLogger, editSession }),
    [openLogger, editSession],
  );

  return (
    <SessionSheetsContext.Provider value={value}>
      {children}
      <ReadingTimeLogger
        visible={loggerVisible}
        onClose={closeLogger}
        onSuccess={loggerOptions.onSuccess}
        initialBookId={loggerOptions.bookId}
        initialDate={loggerOptions.date}
        initialMinutes={loggerOptions.minutes}
      />
      <EditSessionModal
        visible={editVisible}
        session={editing}
        onClose={() => setEditVisible(false)}
        onSave={handleUpdate}
        onDelete={handleDelete}
      />
    </SessionSheetsContext.Provider>
  );
}

export function useSessionSheets(): SessionSheets {
  const sheets = useContext(SessionSheetsContext);
  if (!sheets) {
    throw new Error("useSessionSheets must be used inside SessionSheetsProvider");
  }
  return sheets;
}
