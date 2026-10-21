import * as Haptics from "expo-haptics";

/**
 * Non-blocking confirmation messages (rendered by components/ToastHost in the
 * root layout). Use instead of an Alert for "it worked" feedback; keep Alerts
 * for errors and decisions.
 */
export type ToastOptions = {
  message: string;
  /** Optional action button, e.g. "Undo" */
  actionLabel?: string;
  onAction?: () => void;
};

type ToastListener = (toast: ToastOptions) => void;

let listener: ToastListener | null = null;

export function showToast(toast: ToastOptions): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
  listener?.(toast);
}

/** Used by ToastHost only */
export function setToastListener(next: ToastListener | null): void {
  listener = next;
}
