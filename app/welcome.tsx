/**
 * First run.
 *
 * Three pages, each teaching one gesture by showing it moving rather than
 * describing it. It is shown once; the flag lives with the other settings, and
 * the library is reachable at any point by skipping.
 */

import { useCallback, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { LOCALES, type TranslationKey } from '@/i18n/strings';
import { useColors, useReadableAccent, useLocale, useSettings, useT } from '@/state/settings';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GhostButton, Label, PrimaryButton, Text, Touchable } from '@/ui/primitives';
import { RotateArt, TapArt, ToolArt } from '@/ui/onboarding/Illustrations';
import { alpha, radius, space } from '@/ui/theme';

const ACCENT = '#FF9F45';

/** Page four has no illustration — it carries the language choice itself. */
const ARTS = [RotateArt, TapArt, ToolArt, null] as const;

/** Spelled out rather than built with template literals, so a typo is a type error. */
const COPY: { kicker: TranslationKey; title: TranslationKey; body: TranslationKey }[] = [
  { kicker: 'welcome.1.kicker', title: 'welcome.1.title', body: 'welcome.1.body' },
  { kicker: 'welcome.2.kicker', title: 'welcome.2.title', body: 'welcome.2.body' },
  { kicker: 'welcome.3.kicker', title: 'welcome.3.title', body: 'welcome.3.body' },
  { kicker: 'welcome.4.kicker', title: 'welcome.4.title', body: 'welcome.4.body' },
];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const accentText = useReadableAccent(ACCENT);
  const completeOnboarding = useSettings((state) => state.completeOnboarding);
  const setLocale = useSettings((state) => state.setLocale);
  const locale = useLocale();
  const t = useT();
  const [page, setPage] = useState(0);
  const width = Dimensions.get('window').width;
  const scroller = useRef<ScrollView>(null);

  const finish = useCallback(() => {
    completeOnboarding();
    router.replace('/');
  }, [completeOnboarding, router]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (next !== page) setPage(next);
  };

  const last = page >= ARTS.length - 1;
  const advance = () => {
    if (last) {
      finish();
      return;
    }
    // Scrolling rather than setting state keeps the button and the swipe on the
    // same source of truth — onScroll is what moves `page` either way.
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {ARTS.map((Art, index) => (
          <View key={index} style={[styles.page, { width, paddingTop: insets.top + space.xxl }]}>
            <View style={styles.art}>
              <View style={[styles.halo, { backgroundColor: alpha(ACCENT, 0.07) }]} />
              {Art ? (
                <Art accent={ACCENT} />
              ) : (
                // The language page carries the choice itself rather than an
                // illustration — it is the one page that asks for an answer.
                <View style={{ width: '100%', gap: space.sm }}>
                  {LOCALES.map((entry) => {
                    const active = locale === entry.code;
                    return (
                      <Touchable
                        key={entry.code}
                        onPress={() => setLocale(entry.code)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.choice,
                          {
                            backgroundColor: active ? alpha(ACCENT, 0.14) : colors.surface,
                            borderColor: active ? alpha(ACCENT, 0.55) : colors.hairline,
                          },
                        ]}
                      >
                        <Text variant="heading" color={active ? accentText : colors.text} style={{ flex: 1 }}>
                          {entry.label}
                        </Text>
                        {active ? <Ionicons name="checkmark-circle" size={20} color={accentText} /> : null}
                      </Touchable>
                    );
                  })}
                </View>
              )}
            </View>
            <Label color={accentText}>{t(COPY[index].kicker)}</Label>
            <Text variant="display" style={{ marginTop: space.sm }}>
              {t(COPY[index].title)}
            </Text>
            <Text variant="body" color={colors.textMuted} style={{ marginTop: space.md }}>
              {t(COPY[index].body)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.pips}>
          {ARTS.map((_art, index) => (
            <View
              key={index}
              style={[
                styles.pip,
                {
                  backgroundColor: index === page ? ACCENT : colors.surfacePressed,
                  width: index === page ? 22 : 7,
                },
              ]}
            />
          ))}
        </View>

        <PrimaryButton label={last ? t('welcome.start') : t('welcome.next')} accent={ACCENT} onPress={advance} />
        {last ? null : <GhostButton label={t('welcome.skip')} onPress={finish} style={{ marginTop: space.sm }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { paddingHorizontal: space.xl, flex: 1, paddingBottom: space.xl },
  art: { alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 240 },
  halo: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },
  footer: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.lg },
  pips: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: space.xs },
  pip: { height: 7, borderRadius: 4 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
