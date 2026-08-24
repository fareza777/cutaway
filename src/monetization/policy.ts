export const REMOVE_ADS_PRODUCT_ID = 'remove_ads';
export const REMOVE_ADS_PRICE_USD = 4.99;

/**
 * Ads are reserved for natural pauses: the library carries one anchored
 * banner, while an interstitial may appear after a completed quiz. The
 * cooldown and per-session cap keep exploration uninterrupted.
 */
export const AD_POLICY = {
  cooldownMs: 8 * 60 * 1000,
  maxPerSession: 2,
} as const;

export function shouldShowInterstitial({
  removeAds,
  now,
  lastShownAt,
  shownThisSession,
}: {
  removeAds: boolean;
  now: number;
  lastShownAt: number | null;
  shownThisSession: number;
}) {
  if (removeAds) return false;
  if (shownThisSession >= AD_POLICY.maxPerSession) return false;
  if (lastShownAt !== null && now - lastShownAt < AD_POLICY.cooldownMs) return false;
  return true;
}
