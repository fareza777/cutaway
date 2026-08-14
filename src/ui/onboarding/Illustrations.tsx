/**
 * The onboarding artwork.
 *
 * Drawn from Views rather than shipped as images, for the same reason the
 * textures are: it costs nothing in the APK, it re-colours with the theme and
 * the accent for free, and it cannot go stale against a UI it is describing.
 * Each one shows the actual gesture or tool it is teaching.
 */

import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { useColors } from '@/state/settings';
import { alpha, radius } from '../theme';

const SIZE = 220;

function useLoop(duration: number, delay = 0) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, duration, progress]);
  return progress;
}

/** A slab that turns, for "drag to rotate". */
export function RotateArt({ accent }: { accent: string }) {
  const colors = useColors();
  const t = useLoop(1500);

  const body = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${-32 + t.value * 64}deg` }],
  }));
  const finger = useAnimatedStyle(() => ({
    transform: [{ translateX: -46 + t.value * 92 }],
    opacity: 0.35 + t.value * 0.3,
  }));

  return (
    <View style={styles.frame}>
      <Animated.View
        style={[
          styles.slab,
          { backgroundColor: colors.surfaceHigh, borderColor: alpha(accent, 0.55) },
          body,
        ]}
      >
        <View style={[styles.slabBand, { backgroundColor: alpha(accent, 0.85) }]} />
        <View style={[styles.slabBand, { backgroundColor: alpha(accent, 0.35), width: 46 }]} />
      </Animated.View>
      <Animated.View style={[styles.finger, { borderColor: colors.text }, finger]} />
    </View>
  );
}

/** A dot that pulses over a part, for "tap to identify". */
export function TapArt({ accent }: { accent: string }) {
  const colors = useColors();
  const t = useLoop(1100);

  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: 0.7 + t.value * 1.1 }],
    opacity: 0.55 - t.value * 0.5,
  }));

  return (
    <View style={styles.frame}>
      <View style={[styles.block, { backgroundColor: colors.surfaceHigh, borderColor: colors.hairline }]} />
      <View style={[styles.blockInner, { backgroundColor: alpha(accent, 0.22), borderColor: alpha(accent, 0.7) }]} />
      <Animated.View style={[styles.ripple, { borderColor: accent }, pulse]} />
      <View style={[styles.dot, { backgroundColor: accent, borderColor: colors.bg }]} />
    </View>
  );
}

/**
 * One layer of the exploding stack. A component rather than a helper inside a
 * loop: hooks have to be called the same number of times in the same order
 * every render, and a function that calls useAnimatedStyle per iteration only
 * happens to satisfy that while the array length never changes.
 */
function Plate({
  index,
  progress,
  accent,
}: {
  index: number;
  progress: ReturnType<typeof useLoop>;
  accent: string;
}) {
  const colors = useColors();
  const highlighted = index === 1;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (index - 1.5) * (10 + progress.value * 24) }],
  }));

  return (
    <Animated.View
      style={[
        styles.plate,
        {
          backgroundColor: highlighted ? alpha(accent, 0.85) : colors.surfaceHigh,
          borderColor: highlighted ? alpha(accent, 0.9) : colors.hairlineStrong,
          width: 132 - Math.abs(index - 1.5) * 16,
        },
        style,
      ]}
    />
  );
}

/** Four plates drifting apart, for "explode, peel, cut". */
export function ToolArt({ accent }: { accent: string }) {
  const progress = useLoop(1700);
  return (
    <View style={styles.frame}>
      {[0, 1, 2, 3].map((index) => (
        <Plate key={index} index={index} progress={progress} accent={accent} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  slab: {
    width: 118,
    height: 168,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  slabBand: { width: 66, height: 10, borderRadius: 5 },
  finger: {
    position: 'absolute',
    bottom: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  block: { width: 150, height: 150, borderRadius: radius.lg, borderWidth: 2 },
  blockInner: { position: 'absolute', width: 74, height: 74, borderRadius: radius.md, borderWidth: 2 },
  ripple: { position: 'absolute', width: 74, height: 74, borderRadius: 37, borderWidth: 3 },
  dot: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  plate: { position: 'absolute', height: 22, borderRadius: 7, borderWidth: 1.5 },
});
