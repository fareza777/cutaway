/**
 * Saved parts, across every object.
 *
 * A flat list rather than a per-object one: the point of saving a part is
 * usually that it connects to something you saw elsewhere — a compressor in a
 * fridge and a compressor in an air conditioner belong next to each other.
 * Tapping one opens its object with that part already selected.
 */

import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getDoc } from '@/content/registry';
import { useFavourites } from '@/state/favorites';
import { useColors, useLocale, useT } from '@/state/settings';
import { GhostButton, Label, Text, Touchable } from '@/ui/primitives';
import { alpha, radius, space } from '@/ui/theme';

export default function Saved() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const locale = useLocale();
  const t = useT();
  const saved = useFavourites((state) => state.saved);
  const toggle = useFavourites((state) => state.toggle);

  const entries = useMemo(
    () =>
      saved
        .map((key) => {
          const [objectId, partId] = key.split(':');
          const doc = getDoc(objectId, locale);
          const part = doc?.parts.find((item) => item.id === partId);
          return doc && part ? { doc, part } : null;
        })
        .filter(Boolean) as { doc: NonNullable<ReturnType<typeof getDoc>>; part: { id: string; name: string; short: string } }[],
    [saved, locale],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: space.xl,
          gap: space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Touchable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.goBack')}
            style={[styles.round, { backgroundColor: colors.surfaceHigh, borderColor: colors.hairline }]}
          >
            <Ionicons name="chevron-back" size={19} color={colors.textMuted} />
          </Touchable>
          <Text variant="display">{t('saved.title')}</Text>
        </View>

        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={30} color={colors.textFaint} />
            <Text variant="body" color={colors.textMuted} style={{ textAlign: 'center', marginTop: space.md }}>
              {t('saved.empty')}
            </Text>
            <GhostButton label={t('saved.browse')} onPress={() => router.back()} style={{ marginTop: space.xl }} />
          </View>
        ) : (
          entries.map(({ doc, part }) => (
            <Touchable
              key={`${doc.id}:${part.id}`}
              onPress={() => router.push(`/object/${doc.id}?part=${part.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${part.name}, from ${doc.title}`}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: alpha(doc.accent, 0.24) }]}
            >
              <View style={[styles.dot, { backgroundColor: doc.accent }]} />
              <View style={{ flex: 1 }}>
                <Label color={alpha(doc.accent, 0.9)}>{doc.title}</Label>
                <Text variant="heading" style={{ marginTop: 3 }}>
                  {part.name}
                </Text>
                <Text variant="caption" color={colors.textMuted} numberOfLines={2} style={{ marginTop: 2 }}>
                  {part.short}
                </Text>
              </View>
              <Touchable
                onPress={() => toggle(doc.id, part.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${part.name} from saved`}
                style={[styles.round, { backgroundColor: colors.surfaceHigh, borderColor: colors.hairline }]}
              >
                <Ionicons name="close" size={16} color={colors.textFaint} />
              </Touchable>
            </Touchable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  round: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  empty: { alignItems: 'center', paddingVertical: space.xxl * 2 },
});
