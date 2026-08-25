import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { useMonetization } from '@/state/monetization';
import { AD_POLICY, shouldShowInterstitial, shouldShowViewerExitInterstitial } from './policy';

type AdsApi = typeof import('react-native-google-mobile-ads');

let adsApi: AdsApi | null = null;
let adsApiPromise: Promise<AdsApi | null> | null = null;
let adsInitialization: Promise<boolean> | null = null;

async function getAdsApi() {
  if (Platform.OS === 'web') return null;
  adsApiPromise ??= import('react-native-google-mobile-ads')
    .then((module) => {
      adsApi = module;
      return module;
    })
    .catch((error) => {
      console.warn('Google Mobile Ads is unavailable right now.', error);
      return null;
    });
  return adsApiPromise;
}

function extraConfig() {
  return (Constants.expoConfig?.extra as
    | { admob?: { interstitialUnitId?: string } }
    | undefined)?.admob;
}

function unitId(api: AdsApi) {
  if (__DEV__) return api.TestIds.INTERSTITIAL;
  const configured = extraConfig();
  return configured?.interstitialUnitId ?? api.TestIds.INTERSTITIAL;
}

export async function initializeAds() {
  const api = await getAdsApi();
  if (!api) return false;
  if (adsInitialization) return adsInitialization;

  adsInitialization = (async () => {
    const instance = api.default();
    await instance.setRequestConfiguration({
      maxAdContentRating: api.MaxAdContentRating.PG,
      testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
    });
    await instance.initialize();
    return true;
  })().catch((error) => {
    adsInitialization = null;
    console.warn('Google Mobile Ads could not initialize.', error);
    return false;
  });

  return adsInitialization;
}

export async function showInterstitialIfAllowed() {
  const now = Date.now();
  const state = useMonetization.getState();
  if (
    !shouldShowInterstitial({
      removeAds: state.removeAds,
      now,
      lastShownAt: state.lastInterstitialAt,
      shownThisSession: state.shownThisSession,
    })
  ) {
    return false;
  }

  const api = await getAdsApi();
  if (!api) return false;
  await initializeAds();

  const interstitial = api.InterstitialAd.createForAdRequest(unitId(api), {
    requestNonPersonalizedAdsOnly: true,
  });

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const cleanup: Array<() => void> = [];
    const timeout = setTimeout(() => finish(false), 12_000);

    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup.forEach((unsubscribe) => unsubscribe());
      resolve(shown);
    };

    cleanup.push(interstitial.addAdEventListener(api.AdEventType.CLOSED, () => finish(true)));
    cleanup.push(interstitial.addAdEventListener(api.AdEventType.ERROR, () => finish(false)));
    const loaded = interstitial.addAdEventListener(api.AdEventType.LOADED, () => {
      useMonetization.getState().recordInterstitial(Date.now());
      void interstitial.show().catch(() => finish(false));
    });
    cleanup.push(loaded);
    interstitial.load();
  });
}

export async function showViewerExitInterstitial(viewerStartedAt: number) {
  const now = Date.now();
  const state = useMonetization.getState();
  if (
    !shouldShowViewerExitInterstitial({
      removeAds: state.removeAds,
      now,
      viewerStartedAt,
      lastShownAt: state.lastInterstitialAt,
      shownThisSession: state.shownThisSession,
    })
  ) {
    return false;
  }
  return showInterstitialIfAllowed();
}
