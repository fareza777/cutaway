// Google Mobile Ads is Android-only in Cutaway. Metro resolves this module
// for web previews without traversing the SDK's native view dependencies.
// Android continues to use ads.tsx, including consent and entitlement gates.
export async function initializeAds() { return false; }
export async function getLibraryBanner() { return null; }
export async function showAdPrivacyOptions() {}
export async function showInterstitialIfAllowed() { return false; }
export async function showViewerExitInterstitial(_viewerStartedAt: number) { return false; }
export async function showTransitionInterstitial() { return false; }
export function isRewardedReady() { return false; }
export function subscribeRewardedReady(listener: (ready: boolean) => void) { listener(false); return () => {}; }
export async function showRewardedAd() { return false; }
export async function watchAdForAdFreeBreak() { return false; }
