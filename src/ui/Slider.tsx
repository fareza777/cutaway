/**
 * A continuous slider, built rather than installed.
 *
 * It exists to drive the viewer, so it deliberately reports values on every
 * frame of the drag and never re-renders React while doing so: the track fill
 * and knob are Reanimated styles, and the value reaches the viewer through a
 * plain callback. A community slider would have cost a dependency, a native
 * module, and a re-render per pixel.
 */

import { useCallback } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useColors } from '@/state/settings';
import { alpha, radius, space } from './theme';
import { Text } from './primitives';

const TRACK = 4;
const KNOB = 22;

export function Slider({
  value,
  onChange,
  accent,
  label,
  hint,
  steps,
}: {
  value: number;
  onChange: (value: number) => void;
  accent: string;
  label: string;
  /** Right-aligned readout, e.g. "62%" or "Layer 2". */
  hint?: string;
  /** When set, the value snaps to `steps` evenly spaced positions. */
  steps?: number;
}) {
  const colors = useColors();
  const width = useSharedValue(0);
  const progress = useSharedValue(value);
  progress.value = value;

  const emit = useCallback(
    (next: number) => {
      onChange(next);
    },
    [onChange],
  );

  const commit = (x: number) => {
    'worklet';
    const span = Math.max(width.value - KNOB, 1);
    let next = Math.min(1, Math.max(0, (x - KNOB / 2) / span));
    if (steps && steps > 1) next = Math.round(next * (steps - 1)) / (steps - 1);
    progress.value = next;
    runOnJS(emit)(next);
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => commit(event.x))
    .onChange((event) => commit(event.x))
    .shouldCancelWhenOutside(false);

  const fill = useAnimatedStyle(() => ({
    width: KNOB / 2 + progress.value * Math.max(width.value - KNOB, 0),
  }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * Math.max(width.value - KNOB, 0) }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    width.value = event.nativeEvent.layout.width;
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text variant="caption" color={colors.textMuted}>
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" color={accent}>
            {hint}
          </Text>
        ) : null}
      </View>
      <GestureDetector gesture={gesture}>
        <View style={styles.hitArea} onLayout={onLayout}>
          <View style={[styles.track, { backgroundColor: colors.surfacePressed }]} />
          <Animated.View style={[styles.fill, { backgroundColor: accent }, fill]} />
          <Animated.View
            style={[styles.knob, { backgroundColor: accent, shadowColor: accent, borderColor: alpha(accent, 0.35) }, knob]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // A tall transparent strip so the thumb is reachable without precision.
  hitArea: { height: 34, justifyContent: 'center' },
  track: {
    height: TRACK,
    borderRadius: TRACK,
  },
  fill: {
    position: 'absolute',
    height: TRACK,
    borderRadius: TRACK,
  },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: radius.pill,
    borderWidth: 3,
  },
});
