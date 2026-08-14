/**
 * The part detail sheet.
 *
 * Two problems shaped this. It used to open at full height and sit on top of
 * the very part it was describing — so it now opens compact, showing the name
 * and one line, and expands only when asked. The viewer separately lifts the
 * model clear of whatever height the sheet occupies, so the subject is never
 * behind it.
 *
 * The prev/next arrows exist because reading about one component almost always
 * makes you want the one beside it, and going back to the model to hunt for a
 * dot is a poor way to ask for that.
 */

import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { Part } from '@/content/types';
import { useColors, useT } from '@/state/settings';
import { useFavourites, useIsFavourite } from '@/state/favorites';
import { Label, Text, Touchable } from '../primitives';
import { alpha, radius, space } from '../theme';

/** Heights the viewer needs, so it can lift the model clear of the sheet. */
export const SHEET_COMPACT = 172;
export const SHEET_EXPANDED = 376;

export function PartSheet({
  objectId,
  part,
  accent,
  isolated,
  expanded,
  position,
  total,
  onIsolate,
  onToggleExpand,
  onPrev,
  onNext,
  onClose,
  bottom,
}: {
  objectId: string;
  part: Part;
  accent: string;
  isolated: boolean;
  expanded: boolean;
  /** 1-based index among visible parts, for the "3 of 13" readout. */
  position: number;
  total: number;
  onIsolate: () => void;
  onToggleExpand: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  bottom: number;
}) {
  const colors = useColors();
  const t = useT();
  const toggleFavourite = useFavourites((state) => state.toggle);
  const saved = useIsFavourite(objectId, part.id);

  return (
    <Animated.View
      entering={SlideInDown.duration(220)}
      exiting={SlideOutDown.duration(160)}
      style={[
        styles.sheet,
        { paddingBottom: bottom + space.md, borderColor: alpha(accent, 0.28), backgroundColor: colors.scrim },
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Label color={alpha(accent, 0.9)}>
            {t('part.layer', { n: part.layer })} · {t('part.position', { index: position, total })}
          </Label>
          <Text variant="title" numberOfLines={expanded ? 2 : 1} style={{ marginTop: 3 }}>
            {part.name}
          </Text>
        </View>

        <Touchable
          onPress={() => toggleFavourite(objectId, part.id)}
          accessibilityRole="button"
          accessibilityLabel={saved ? t('part.unsave') : t('part.save')}
          style={[styles.round, { backgroundColor: saved ? alpha(accent, 0.2) : colors.surfaceHigh }]}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? accent : colors.textMuted} />
        </Touchable>
        <Touchable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('part.close')}
          style={[styles.round, { backgroundColor: colors.surfaceHigh }]}
        >
          <Ionicons name="close" size={17} color={colors.textMuted} />
        </Touchable>
      </View>

      <Text variant="caption" color={accent} numberOfLines={expanded ? 3 : 2} style={{ marginTop: 2 }}>
        {part.short}
      </Text>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <Text variant="body" color={colors.textMuted} style={styles.justified}>
              {part.detail}
            </Text>
          </ScrollView>
        </Animated.View>
      ) : null}

      <View style={styles.actions}>
        <Touchable
          onPress={onPrev}
          accessibilityRole="button"
          accessibilityLabel={t('part.prev')}
          style={[styles.step, { borderColor: colors.hairlineStrong }]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        </Touchable>

        <Touchable
          onPress={onToggleExpand}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={[styles.grow, { backgroundColor: colors.surfaceHigh, borderColor: colors.hairline }]}
        >
          <Ionicons name={expanded ? 'chevron-down' : 'chevron-up'} size={15} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>
            {expanded ? t('part.less') : t('part.readMore')}
          </Text>
        </Touchable>

        <Touchable
          onPress={onIsolate}
          accessibilityRole="button"
          accessibilityState={{ selected: isolated }}
          style={[
            styles.grow,
            {
              backgroundColor: isolated ? alpha(accent, 0.18) : colors.surfaceHigh,
              borderColor: isolated ? alpha(accent, 0.55) : colors.hairline,
            },
          ]}
        >
          <Ionicons
            name={isolated ? 'eye-off-outline' : 'contract-outline'}
            size={15}
            color={isolated ? accent : colors.textMuted}
          />
          <Text variant="caption" color={isolated ? accent : colors.textMuted}>
            {isolated ? t('part.onlyThis') : t('part.isolate')}
          </Text>
        </Touchable>

        <Touchable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel={t('part.next')}
          style={[styles.step, { borderColor: colors.hairlineStrong }]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Touchable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    gap: space.xs,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  round: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { maxHeight: 168, marginTop: space.sm },
  // Justified, as asked. Paired with a slightly looser line height, because
  // justification stretches word spacing and tight lines then look ragged.
  justified: { textAlign: 'justify', lineHeight: 24 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, alignItems: 'stretch' },
  step: {
    width: 46,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
