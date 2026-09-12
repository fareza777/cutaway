/** Banners belong to the library, never a hidden screen or the keyboard area. */
export function shouldMountLibraryBanner({ platform, hydrated, removeAds, active, keyboardVisible }: {
  platform: string;
  hydrated: boolean;
  removeAds: boolean;
  active: boolean;
  keyboardVisible: boolean;
}) {
  return platform === 'android' && hydrated && !removeAds && active && !keyboardVisible;
}

/**
 * A request that fails — a transient no-fill or a dropped connection — is asked
 * for again after a pause. Dropping the banner for the rest of the session is
 * what made it look like ads had disappeared.
 */
export const BANNER_RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000] as const;

export function bannerRetryDelayMs(attempt: number) {
  const index = Math.min(Math.max(Math.trunc(attempt), 0), BANNER_RETRY_DELAYS_MS.length - 1);
  return BANNER_RETRY_DELAYS_MS[index];
}
