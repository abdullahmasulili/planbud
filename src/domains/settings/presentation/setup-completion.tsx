import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { launchOperation } from '@/shared/presentation/operation-launcher';
import { PhosphorIcon } from '@/shared/presentation/phosphor-icon';

/** Marks the final step with a single flight, bounce, spin and check reveal.
 * @returns A decorative completion mark; reduced motion or a failed preference read shows it immediately.
 */
export const SetupCompletion = () => {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const [motion] = useState(() => ({
    lift: new Animated.Value(height),
    spin: new Animated.Value(0),
    reveal: new Animated.Value(0),
  }));
  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    let preferenceChanged = false;
    /** Stops an in-flight sequence and applies the final accessible resting state. */
    const finish = () => {
      animation?.stop();
      motion.lift.setValue(0);
      motion.spin.setValue(1);
      motion.reveal.setValue(1);
    };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
      if (reduced) {
        preferenceChanged = true;
        finish();
      }
    });
    const cancel = launchOperation(async (isActive) => {
      const reduced = await AccessibilityInfo.isReduceMotionEnabled();
      if (!isActive() || preferenceChanged) return;
      if (reduced) {
        finish();
        return;
      }
      animation = Animated.sequence([
        Animated.timing(motion.lift, {
          toValue: -16,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(motion.lift, {
          toValue: 0,
          speed: 18,
          bounciness: 7,
          useNativeDriver: true,
        }),
        Animated.timing(motion.spin, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(motion.reveal, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]);
      animation.start();
    }, finish);
    return () => {
      cancel();
      animation?.stop();
      subscription.remove();
    };
  }, [motion]);
  return (
    <Animated.View
      testID="setup-completion"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          backgroundColor: theme.colors.primaryContainer,
          transform: [
            { translateY: motion.lift },
            {
              rotate: motion.spin.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.ring,
          {
            borderColor: theme.colors.primary,
            borderTopColor: 'transparent',
            opacity: motion.reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          },
        ]}
      />
      <Animated.View
        style={{
          opacity: motion.reveal,
          transform: [
            { scale: motion.reveal.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
          ],
        }}
      >
        <PhosphorIcon
          name="check"
          size={56}
          color={theme.colors.onPrimaryContainer}
          allowFontScaling={false}
        />
      </Animated.View>
    </Animated.View>
  );
};
const styles = StyleSheet.create({
  mark: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: { borderWidth: 3, borderRadius: 56 },
});
