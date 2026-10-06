import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLoader } from './lib/load-source.mjs';

function harness({ allowed = true, premium = false, hydrated = true, dev = false, platform = 'android', failConsent = false } = {}) {
  const calls = [];
  const state = {
    hydrated, removeAds: premium, lastInterstitialAt: null, shownThisSession: 0,
    privacyOptionsRequired: false,
    setPrivacyOptionsRequired(value) { this.privacyOptionsRequired = value; },
    recordInterstitial() {},
  };
  const info = { canRequestAds: allowed, status: allowed ? 'OBTAINED' : 'REQUIRED', privacyOptionsRequirementStatus: 'REQUIRED', isConsentFormAvailable: true };
  const api = {
    __esModule: true,
    default: () => ({ setRequestConfiguration: async () => calls.push('configuration'), initialize: async () => calls.push('initialize') }),
    MaxAdContentRating: { PG: 'PG' },
    AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' },
    AdsConsent: {
      gatherConsent: async () => { calls.push('consent'); if (failConsent) throw Error('offline'); return info; },
      getConsentInfo: async () => info,
      showPrivacyOptionsForm: async () => { calls.push('privacy-options'); return info; },
    },
    BannerAd: class BannerAd {},
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
    TestIds: { BANNER: 'test-banner', INTERSTITIAL: 'test-interstitial' },
  };
  const source = sourceLoader({
    'react-native': { Platform: { OS: platform } },
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: { admob: {
      bannerUnitId: 'ca-app-pub-6279186647593327/5209257311',
      interstitialUnitId: 'ca-app-pub-6279186647593327/7776650259',
    } } } } },
    '@/state/monetization': { useMonetization: { getState: () => state } },
    'react-native-google-mobile-ads': api,
  }, { __DEV__: dev });
  return { ads: source('src/monetization/ads.tsx'), calls, state, info };
}

test('SDK initialization waits for consent and skips unpaid eligibility that is not hydrated', async () => {
  const denied = harness({ allowed: false });
  assert.equal(await denied.ads.initializeAds(), false);
  assert.deepEqual(denied.calls, ['consent']);
  for (const fixture of [{ premium: true }, { hydrated: false }, { platform: 'web' }, { platform: 'ios' }]) {
    const h = harness(fixture);
    assert.equal(await h.ads.initializeAds(), false);
    assert.deepEqual(h.calls, []);
  }
});

test('concurrent banner preparation shares consent and initialization', async () => {
  const h = harness();
  assert.equal(typeof h.ads.getLibraryBanner, 'function', 'Native banner preparation is missing');
  const banners = await Promise.all([h.ads.getLibraryBanner(), h.ads.getLibraryBanner()]);
  assert.deepEqual(h.calls, ['consent', 'configuration', 'initialize']);
  for (const banner of banners) {
    assert.equal(banner.unitId, 'ca-app-pub-6279186647593327/5209257311');
    assert.equal(banner.size, 'ANCHORED_ADAPTIVE_BANNER');
  }
  assert.equal(h.state.privacyOptionsRequired, true);
});

test('development banner uses a test unit and denied consent never creates a banner', async () => {
  const h = harness({ dev: true });
  assert.equal(typeof h.ads.getLibraryBanner, 'function', 'Native banner preparation is missing');
  assert.equal((await h.ads.getLibraryBanner()).unitId, 'test-banner');
  assert.equal(await harness({ allowed: false }).ads.getLibraryBanner(), null);
  assert.equal(await harness({ allowed: false, failConsent: true }).ads.getLibraryBanner(), null);
});

test('changing privacy choices prevents subsequent banner requests without restarting', async () => {
  const h = harness();
  assert.equal(typeof h.ads.showAdPrivacyOptions, 'function', 'Privacy choices entry point is missing');
  await h.ads.getLibraryBanner();
  h.info.canRequestAds = false;
  await h.ads.showAdPrivacyOptions();
  assert.equal(await h.ads.getLibraryBanner(), null);
  assert.equal(h.calls.filter((call) => call === 'initialize').length, 1);
});
