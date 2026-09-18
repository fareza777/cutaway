import { useEffect, useMemo, useState } from 'react';
import { Image, Keyboard, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { categories, getLibrary, type LibraryItem } from '@/content/registry';
import { filterLibrary } from '@/content/search';
import { LibraryBanner } from '@/monetization/LibraryBanner';
import { useProgress } from '@/state/progress';
import { Chip, Label, Text, Touchable } from '@/ui/primitives';
import { useCategoryLabel, useColors, useLocale, useReadableAccent, useT } from '@/state/settings';
import { alpha, radius, space } from '@/ui/theme';

const ALL = 'All';

export default function Library() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const categoryLabel = useCategoryLabel();
  const locale = useLocale();
  const t = useT();
  const library = useMemo(() => getLibrary(locale), [locale]);
  const [filter, setFilter] = useState(ALL);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const visited = useProgress((state) => state.visited);
  const best = useProgress((state) => state.best);

  const items = useMemo(
    () => filterLibrary(library, query, filter === ALL ? null : filter),
    [filter, library, query],
  );

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const resetSearch = () => { setQuery(''); setFilter(ALL); };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: space.xl,
          gap: space.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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

        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: searchFocused ? colors.textMuted : colors.hairlineStrong }]}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => { setSearchFocused(true); setKeyboardVisible(true); }}
            onBlur={() => { setSearchFocused(false); setKeyboardVisible(false); }}
            accessibilityLabel={t('library.search')}
            placeholder={t('library.search')}
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Touchable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('library.clearSearch')} style={styles.clearSearch}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Touchable>
          ) : null}
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
          {query.trim() || filter !== ALL ? (
            <Text variant="caption" color={colors.textMuted} accessibilityLiveRegion="polite">
              {t('library.results', { count: items.length })}
            </Text>
          ) : null}
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
          {items.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
              <Ionicons name="search-outline" size={28} color={colors.textMuted} />
              <Text variant="heading">{t('library.noResults')}</Text>
              <Text variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>{t('library.searchHint')}</Text>
              <Touchable onPress={resetSearch} accessibilityRole="button" style={[styles.resetSearch, { backgroundColor: colors.surfaceHigh }]}>
                <Text variant="heading">{t('library.resetSearch')}</Text>
              </Touchable>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text variant="caption" color={colors.textFaint}>
            {t('library.footer', { count: library.length })}
          </Text>
        </View>
      </ScrollView>
      <LibraryBanner keyboardVisible={keyboardVisible} />
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
  item: LibraryItem;
  visited: boolean;
  score?: { correct: number; total: number };
  onPress: () => void;
  t: ReturnType<typeof useT>;
}) {
  const colors = useColors();
  const categoryLabel = useCategoryLabel();
  const accentText = useReadableAccent(item.accent);
  return (
    <Touchable
      onPress={onPress}
      style={[styles.card, { borderColor: alpha(item.accent, 0.2), backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.subtitle}. ${t('library.parts', { count: item.partCount })}.`}
    >
      <View style={[styles.iconFrame, { backgroundColor: alpha(item.accent, 0.07), borderColor: alpha(item.accent, 0.16) }]}>
        <Image
          source={item.icon}
          style={styles.objectIcon}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel={t('library.icon', { title: item.title })}
        />
      </View>

      <View style={styles.cardBody}>
        <Label color={accentText}>{categoryLabel(item.category)}</Label>
        <Text variant="title" style={{ marginTop: 5 }}>
          {item.title}
        </Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: 3 }}>
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
      <Text variant="caption" color={tint} style={styles.metaText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  masthead: { marginBottom: space.xs },
  mastheadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  search: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingLeft: space.lg, paddingRight: space.xs, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  searchInput: { flex: 1, minWidth: 0, height: 50, fontSize: 15, paddingVertical: space.md },
  clearSearch: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: space.xl, gap: space.md, alignItems: 'center', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  resetSearch: { minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.sm, justifyContent: 'center' },
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
  iconFrame: {
    width: 100,
    height: 100,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  objectIcon: { width: '100%', height: '100%' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', flexShrink: 1 },
  metaText: { flexShrink: 1 },
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
