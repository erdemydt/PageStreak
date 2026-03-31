import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

type AnimationCallback = () => void;

type UseModalAnimationOptions = {
  visible: boolean;
  animationDuration?: number;
  initialScale?: number;
};

export const useModalAnimation = ({
  visible,
  animationDuration = 220,
  initialScale = 0.96,
}: UseModalAnimationOptions) => {
  const [shouldRender, setShouldRender] = useState(visible);

  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const scaleAnim = useRef(
    new Animated.Value(visible ? 1 : initialScale),
  ).current;

  const animateOpen = useCallback(
    (onComplete?: AnimationCallback) => {
      setShouldRender(true);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animationDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: animationDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onComplete?.();
      });
    },
    [animationDuration, fadeAnim, scaleAnim],
  );

  const animateClose = useCallback(
    (onComplete?: AnimationCallback) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: animationDuration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: initialScale,
          duration: animationDuration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }

        onComplete?.();
      });
    },
    [animationDuration, fadeAnim, initialScale, scaleAnim],
  );

  useEffect(() => {
    if (visible) {
      animateOpen();
      return;
    }

    if (shouldRender) {
      animateClose();
    }
  }, [animateClose, animateOpen, shouldRender, visible]);

  return {
    shouldRender,
    backdropAnimatedStyle: {
      opacity: fadeAnim,
    },
    contentAnimatedStyle: {
      opacity: fadeAnim,
      transform: [{ scale: scaleAnim }],
    },
    animateOpen,
    animateClose,
  };
};
