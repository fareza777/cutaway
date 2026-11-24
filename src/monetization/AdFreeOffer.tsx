import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useMonetization } from '@/state/monetization';
import { useColors, useT } from '@/state/settings';
import { Text, Touchable } from '@/ui/primitives';
import { alpha, radius, space } from '@/ui/theme';
import { watchAdForAdFreeBreak } from './ads';
import { shouldOfferAdFreeBreak } from './policy';
import { useRewardedReady } from './useRewardedReady';

const ACCENT = '#FF9F45';

/**
 * Opt-in rewarded placement: the user chooses to watch one ad in exchange for
 * a 30-minute break from full-screen ads. Remove-ads buyers never see it, and
 * it only appears once an ad is ready, so tapping it never leads to a spinner.
 */
export function AdFreeOffer({ showActive = false }: { showActive?: boolean }) {
  const colors = useColors();
  const t = useT();
  const hydrated = useMonetization((state) => state.hydrated);
  const removeAds = useMonetization((state) => state.removeAds);
  const adFreeUntil = useMonetization((state) => state.adFreeUntil);
  const ready = useRewardedReady();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Re-check once a minute so an expired break brings the offer back.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (Platform.OS !== 'android' || !hydrated || removeAds) return null;

  const offer = shouldOfferAdFreeBreak({ removeAds, now, adFreeUntil });
  if (!offer) {
    if (!showActive || adFreeUntil === null) return null;
    const until = new Date(adFreeUntil);
    const time = `${String(until.getHours()).padStart(2, '0')}:${String(until.getMinutes()).padStart(2, '0')}`;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <Ionicons name="checkmark-circle" size={22} color={colors.correct} />
        <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
          {t('ads.adFreeActive', { time })}
        </Text>
      </View>
    );
  }
  if (!ready && !failed) return null;

  const onWatch = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const earned = await watchAdForAdFreeBreak();
      if (!earned) setFailed(true);
      setNow(Date.now());
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: alpha(ACCENT, 0.07), borderColor: alpha(ACCENT, 0.24) }]}>
      <Ionicons name="play-circle-outline" size={24} color={colors.text} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading">{t('ads.adFreeTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {failed && !ready ? t('ads.rewardUnavailable') : t('ads.adFreeHint')}
        </Text>
      </View>
      {ready ? (
        <Touchable
          onPress={() => void onWatch()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('ads.watchAd')}
          style={[styles.button, { backgroundColor: colors.text }]}
        >
          <Text variant="caption" color={colors.bg}>
            {t('ads.watchAd')}
          </Text>
        </Touchable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: { paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill },
});
