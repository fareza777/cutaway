/**
 * The explorer.
 *
 * React owns the chrome; the viewer owns the model. State that only the GPU
 * cares about (camera, materials, transforms) never enters React, and state
 * only the UI cares about (which panel is open) never enters the viewer. The
 * two meet through a handful of imperative calls in this file.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getDoc, getModelAsset } from '@/content/registry';
import type { CutawayViewer } from '@/engine/CutawayViewer';
import { useProgress } from '@/state/progress';
import { Text, Touchable } from '@/ui/primitives';
import { Viewport } from '@/ui/Viewport';
import { TopBar } from '@/ui/explorer/TopBar';
import { ToolDock, type ToolId, type ToolValues } from '@/ui/explorer/ToolDock';
import { PartSheet, SHEET_COMPACT, SHEET_EXPANDED } from '@/ui/explorer/PartSheet';
import { PartsPanel, StoryPanel } from '@/ui/explorer/Panels';
import { Dimensions } from 'react-native';
import { useColors, useLocale, useSettings, useT, useThemeMode } from '@/state/settings';
import { alpha, radius, space } from '@/ui/theme';
import { AdBanner, showViewerExitInterstitial } from '@/monetization/ads';

type Panel = 'none' | 'parts' | 'story';

export default function Explorer() {
  const { id, part: initialPart } = useLocalSearchParams<{ id: string; part?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const mode = useThemeMode();
  const toggleMode = useSettings((state) => state.toggleMode);
  const markVisited = useProgress((state) => state.markVisited);
  const locale = useLocale();
  const t = useT();

  const doc = useMemo(() => (id ? getDoc(id, locale) : undefined), [id, locale]);
  const modelAsset = useMemo(() => (id ? getModelAsset(id) : undefined), [id]);

  const viewerRef = useRef<CutawayViewer | null>(null);
  const viewerStartedAt = useRef<number | null>(null);
  const exitAdRequested = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolId | null>(null);
  const [values, setValues] = useState<ToolValues>({ explode: 0, peel: 0, cut: 0 });
  const [xray, setXray] = useState(false);
  const [running, setRunning] = useState(false);
  const [isolated, setIsolated] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [panel, setPanel] = useState<Panel>('none');
  const [step, setStep] = useState(0);
  const [maxLayer, setMaxLayer] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [layerFocus, setLayerFocus] = useState<number | null>(null);
  const [cutAxis, setCutAxis] = useState<'x' | 'y' | 'z'>('x');

  useEffect(() => {
    viewerStartedAt.current = null;
    exitAdRequested.current = false;
  }, [id]);

  const handleViewerBack = useCallback(async () => {
    if (exitAdRequested.current) return;
    exitAdRequested.current = true;
    await showViewerExitInterstitial(viewerStartedAt.current ?? Date.now());
    router.back();
  }, [router]);

  const changeCutAxis = useCallback((axis: 'x' | 'y' | 'z') => {
    setCutAxis(axis);
    viewerRef.current?.setCutAxis(axis);
  }, []);
  const [animatable, setAnimatable] = useState(false);

  useEffect(() => {
    if (id) markVisited(id);
  }, [id, markVisited]);

  // Android's back button dismisses what is on top before it leaves the screen.
  // Without this it closed the whole explorer from under an open panel, which
  // is not what any Android user expects of a sheet.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panel !== 'none') {
        setPanel('none');
        viewerRef.current?.setFocus(null);
        return true;
      }
      if (selected) {
        viewerRef.current?.select(null);
        setSelected(null);
        setIsolated(false);
        return true;
      }
      void handleViewerBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleViewerBack, panel, selected]);

  const onReady = useCallback(
    (viewer: CutawayViewer) => {
      viewerRef.current = viewer;
      if (!doc || modelAsset === undefined) {
        setLoading(false);
        setError('This object is not in the library.');
        return;
      }
      // A bare .then() would let a rejection vanish into an unhandled promise,
      // which is exactly how a failed load showed up as a spinner that never
      // stopped. Anything that goes wrong has to reach the screen.
      viewer
        .setObject(doc, modelAsset)
        .then(() => {
          viewerStartedAt.current = Date.now();
          setMaxLayer(viewer.maxLayer);
          setAnimatable(viewer.animatable);
        })
        .catch((cause: unknown) => {
          setLoading(false);
          setError(cause instanceof Error ? cause.message : 'Could not load this model.');
        });
    },
    [doc, modelAsset, initialPart],
  );

  const events = useMemo(
    () => ({
      onLoading: setLoading,
      onError: setError,
      onSelect: (partId: string | null) => {
        setSelected(partId);
        if (!partId) setIsolated(false);
      },
    }),
    [],
  );

  // Ordered outermost-first, which is the order the parts panel shows and the
  // order somebody stepping through them would expect.
  const walkable = useMemo(
    () => (doc?.parts.filter((part) => !part.hidden) ?? []).slice().sort((a, b) => a.layer - b.layer),
    [doc],
  );
  const selectedPart = useMemo(() => walkable.find((part) => part.id === selected) ?? null, [walkable, selected]);
  const selectedIndex = selectedPart ? walkable.indexOf(selectedPart) : -1;

  const stepPart = useCallback(
    (delta: number) => {
      if (!walkable.length) return;
      const next = walkable[(selectedIndex + delta + walkable.length) % walkable.length];
      viewerRef.current?.select(next.id);
      setSelected(next.id);
    },
    [selectedIndex, walkable],
  );

  // ---------------------------------------------------------------- actions

  const changeTool = useCallback(
    (next: ToolId | null) => {
      // Leaving a tool puts its effect away too, so the model always matches
      // what the toolbar claims is on.
      if (tool && tool !== next) {
        setValues((current) => ({ ...current, [tool]: 0 }));
        applyTool(viewerRef.current, tool, 0);
      }
      setTool(next);
    },
    [tool],
  );

  const onToolChange = useCallback((which: ToolId, value: number) => {
    setValues((current) => ({ ...current, [which]: value }));
    applyTool(viewerRef.current, which, value);
  }, []);

  // Each toggle reads the current value and drives the viewer once. Doing the
  // viewer call inside a state updater would run it twice whenever React
  // re-invokes the updater, which is exactly the kind of double-fire that
  // leaves the toolbar and the model disagreeing.
  const toggleXray = useCallback(() => {
    viewerRef.current?.setXray(!xray);
    setXray(!xray);
  }, [xray]);

  const toggleRun = useCallback(() => {
    viewerRef.current?.setRunning(!running);
    setRunning(!running);
  }, [running]);

  const toggleIsolate = useCallback(() => {
    viewerRef.current?.setIsolate(!isolated);
    setIsolated(!isolated);
  }, [isolated]);

  const toggleAutoRotate = useCallback(() => {
    viewerRef.current?.setAutoRotate(!autoRotate);
    setAutoRotate(!autoRotate);
  }, [autoRotate]);

  // The viewer lifts the model out from behind whatever the sheet covers.
  useEffect(() => {
    const height = Dimensions.get('window').height;
    const covered = selectedPart ? (sheetExpanded ? SHEET_EXPANDED : SHEET_COMPACT) + insets.bottom : 0;
    viewerRef.current?.setObscuredBottom(covered / Math.max(height, 1));
  }, [insets.bottom, selectedPart, sheetExpanded]);

  const focusLayer = useCallback((layer: number | null) => {
    setLayerFocus(layer);
    viewerRef.current?.setLayerFocus(layer);
  }, []);

  const resetAll = useCallback(() => {
    viewerRef.current?.reset();
    setValues({ explode: 0, peel: 0, cut: 0 });
    setTool(null);
    setXray(false);
    setRunning(false);
    setIsolated(false);
    setSelected(null);
    setPanel('none');
    setSheetExpanded(false);
    setLayerFocus(null);
  }, []);

  const selectPart = useCallback((partId: string) => {
    viewerRef.current?.select(partId);
    setSelected(partId);
  }, []);

  const openPanel = useCallback(
    (next: Panel) => {
      // Computed from the current value rather than inside the state updater:
      // an updater may run twice, and driving the viewer from one would fire
      // the side effect twice too.
      const target = panel === next ? 'none' : next;
      viewerRef.current?.setFocus(target === 'story' ? (doc?.steps[step]?.focus ?? null) : null);
      setPanel(target);
    },
    [doc, panel, step],
  );

  const goToStep = useCallback(
    (index: number) => {
      setStep(index);
      viewerRef.current?.setFocus(doc?.steps[index]?.focus ?? null);
    },
    [doc],
  );

  if (!doc) {
    return (
      <View style={[styles.screen, styles.centre, { backgroundColor: colors.bg }]}>
        <Text variant="body" color={colors.textMuted}>
          {t('explorer.notFound')}
        </Text>
        <Touchable onPress={() => router.back()} style={{ marginTop: space.lg }}>
          <Text variant="heading" color={colors.text}>
            {t('common.goBack')}
          </Text>
        </Touchable>
      </View>
    );
  }

  const accent = doc.accent;
  const panelOpen = panel !== 'none';
  const dockBottom = insets.bottom + space.md;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Viewport events={events} onReady={onReady} interactive={!panelOpen} />

      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={accent} />
          <Text variant="caption" color={colors.textFaint} style={{ marginTop: space.md }}>
            {t('explorer.loading', { name: doc.title.toLowerCase() })}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.loading} pointerEvents="none">
          <Ionicons name="alert-circle-outline" size={26} color={colors.wrong} />
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: space.md, textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      ) : null}

      <TopBar
        title={doc.title}
        subtitle={doc.subtitle}
        accent={accent}
        top={insets.top}
        autoRotate={autoRotate}
        onBack={() => void handleViewerBack()}
        onReset={resetAll}
        onToggleAutoRotate={toggleAutoRotate}
        onToggleTheme={toggleMode}
        themeMode={mode}
      />

      {!selectedPart && !panelOpen ? (
        <View style={[styles.dock, { bottom: dockBottom }]} pointerEvents="box-none">
          <ToolDock
            accent={accent}
            active={tool}
            values={values}
            maxLayer={maxLayer}
            xray={xray}
            running={running}
            animatable={animatable}
            onSelectTool={changeTool}
            onChange={onToolChange}
            onToggleXray={toggleXray}
            onToggleRun={toggleRun}
            cutAxis={cutAxis}
            onCutAxis={changeCutAxis}
            onFlipCut={() => viewerRef.current?.flipCut()}
            layerFocus={layerFocus}
            onLayerFocus={focusLayer}
          />
          <NavBar
            accent={accent}
            onParts={() => openPanel('parts')}
            onStory={() => openPanel('story')}
            onQuiz={() => router.push(`/quiz/${doc.id}`)}
          />
          {!loading && !error ? <AdBanner /> : null}
        </View>
      ) : null}

      {selectedPart && !panelOpen ? (
        <PartSheet
          objectId={doc.id}
          part={selectedPart}
          accent={accent}
          isolated={isolated}
          expanded={sheetExpanded}
          position={selectedIndex + 1}
          total={walkable.length}
          bottom={insets.bottom}
          onIsolate={toggleIsolate}
          onToggleExpand={() => setSheetExpanded((value) => !value)}
          onPrev={() => stepPart(-1)}
          onNext={() => stepPart(1)}
          onClose={() => {
            viewerRef.current?.select(null);
            setSelected(null);
            setIsolated(false);
            setSheetExpanded(false);
          }}
        />
      ) : null}

      {panel === 'parts' ? (
        <PartsPanel
          doc={doc}
          accent={accent}
          selected={selected}
          top={insets.top}
          bottom={insets.bottom + space.lg}
          onSelect={(partId) => {
            selectPart(partId);
            setPanel('none');
          }}
          onClose={() => setPanel('none')}
        />
      ) : null}

      {panel === 'story' ? (
        <StoryPanel
          doc={doc}
          accent={accent}
          step={step}
          top={insets.top}
          bottom={insets.bottom + space.lg}
          onStep={goToStep}
          onClose={() => {
            setPanel('none');
            viewerRef.current?.setFocus(null);
          }}
        />
      ) : null}
    </View>
  );
}

function applyTool(viewer: CutawayViewer | null, which: ToolId, value: number) {
  if (!viewer) return;
  if (which === 'explode') viewer.setExplode(value);
  else if (which === 'cut') viewer.setCut(value);
  else viewer.setPeel(Math.round(value * viewer.maxLayer));
}

function NavBar({
  accent,
  onParts,
  onStory,
  onQuiz,
}: {
  accent: string;
  onParts: () => void;
  onStory: () => void;
  onQuiz: () => void;
}) {
  const colors = useColors();
  const t = useT();
  const items = [
    { label: t('nav.parts'), icon: 'list-outline' as const, onPress: onParts },
    { label: t('nav.story'), icon: 'book-outline' as const, onPress: onStory },
    { label: t('nav.quiz'), icon: 'help-circle-outline' as const, onPress: onQuiz },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.nav}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((item) => (
        <Touchable
          key={item.label}
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={[styles.navItem, { borderColor: alpha(accent, 0.24), backgroundColor: colors.floating }]}
        >
          <Ionicons name={item.icon} size={16} color={accent} />
          <Text variant="caption" color={colors.text}>
            {item.label}
          </Text>
        </Touchable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  dock: { position: 'absolute', left: 0, right: 0, gap: space.md },
  nav: { gap: space.sm, paddingHorizontal: space.lg },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
