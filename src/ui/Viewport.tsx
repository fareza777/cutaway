/**
 * The 3D surface.
 *
 * This is the only place React and three.js meet. It creates the viewer once,
 * hands it out through a ref, and translates gestures into imperative calls.
 * Nothing here re-renders while the model moves — a drag is a direct method
 * call on the viewer, not a state update.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { CutawayViewer, type ViewerEvents } from '@/engine/CutawayViewer';
import { Text } from './primitives';
import { useColors, useThemeMode } from '@/state/settings';
import { space } from './theme';

type Props = {
  events: ViewerEvents;
  /** Called once the GL context exists and the viewer is usable. */
  onReady: (viewer: CutawayViewer) => void;
  /** Disables orbit and tap while a modal sheet owns the screen. */
  interactive?: boolean;
};

export function Viewport({ events, onReady, interactive = true }: Props) {
  const colors = useColors();
  const mode = useThemeMode();
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const viewerRef = useRef<CutawayViewer | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Gesture coordinates arrive in layout points; the GL buffer is in device
  // pixels. The ratio between them is resolved on every use rather than cached
  // at startup: onContextCreate can fire before the first onLayout, and a ratio
  // captured then is silently 1 — which put every tap in the wrong place and
  // made drags feel half-speed.
  const gl = useRef<ExpoWebGLRenderingContext | null>(null);
  const layout = useRef({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);

  const pixelScale = () => {
    const buffer = gl.current?.drawingBufferWidth ?? 0;
    const points = layout.current.width;
    return buffer > 0 && points > 0 ? buffer / points : PixelRatio.get();
  };

  useEffect(
    () => () => {
      viewerRef.current?.dispose();
      viewerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    viewerRef.current?.setTheme(mode);
  }, [mode]);

  const onContextCreate = useCallback(
    (context: ExpoWebGLRenderingContext) => {
      try {
        gl.current = context;
        const viewer = new CutawayViewer(context, {
          onLoading: (loading) => eventsRef.current.onLoading?.(loading),
          onError: (message) => {
            setError(message);
            eventsRef.current.onError?.(message);
          },
          onSelect: (partId) => eventsRef.current.onSelect?.(partId),
          onAnswer: (partId) => eventsRef.current.onAnswer?.(partId),
        });
        viewerRef.current = viewer;
        // The stage is built dark; adopt the stored preference before the first
        // frame so a light-theme user never sees a black flash.
        viewer.setTheme(modeRef.current);
        onReady(viewer);
      } catch (cause) {
        // This used to set local state only, which rendered an opaque black
        // rectangle and told the screen above nothing. The parent kept its
        // "loading" state forever, so a failure to start the renderer looked
        // exactly like a slow model — the single most misleading thing this
        // code did. A failure here has to reach whoever is showing the spinner.
        const message = cause instanceof Error ? cause.message : 'Could not start the 3D view';
        setError(message);
        eventsRef.current.onLoading?.(false);
        eventsRef.current.onError?.(message);
      }
    },
    [onReady],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    layout.current = { width, height };
    // The drawing buffer follows the view, so re-read it rather than deriving a
    // size — a rotation or split-screen resize changes both.
    const context = gl.current;
    if (context) viewerRef.current?.resize(context.drawingBufferWidth, context.drawingBufferHeight, pixelScale());
  };

  const rotate = useCallback((dx: number, dy: number) => {
    const scale = pixelScale();
    viewerRef.current?.rotateBy(dx * scale, dy * scale);
  }, []);

  const zoom = useCallback((factor: number) => {
    viewerRef.current?.zoomBy(factor);
  }, []);

  const tap = useCallback((x: number, y: number) => {
    const scale = pixelScale();
    viewerRef.current?.tap(x * scale, y * scale);
  }, []);

  const pan = Gesture.Pan()
    .enabled(interactive)
    .averageTouches(true)
    .onChange((event) => {
      runOnJS(rotate)(event.changeX, event.changeY);
    });

  const pinch = Gesture.Pinch()
    .enabled(interactive)
    .onChange((event) => {
      // `scaleChange` is the per-frame delta; inverting it turns "fingers apart"
      // into "camera closer".
      runOnJS(zoom)(1 / Math.max(event.scaleChange, 0.001));
    });

  // A tap only fires when the finger barely moved, so it never fights the pan.
  const press = Gesture.Tap()
    .enabled(interactive)
    .maxDistance(12)
    .maxDuration(400)
    .onEnd((event, success) => {
      if (success) runOnJS(tap)(event.x, event.y);
    });

  const gesture = Gesture.Simultaneous(pan, pinch, press);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </GestureDetector>
      {error ? (
        <View style={[styles.error, { backgroundColor: colors.bg }]}>
          <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  error: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
  },
});
