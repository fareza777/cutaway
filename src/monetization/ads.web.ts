// Google Mobile Ads is Android-only in Cutaway. Metro resolves this module
// for web previews without traversing the SDK's native view dependencies.
// Android continues to use ads.tsx, including consent and entitlement gates.
export async function initializeAds() { return false; }
export async function getLibraryBanner() { return null; }
export async function showAdPrivacyOptions() {}
export async function showInterstitialIfAllowed() {}
export async function showViewerExitInterstitial(_viewerStartedAt: number) {}
