import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { useMonetization } from '@/state/monetization';
import {
  AD_POLICY,
  fullscreenRetryDelayMs,
  isEligibleTransition,
  shouldShowInterstitial,
  shouldShowViewerExitInterstitial,
} from './policy';

type AdsApi = typeof import('react-native-google-mobile-ads');
type InterstitialInstance = ReturnType<AdsApi['InterstitialAd']['createForAdRequest']>;
type RewardedInstance = ReturnType<AdsApi['RewardedAd']['createForAdRequest']>;

// Consent decides what Google may do; the app keeps requesting
// non-personalized ads, as stated in the privacy policy.
const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };

let adsApi: AdsApi | null = null;
let adsApiPromise: Promise<AdsApi | null> | null = null;
let adsInitialization: Promise<boolean> | null = null;
let consentInitialization: Promise<Awaited<ReturnType<AdsApi['AdsConsent']['getConsentInfo']>>> | null = null;

async function getAdsApi() {
  if (Platform.OS !== 'android') return null;
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

type AdmobExtra = { interstitialUnitId?: string; bannerUnitId?: string; rewardedUnitId?: string };

function extraConfig() {
  return (Constants.expoConfig?.extra as { admob?: AdmobExtra } | undefined)?.admob;
}

/** Debug builds always use Google's test units; release builds never do. */
function interstitialUnitId(api: AdsApi) {
  if (__DEV__) return api.TestIds.INTERSTITIAL;
  return extraConfig()?.interstitialUnitId ?? null;
}

function rewardedUnitId(api: AdsApi) {
  if (__DEV__) return api.TestIds.REWARDED;
  const configured = extraConfig()?.rewardedUnitId;
  // A placeholder must never reach a real request.
  return configured && configured.startsWith('ca-app-pub-') ? configured : null;
}

function adsBlocked() {
  return useMonetization.getState().removeAds;
}

export async function initializeAds() {
  const state = useMonetization.getState();
  if (!state.hydrated || state.removeAds) return false;
  const api = await getAdsApi();
  if (!api) return false;
  try {
    // A single consent flow per launch, shared by every ad format.
    consentInitialization ??= api.AdsConsent.gatherConsent().catch(() => api.AdsConsent.getConsentInfo());
    const consent = await consentInitialization;
    useMonetization.getState().setPrivacyOptionsRequired(
      consent.privacyOptionsRequirementStatus === api.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    );
    if (!consent.canRequestAds || useMonetization.getState().removeAds) return false;
  } catch {
    consentInitialization = null;
    return false;
  }
  if (adsInitialization) return adsInitialization;

  adsInitialization = (async () => {
    const instance = api.default();
    await instance.setRequestConfiguration({
      maxAdContentRating: api.MaxAdContentRating.PG,
      testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
    });
    await instance.initialize();
    // Full-screen formats are loaded ahead of time so a natural break can show
    // one instantly instead of making the user wait on a network request.
    preloadInterstitial(api);
    preloadRewarded(api);
    return true;
  })().catch((error) => {
    adsInitialization = null;
    console.warn('Google Mobile Ads could not initialize.', error);
    return false;
  });

  return adsInitialization;
}

/** The SDK component is only imported on supported, consent-ready devices. */
export async function getLibraryBanner() {
  if (!(await initializeAds()) || adsBlocked()) return null;
  const api = await getAdsApi();
  if (!api) return null;
  const bannerUnitId = __DEV__ ? api.TestIds.BANNER : extraConfig()?.bannerUnitId;
  if (!bannerUnitId) return null;
  return { Component: api.BannerAd, size: api.BannerAdSize.ANCHORED_ADAPTIVE_BANNER, unitId: bannerUnitId };
}

export async function showAdPrivacyOptions() {
  const api = await getAdsApi();
  if (!api) return;
  const consent = await api.AdsConsent.showPrivacyOptionsForm();
  consentInitialization = Promise.resolve(consent);
  useMonetization.getState().setPrivacyOptionsRequired(
    consent.privacyOptionsRequirementStatus === api.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  );
}

// ------------------------------------------------------------ interstitial

let interstitial: InterstitialInstance | null = null;
let interstitialReady = false;
let interstitialLoading = false;
let interstitialShowing = false;
let interstitialAttempt = 0;
let interstitialRetry: ReturnType<typeof setTimeout> | null = null;

function scheduleInterstitialRetry(api: AdsApi) {
  if (interstitialRetry) return;
  const delay = fullscreenRetryDelayMs(interstitialAttempt);
  interstitialAttempt += 1;
  interstitialRetry = setTimeout(() => {
    interstitialRetry = null;
    preloadInterstitial(api);
  }, delay);
}

function preloadInterstitial(api: AdsApi) {
  if (adsBlocked() || interstitialReady || interstitialLoading || interstitialShowing) return;
  if (!api.InterstitialAd) return;
  const id = interstitialUnitId(api);
  if (!id) return;
  try {
    const ad = api.InterstitialAd.createForAdRequest(id, REQUEST_OPTIONS);
    interstitial = ad;
    interstitialLoading = true;
    ad.addAdEventListener(api.AdEventType.LOADED, () => {
      interstitialLoading = false;
      interstitialReady = true;
      interstitialAttempt = 0;
    });
    ad.addAdEventListener(api.AdEventType.ERROR, () => {
      interstitialLoading = false;
      interstitialReady = false;
      interstitialShowing = false;
      scheduleInterstitialRetry(api);
    });
    ad.addAdEventListener(api.AdEventType.CLOSED, () => {
      interstitialShowing = false;
      interstitialReady = false;
      // The next one starts loading as soon as this one is dismissed.
      preloadInterstitial(api);
    });
    ad.load();
  } catch (error) {
    interstitialLoading = false;
    console.warn('The interstitial could not be prepared.', error);
    scheduleInterstitialRetry(api);
  }
}

/** Shows the preloaded interstitial if policy allows; never waits on a load. */
export async function showInterstitialIfAllowed() {
  const now = Date.now();
  const state = useMonetization.getState();
  if (
    !shouldShowInterstitial({
      removeAds: state.removeAds,
      now,
      lastShownAt: state.lastInterstitialAt,
      shownThisSession: state.shownThisSession,
      sessionStartedAt: state.sessionStartedAt,
      adFreeUntil: state.adFreeUntil,
    })
  ) {
    return false;
  }
  return presentInterstitial();
}

async function presentInterstitial() {
  const api = await getAdsApi();
  if (!api) return false;
  if (!(await initializeAds()) || adsBlocked()) return false;
  const ad = interstitial;
  if (!ad || !interstitialReady || interstitialShowing) {
    preloadInterstitial(api);
    return false;
  }
  interstitialShowing = true;
  interstitialReady = false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      closed();
      failed();
      resolve(shown);
    };
    const closed = ad.addAdEventListener(api.AdEventType.CLOSED, () => finish(true));
    const failed = ad.addAdEventListener(api.AdEventType.ERROR, () => finish(false));
    useMonetization.getState().recordInterstitial(Date.now());
    ad.show().catch(() => {
      interstitialShowing = false;
      preloadInterstitial(api);
      finish(false);
    });
  });
}

