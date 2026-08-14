/**
 * Settings.
 *
 * Three things only: language, appearance, and a way to wipe what the app has
 * remembered about you. There is nothing else to configure because there is
 * nothing else stored — no account, no sync, no analytics.
 */

import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { LOCALES, type Locale } from '@/i18n/strings';
import { useColors, useLocale, useSettings, useT, useThemeMode } from '@/state/settings';
import { useFavourites } from '@/state/favorites';
import { useProgress } from '@/state/progress';
import { Label, Text, Touchable } from '@/ui/primitives';
import { alpha, radius, space } from '@/ui/theme';

const ACCENT = '#FF9F45';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const t = useT();
  const locale = useLocale();
  const mode = useThemeMode();
  const setLocale = useSettings((state) => state.setLocale);
  const setMode = useSettings((state) => state.setMode);
  const clearFavourites = useFavourites((state) => state.clear);
  const resetProgress = useProgress((state) => state.reset);

  const Row = ({
    label,
    selected,
    onPress,
    hint,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    hint?: string;
  }) => (
    <Touchable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.row,
        {
          backgroundColor: selected ? alpha(ACCENT, 0.12) : colors.surface,
          borderColor: selected ? alpha(ACCENT, 0.5) : colors.hairline,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text variant="heading" color={selected ? ACCENT : colors.text}>
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" color={colors.textFaint} style={{ marginTop: 2 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={20} color={ACCENT} /> : null}
    </Touchable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: space.xl,
          gap: space.xl,
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
          <Text variant="display">{t('settings.title')}</Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Label>{t('settings.language')}</Label>
          {LOCALES.map((entry) => (
            <Row
              key={entry.code}
              label={entry.label}
              hint={entry.code === locale ? undefined : entry.english}
              selected={locale === entry.code}
              onPress={() => setLocale(entry.code as Locale)}
            />
          ))}
        </View>

        <View style={{ gap: space.sm }}>
          <Label>{t('settings.appearance')}</Label>
          <Row label={t('settings.dark')} selected={mode === 'dark'} onPress={() => setMode('dark')} />
          <Row label={t('settings.light')} selected={mode === 'light'} onPress={() => setMode('light')} />
        </View>

        <View style={{ gap: space.sm }}>
          <Label>{t('settings.data')}</Label>
          <Touchable
            onPress={() => {
              resetProgress();
              clearFavourites();
            }}
            accessibilityRole="button"
            style={[styles.row, { backgroundColor: colors.surface, borderColor: alpha(colors.wrong, 0.4) }]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.wrong} />
            <Text variant="heading" color={colors.wrong} style={{ flex: 1 }}>
              {t('settings.clearProgress')}
            </Text>
          </Touchable>
          <Text variant="caption" color={colors.textFaint} style={styles.justified}>
            {t('settings.clearHint')}
          </Text>
        </View>

        <Text variant="caption" color={colors.textFaint} style={[styles.justified, { marginTop: space.lg }]}>
          {t('settings.about')}
        </Text>
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
  justified: { textAlign: 'justify', lineHeight: 20 },
});
