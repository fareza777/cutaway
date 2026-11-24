export const REMOVE_ADS_PRODUCT_ID = 'remove_ads';
export const REMOVE_ADS_PRICE_USD = 4.99;

/**
 * Full-screen ads are reserved for natural transitions: leaving a 3D viewer
 * back to the library (the app's busiest transition) and, as a minor extra,
 * leaving a finished quiz. Only every Nth transition is eligible, a client
 * cooldown separates impressions, and nothing is shown during the launch grace
 * period or while the user is interacting with a model. AdMob's own frequency
 * cap (3 impressions / 10 minutes) remains the outer limit.
 */
export const AD_POLICY = {
  /** Minimum time between two full-screen ads, measured client-side. */
  cooldownMs: 75 * 1000,
  /** Sanity ceiling per app session; AdMob's frequency cap is the real limit. */
  maxPerSession: 12,
  /** A transition only counts after this much time in the viewer. */
  viewerMinDurationMs: 10 * 1000,
  /** Show on every Nth eligible transition (2 = the 2nd, 4th, 6th…). */
  transitionsPerAd: 2,
  /** No full-screen ad in the first part of a session (never on launch). */
  launchGraceMs: 60 * 1000,
  /** Length of the ad-free break earned from a rewarded ad. */
  rewardedAdFreeMs: 30 * 60 * 1000,
} as const;

/** Retry delays after an interstitial or rewarded ad fails to load. */
export const FULLSCREEN_RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000] as const;

export function fullscreenRetryDelayMs(attempt: number) {
  const index = Math.min(Math.max(Math.trunc(attempt), 0), FULLSCREEN_RETRY_DELAYS_MS.length - 1);
  return FULLSCREEN_RETRY_DELAYS_MS[index];
}

export function shouldShowInterstitial({
  removeAds,
  now,
  lastShownAt,
  shownThisSession,
  sessionStartedAt = null,
  adFreeUntil = null,
}: {
  removeAds: boolean;
  now: number;
  lastShownAt: number | null;
  shownThisSession: number;
  sessionStartedAt?: number | null;
  adFreeUntil?: number | null;
}) {
  if (removeAds) return false;
  if (adFreeUntil !== null && now < adFreeUntil) return false;
  if (sessionStartedAt !== null && now - sessionStartedAt < AD_POLICY.launchGraceMs) return false;
  if (shownThisSession >= AD_POLICY.maxPerSession) return false;
  if (lastShownAt !== null && now - lastShownAt < AD_POLICY.cooldownMs) return false;
  return true;
}

/** A transition is eligible on every Nth count (1-based count after increment). */
export function isEligibleTransition(transitionCount: number) {
  return transitionCount > 0 && transitionCount % AD_POLICY.transitionsPerAd === 0;
}

export function shouldShowViewerExitInterstitial({
  removeAds,
  now,
  viewerStartedAt,
  lastShownAt,
  shownThisSession,
  sessionStartedAt = null,
  adFreeUntil = null,
}: {
  removeAds: boolean;
  now: number;
  viewerStartedAt: number;
  lastShownAt: number | null;
  shownThisSession: number;
  sessionStartedAt?: number | null;
  adFreeUntil?: number | null;
}) {
  if (now - viewerStartedAt < AD_POLICY.viewerMinDurationMs) return false;
  return shouldShowInterstitial({ removeAds, now, lastShownAt, shownThisSession, sessionStartedAt, adFreeUntil });
}

/** The ad-free offer is about ads, so buyers never see it. */
export function shouldOfferAdFreeBreak({ removeAds, now, adFreeUntil }: { removeAds: boolean; now: number; adFreeUntil: number | null }) {
  if (removeAds) return false;
  return adFreeUntil === null || now >= adFreeUntil;
}
