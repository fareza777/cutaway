import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { categories, getLibrary } from '@/content/registry';
import { useProgress } from '@/state/progress';
import { ObjectGlyph } from '@/ui/ObjectGlyph';
import { Chip, Label, Text, Touchable } from '@/ui/primitives';
import { useCategoryLabel, useColors, useLocale, useSettings, useT, useThemeMode } from '@/state/settings';
import { alpha, radius, space } from '@/ui/theme';
import type { ObjectSummary } from '@/content/types';

const ALL = 'All';

export default function Library() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const categoryLabel = useCategoryLabel();
  const mode = useThemeMode();
  const toggleMode = useSettings((state) => state.toggleMode);
  const locale = useLocale();
  const t = useT();
  const library = useMemo(() => getLibrary(locale), [locale]);
  const [filter, setFilter] = useState(ALL);
  const visited = useProgress((state) => state.visited);
  const best = useProgress((state) => state.best);

  const items = useMemo(
    () => (filter === ALL ? library : library.filter((item) => item.category === filter)),
    [filter, library],
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
        <View style={styles.masthead}>
          <View style={styles.mastheadRow}>
            <Text variant="display" style={{ flex: 1 }}>
              Cutaway
            </Text>
            <Touchable
              onPress={() => router.push('/saved')}
              accessibilityRole="button"
              accessibilityLabel={t('library.saved')}
              style={[styles.themeButton, { backgroundColor: colors.surfaceHigh, borderColor: colors.hairline }]}
            >
              <Ionicons name="bookmark-outline" size={18} color={colors.textMuted} />
            </Touchable>
            <Touchable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel={t('library.settings')}
              style={[styles.themeButton, { backgroundColor: colors.surfaceHigh, borderColor: colors.hairline }]}
            >
              <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
            </Touchable>
          </View>
          <Text variant="body" color={colors.textMuted} style={{ marginTop: space.xs }}>
            {t('app.tagline')}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}
        >
          {[ALL, ...categories].map((category) => (
            <Chip
              key={category}
              label={category === ALL ? t('library.all') : categoryLabel(category)}
              accent={colors.text}
              active={filter === category}
              onPress={() => setFilter(category)}
            />
          ))}
        </ScrollView>

        <View style={{ gap: space.md }}>
          {items.map((item) => (
            <ObjectCard
              key={item.id}
              item={item}
              visited={Boolean(visited[item.id])}
              score={best[item.id]}
              onPress={() => router.push(`/object/${item.id}`)}
              t={t}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <Text variant="caption" color={colors.textFaint}>
            {t('library.footer', { count: library.length })}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ObjectCard({
  item,
  visited,
  score,
  onPress,
  t,
}: {
  item: ObjectSummary;
  visited: boolean;
  score?: { correct: number; total: number };
  onPress: () => void;
  t: ReturnType<typeof useT>;
}) {
  const colors = useColors();
  const categoryLabel = useCategoryLabel();
  return (
    <Touchable
      onPress={onPress}
      style={[styles.card, { borderColor: alpha(item.accent, 0.2), backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.partCount} parts.`}
    >
      <ObjectGlyph category={item.category} accent={item.accent} />

      <View style={styles.cardBody}>
        <Label color={alpha(item.accent, 0.85)}>{categoryLabel(item.category)}</Label>
        <Text variant="title" style={{ marginTop: 5 }}>
          {item.title}
        </Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={2} style={{ marginTop: 3 }}>
          {item.subtitle}
        </Text>

        <View style={styles.meta}>
          <Meta icon="layers-outline" text={t('library.parts', { count: item.partCount })} />
          {item.scale ? <Meta icon="resize-outline" text={item.scale} /> : null}
          {score ? (
            <Meta
              icon="ribbon-outline"
              text={`${score.correct}/${score.total}`}
              color={score.correct === score.total ? colors.correct : colors.textFaint}
            />
          ) : null}
        </View>
      </View>

      {visited ? (
        <View style={[styles.visitedDot, { backgroundColor: alpha(item.accent, 0.9) }]} />
      ) : null}
    </Touchable>
  );
}

function Meta({ icon, text, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; color?: string }) {
  const colors = useColors();
  const tint = color ?? colors.textFaint;
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={tint === colors.textFaint ? 12 : 12} color={tint} />
      <Text variant="caption" color={tint}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  masthead: { marginBottom: space.xs },
  mastheadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  themeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  cardBody: { flex: 1 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  visitedDot: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  footer: { alignItems: 'center', paddingTop: space.lg },
});
