import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMonetization } from '@/state/monetization';
import { useColors } from '@/state/settings';
import { space } from '@/ui/theme';
import { useScreenActive } from '@/ui/useScreenActive';
import { bannerRetryDelayMs, shouldMountLibraryBanner } from './banner-policy';
import { getLibraryBanner } from './ads';

const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };

export function LibraryBanner({ keyboardVisible }: { keyboardVisible: boolean }) {
  const active = useScreenActive();
  const hydrated = useMonetization((state) => state.hydrated);
  const removeAds = useMonetization((state) => state.removeAds);
  if (!shouldMountLibraryBanner({ platform: Platform.OS, hydrated, removeAds, active, keyboardVisible })) return null;
  return <NativeLibraryBanner />;
}

function NativeLibraryBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [banner, setBanner] = useState<Awaited<ReturnType<typeof getLibraryBanner>>>(null);
  const [waiting, setWaiting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let active = true;
    void getLibraryBanner()
      .then((result) => { if (active) setBanner(result); })
      .catch((error) => { if (active) console.warn('The library banner could not be prepared.', error); });
    return () => { active = false; };
  }, []);
  useEffect(() => () => { if (retry.current) clearTimeout(retry.current); }, []);
  if (!banner || waiting) return null;
  const Banner = banner.Component;

  const scheduleRetry = () => {
    setWaiting(true);
    if (retry.current) clearTimeout(retry.current);
    retry.current = setTimeout(() => {
      retry.current = null;
      setAttempt((value) => value + 1);
      setWaiting(false);
    }, bannerRetryDelayMs(attempt));
  };

  return (
    <View style={[styles.slot, { backgroundColor: colors.surface, borderColor: colors.hairline, paddingBottom: insets.bottom + space.sm }]}>
      <View style={styles.ad}>
        <Banner
          key={attempt}
          unitId={banner.unitId}
          size={banner.size}
          width={Math.floor(width - insets.left - insets.right)}
          requestOptions={REQUEST_OPTIONS}
          onAdFailedToLoad={(error) => {
            console.warn('The library banner did not load.', error);
            scheduleRetry();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, alignItems: 'center' },
  ad: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
});
