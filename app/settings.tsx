/**
 * Settings.
 *
 * Three things only: language, appearance, and a way to wipe what the app has
 * remembered about you. There is nothing else to configure because there is
 * nothing else stored — no account, no sync, no analytics.
 */

import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { LOCALES, type Locale } from '@/i18n/strings';
import { useColors, useLocale, useSettings, useT, useThemeMode } from '@/state/settings';
import { useFavourites } from '@/state/favorites';
import { useProgress } from '@/state/progress';
import { GhostButton, Label, PrimaryButton, Text, Touchable } from '@/ui/primitives';
import { alpha, radius, space } from '@/ui/theme';
import { loadRemoveAdsProduct, purchaseRemoveAds, restoreRemoveAds } from '@/monetization/billing';
import { useMonetization } from '@/state/monetization';

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
  const removeAds = useMonetization((state) => state.removeAds);
  const [productPrice, setProductPrice] = useState<string | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseFailed, setPurchaseFailed] = useState(false);
  const privacyPolicyUrl = (Constants.expoConfig?.extra as { privacyPolicyUrl?: string } | undefined)?.privacyPolicyUrl;

  useEffect(() => {
    let active = true;
    void loadRemoveAdsProduct().then((product) => {
      if (active && product?.displayPrice) setProductPrice(product.displayPrice);
    });
    return () => {
      active = false;
    };
  }, []);

  const handlePurchase = async () => {
    setPurchaseBusy(true);
    setPurchaseFailed(false);
    try {
      await purchaseRemoveAds();
      await restoreRemoveAds();
    } catch {
      setPurchaseFailed(true);
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handleRestore = async () => {
    setPurchaseBusy(true);
    setPurchaseFailed(false);
    try {
      await restoreRemoveAds();
    } catch {
      setPurchaseFailed(true);
    } finally {
      setPurchaseBusy(false);
    }
  };

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
          <Label>{t('settings.ads')}</Label>
          <View style={[styles.purchaseCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Ionicons name={removeAds ? 'checkmark-circle' : 'megaphone-outline'} size={22} color={removeAds ? colors.correct : ACCENT} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="heading">{removeAds ? t('settings.removeAdsPurchased') : t('settings.removeAds')}</Text>
              <Text variant="caption" color={colors.textFaint}>
                {t('settings.removeAdsHint')}
              </Text>
            </View>
          </View>
          {!removeAds ? (
            <PrimaryButton
              label={purchaseBusy ? t('settings.purchaseLoading') : productPrice ? `${t('settings.removeAds')} · ${productPrice}` : t('settings.removeAdsCta')}
              accent={ACCENT}
              onPress={() => void handlePurchase()}
              disabled={purchaseBusy}
            />
          ) : null}
          {!removeAds ? (
            <GhostButton label={t('settings.restorePurchases')} onPress={() => void handleRestore()} />
          ) : null}
          {purchaseFailed ? (
            <Text variant="caption" color={colors.wrong}>
              {t('settings.purchaseFailed')}
            </Text>
          ) : null}
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

        {privacyPolicyUrl ? (
          <Touchable onPress={() => void Linking.openURL(privacyPolicyUrl)} accessibilityRole="link">
            <Text variant="caption" color={ACCENT}>
              {t('settings.privacy')}
            </Text>
          </Touchable>
        ) : null}

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
  purchaseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  justified: { textAlign: 'justify', lineHeight: 20 },
});