/**
 * Leaving a viewer back to the library. Every transition is counted, and only
 * every Nth one (after a meaningful viewing session) may show an ad.
 */
export async function showViewerExitInterstitial(viewerStartedAt: number) {
  const now = Date.now();
  if (now - viewerStartedAt < AD_POLICY.viewerMinDurationMs) return false;
  const state = useMonetization.getState();
  if (state.removeAds) return false;
  const count = state.recordTransition();
  if (!isEligibleTransition(count)) return false;
  const latest = useMonetization.getState();
  if (
    !shouldShowViewerExitInterstitial({
      removeAds: latest.removeAds,
      now,
      viewerStartedAt,
      lastShownAt: latest.lastInterstitialAt,
      shownThisSession: latest.shownThisSession,
      sessionStartedAt: latest.sessionStartedAt,
      adFreeUntil: latest.adFreeUntil,
    })
  ) {
    return false;
  }
  return presentInterstitial();
}

/** Any other natural transition (leaving a finished quiz) shares the counter. */
export async function showTransitionInterstitial() {
  const state = useMonetization.getState();
  if (state.removeAds) return false;
  const count = state.recordTransition();
  if (!isEligibleTransition(count)) return false;
  return showInterstitialIfAllowed();
}

// ---------------------------------------------------------------- rewarded

