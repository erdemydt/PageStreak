import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../themes/colors";
import { RADIUS, SPACING } from "../../themes/spacing";
import { TYPE } from "../../themes/typography";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Pinned below the scrolling content (e.g. Cancel / Save) */
  footer?: ReactNode;
  /** false while saving: the backdrop, drag and back button do nothing */
  dismissible?: boolean;
  /** Wrap the content in a ScrollView (default true) */
  scroll?: boolean;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DRAG_CLOSE_DISTANCE = 120;

/**
 * The one bottom sheet. It owns its slide/fade animation; parents only toggle
 * `visible`. It stays mounted until the close animation finishes. Drag the
 * handle down, tap the backdrop or use the back button to close.
 */
export default function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  scroll = true,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Read through refs so the pan responder (created once) sees current props
  const latest = useRef({ onClose, dismissible });
  latest.current = { onClose, dismissible };

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 26,
          stiffness: 260,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, backdrop, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          latest.current.dismissible && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          translateY.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > DRAG_CLOSE_DISTANCE || g.vy > 1.2) {
            latest.current.onClose();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              damping: 26,
              stiffness: 260,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [translateY],
  );

  const requestClose = () => {
    if (dismissible) onClose();
  };

  return (
    <Modal
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.close")}
        />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardArea}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.panel,
            {
              maxHeight: SCREEN_HEIGHT - insets.top - SPACING[5],
              paddingBottom: Math.max(insets.bottom, SPACING[4]),
              transform: [{ translateY }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
            {title ? (
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
            ) : null}
          </View>
          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.content}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  keyboardArea: {
    flex: 1,
    justifyContent: "flex-end",
  },
  panel: {
    backgroundColor: COLORS.paper.base,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    shadowColor: COLORS.ink.primary,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 16,
  },
  handleArea: {
    paddingTop: SPACING[2],
    paddingBottom: SPACING[3],
    paddingHorizontal: SPACING[5],
    alignItems: "center",
    gap: SPACING[3],
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.line.strong,
  },
  title: {
    ...TYPE.headline,
    alignSelf: "flex-start",
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: SPACING[5],
    paddingBottom: SPACING[4],
  },
  footer: {
    flexDirection: "row",
    gap: SPACING[3],
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[3],
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.line.hairline,
  },
});
