import { ReactNode } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { COLORS } from "../../themes/colors";

type ModalShellProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  animationDuration?: number;
};

export default function ModalShell({
  visible,
  onClose,
  children,
  animationDuration = 220,
}: ModalShellProps) {
  const { shouldRender, backdropAnimatedStyle, contentAnimatedStyle } =
    useModalAnimation({
      visible,
      animationDuration,
    });

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={shouldRender}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            pointerEvents="none"
            style={[styles.backdrop, backdropAnimatedStyle]}
          />
        </Pressable>

        <Animated.View style={[styles.sheet, contentAnimatedStyle]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  sheet: {
    width: "100%",
    height: "94%",
    backgroundColor: COLORS.surface.raised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
});