let rewarded: RewardedInstance | null = null;
let rewardedReady = false;
let rewardedLoading = false;
let rewardedShowing = false;
let rewardedAttempt = 0;
let rewardedRetry: ReturnType<typeof setTimeout> | null = null;
const rewardedListeners = new Set<(ready: boolean) => void>();

function setRewardedReady(ready: boolean) {
  rewardedReady = ready;
  rewardedListeners.forEach((listener) => listener(ready));
}

function scheduleRewardedRetry(api: AdsApi) {
  if (rewardedRetry) return;
  const delay = fullscreenRetryDelayMs(rewardedAttempt);
  rewardedAttempt += 1;
  rewardedRetry = setTimeout(() => {
    rewardedRetry = null;
    preloadRewarded(api);
  }, delay);
}

function preloadRewarded(api: AdsApi) {
  if (rewardedReady || rewardedLoading || rewardedShowing) return;
  if (!api.RewardedAd || !api.RewardedAdEventType) return;
  const id = rewardedUnitId(api);
  if (!id) return;
  try {
    const ad = api.RewardedAd.createForAdRequest(id, REQUEST_OPTIONS);
    rewarded = ad;
    rewardedLoading = true;
    ad.addAdEventListener(api.RewardedAdEventType.LOADED, () => {
      rewardedLoading = false;
      rewardedAttempt = 0;
      setRewardedReady(true);
    });
    ad.addAdEventListener(api.AdEventType.ERROR, () => {
      rewardedLoading = false;
      rewardedShowing = false;
      setRewardedReady(false);
      scheduleRewardedRetry(api);
    });
    ad.addAdEventListener(api.AdEventType.CLOSED, () => {
      rewardedShowing = false;
      setRewardedReady(false);
      preloadRewarded(api);
    });
    ad.load();
  } catch (error) {
    rewardedLoading = false;
    console.warn('The rewarded ad could not be prepared.', error);
    scheduleRewardedRetry(api);
  }
}

export function isRewardedReady() {
  return rewardedReady;
}

/** Subscribes to rewarded readiness so an offer appears only when it can play. */
export function subscribeRewardedReady(listener: (ready: boolean) => void) {
  rewardedListeners.add(listener);
  listener(rewardedReady);
  if (!rewardedReady) {
    void getAdsApi().then((api) => {
      if (api && adsInitialization) preloadRewarded(api);
    });
  }
  return () => {
    rewardedListeners.delete(listener);
  };
}

/**
 * Plays the preloaded rewarded ad. Resolves true only when the user earned the
 * reward; closing early or a failure resolves false and the caller grants
 * nothing.
 */
export async function showRewardedAd(): Promise<boolean> {
  const api = await getAdsApi();
  if (!api) return false;
  if (!(await initializeAds())) return false;
  const ad = rewarded;
  if (!ad || !rewardedReady || rewardedShowing) {
    preloadRewarded(api);
    return false;
  }
  rewardedShowing = true;
  setRewardedReady(false);
  return new Promise<boolean>((resolve) => {
    let earned = false;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      resolve(earned);
    };
    const unsubscribeEarned = ad.addAdEventListener(api.RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    const unsubscribeClosed = ad.addAdEventListener(api.AdEventType.CLOSED, finish);
    const unsubscribeError = ad.addAdEventListener(api.AdEventType.ERROR, finish);
    ad.show().catch(() => {
      rewardedShowing = false;
      preloadRewarded(api);
      finish();
    });
  });
}

/** Rewarded placement: a 30-minute break from full-screen ads. */
export async function watchAdForAdFreeBreak() {
  if (adsBlocked()) return false;
  const earned = await showRewardedAd();
  if (earned) useMonetization.getState().grantAdFree(Date.now() + AD_POLICY.rewardedAdFreeMs);
  return earned;
}
