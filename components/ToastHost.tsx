import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { COLORS } from "../themes/colors";
import { setToastListener, ToastOptions } from "../utils/toast";

const VISIBLE_MS = 3000;
const VISIBLE_WITH_ACTION_MS = 5000;

/** Renders the toast shown via showToast(); mount once in the root layout */
export default function ToastHost() {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setToastListener((next) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast(next);
      // iOS has no live regions: announce explicitly (Alerts used to be read out)
      AccessibilityInfo.announceForAccessibility(next.message);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      hideTimer.current = setTimeout(
        hide,
        next.actionLabel ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS,
      );
    });
    return () => {
      setToastListener(null);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hide = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  };

  if (!toast) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={3}>
        {toast.message}
      </Text>
      {toast.actionLabel && (
        <TouchableOpacity
          onPress={() => {
            // The toast stays tappable while fading out: drop the action first
            // so a double tap can't run it twice (e.g. restore a session twice)
            const action = toast.onAction;
            setToast(
              (current) =>
                current && {
                  ...current,
                  actionLabel: undefined,
                  onAction: undefined,
                },
            );
            if (hideTimer.current) clearTimeout(hideTimer.current);
            hide();
            action?.();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
        >
          <Text style={styles.action}>{toast.actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    // Above the tab bar
    bottom: 110,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.neutral[800],
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  message: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    color: COLORS.accent.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});
