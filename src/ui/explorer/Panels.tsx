/**
 * The two full-height overlays: the parts index and the walkthrough.
 *
 * Both drive the viewer while they are open — tapping a part selects it in 3D,
 * and moving through the walkthrough focuses the parts that step is about — so
 * the model is never just decoration behind a wall of text.
 */

import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { ObjectDoc, Part, Step } from '@/content/types';
import { Divider, GhostButton, Label, Text, Touchable } from '../primitives';
import { useColors, useT } from '@/state/settings';
import { alpha, radius, space } from '../theme';

function PanelFrame({
  title,
  accent,
  onClose,
  top,
  bottom,
  children,
}: {
  title: string;
  accent: string;
  onClose: () => void;
  top: number;
  bottom: number;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const t = useT();
  return (
    <Animated.View
      entering={SlideInDown.duration(260)}
      exiting={SlideOutDown.duration(200)}
      style={[styles.panel, { top: top + 56, paddingBottom: bottom, borderColor: alpha(accent, 0.24), backgroundColor: colors.scrim }]}
    >
      <View style={styles.panelHeader}>
        <Text variant="title">{title}</Text>
        <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close', { name: title })} style={[styles.close, { backgroundColor: colors.surfaceHigh }]}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Touchable>
      </View>
      <Divider />
      {children}
    </Animated.View>
  );
}

export function PartsPanel({
  doc,
  selected,
  accent,
  onSelect,
  onClose,
  top,
  bottom,
}: {
  doc: ObjectDoc;
  selected: string | null;
  accent: string;
  onSelect: (partId: string) => void;
  onClose: () => void;
  top: number;
  bottom: number;
}) {
  const colors = useColors();
  const t = useT();
  const byLayer = new Map<number, Part[]>();
  for (const part of doc.parts) {
    if (part.hidden) continue;
    const list = byLayer.get(part.layer) ?? [];
    list.push(part);
    byLayer.set(part.layer, list);
  }
  const layers = [...byLayer.keys()].sort((a, b) => a - b);

  return (
    <PanelFrame title={t('panel.parts')} accent={accent} onClose={onClose} top={top} bottom={bottom}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {layers.map((layer) => (
          <View key={layer} style={{ gap: space.sm }}>
            <Label>
              {layer === 0 ? t('tool.outer') : layer === Math.max(...layers) ? t('tool.core') : t('tool.layer', { n: layer })}
            </Label>
            {byLayer.get(layer)!.map((part) => (
              <Touchable
                key={part.id}
                onPress={() => onSelect(part.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === part.id }}
                style={[
                  styles.row,
                  {
                    backgroundColor: selected === part.id ? alpha(accent, 0.14) : colors.surface,
                    borderColor: selected === part.id ? alpha(accent, 0.5) : colors.hairline,
                  },
                ]}
              >
                <View style={[styles.bullet, { backgroundColor: alpha(accent, selected === part.id ? 1 : 0.45) }]} />
                <View style={{ flex: 1 }}>
                  <Text variant="heading">{part.name}</Text>
                  <Text variant="caption" color={colors.textMuted} numberOfLines={2} style={{ marginTop: 2 }}>
                    {part.short}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
              </Touchable>
            ))}
          </View>
        ))}
      </ScrollView>
    </PanelFrame>
  );
}

export function StoryPanel({
  doc,
  step,
  accent,
  onStep,
  onClose,
  top,
  bottom,
}: {
  doc: ObjectDoc;
  step: number;
  accent: string;
  onStep: (index: number) => void;
  onClose: () => void;
  top: number;
  bottom: number;
}) {
  const colors = useColors();
  const t = useT();
  const steps: Step[] = doc.steps;
  const current = steps[step];
  const last = step >= steps.length - 1;

  return (
    <PanelFrame title={t('panel.story')} accent={accent} onClose={onClose} top={top} bottom={bottom}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="body" color={colors.textMuted} style={styles.justified}>
          {doc.summary}
        </Text>

        <View style={styles.progress}>
          {steps.map((item, index) => (
            <Touchable
              key={item.title}
              haptic={false}
              onPress={() => onStep(index)}
              accessibilityRole="button"
              accessibilityLabel={`Step ${index + 1}: ${item.title}`}
              style={[
                styles.pip,
                {
                  backgroundColor: index <= step ? accent : colors.surfacePressed,
                  flex: index === step ? 2.2 : 1,
                },
              ]}
            />
          ))}
        </View>

        {current ? (
          <View style={[styles.stepCard, { borderColor: alpha(accent, 0.28), backgroundColor: colors.surface }]}>
            <Label color={alpha(accent, 0.9)}>
              {t('panel.step', { index: step + 1, total: steps.length })}
            </Label>
            <Text variant="title" style={{ marginTop: 6 }}>
              {current.title}
            </Text>
            <Text variant="body" color={colors.textMuted} style={[styles.justified, { marginTop: space.sm }]}>
              {current.body}
            </Text>
          </View>
        ) : null}

        <View style={styles.stepNav}>
          <GhostButton
            label={t('panel.back')}
            onPress={() => onStep(Math.max(0, step - 1))}
            style={{ flex: 1, opacity: step === 0 ? 0.4 : 1 }}
          />
          <GhostButton
            label={last ? t('panel.startOver') : t('panel.next')}
            accent={accent}
            onPress={() => onStep(last ? 0 : step + 1)}
            style={{ flex: 1.4 }}
          />
        </View>
      </ScrollView>
    </PanelFrame>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: space.xl, gap: space.lg },
  // Justification needs a little more leading, or the stretched word spacing
  // makes the lines look like they are closing up on each other.
  justified: { textAlign: 'justify', lineHeight: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bullet: { width: 8, height: 8, borderRadius: 4 },
  progress: { flexDirection: 'row', gap: 5 },
  pip: { height: 4, borderRadius: 2 },
  stepCard: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepNav: { flexDirection: 'row', gap: space.md },
});
