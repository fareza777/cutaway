import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_THEME_MODE } from '../src/state/defaults.ts';

import {
  AD_POLICY,
  fullscreenRetryDelayMs,
  isEligibleTransition,
  shouldOfferAdFreeBreak,
  shouldShowInterstitial,
  shouldShowViewerExitInterstitial,
} from '../src/monetization/policy.ts';
import { bannerRetryDelayMs, shouldMountLibraryBanner } from '../src/monetization/banner-policy.ts';

type Case = { name: string; run: () => void };

const cases: Case[] = [
  {
    name: 'starts new installations in light mode',
    run: () => {
      assert.equal(DEFAULT_THEME_MODE, 'light');
      const settings = readFileSync(new URL('../src/state/settings.ts', import.meta.url), 'utf8');
      assert.match(settings, /mode:\s*DEFAULT_THEME_MODE/);
    },
  },
  {
    name: 'library banner eligibility is independent of the full-screen ad cap',
    run: () => {
      assert.equal(shouldShowInterstitial({ removeAds: false, now: 1000, lastShownAt: null, shownThisSession: AD_POLICY.maxPerSession }), false);
      assert.equal(shouldMountLibraryBanner({ platform: 'android', hydrated: true, removeAds: false, active: true, keyboardVisible: false }), true);
    },
  },
  {
    name: 'retries a failed library banner instead of dropping it for the session',
    run: () => {
      assert.equal(bannerRetryDelayMs(0), 30_000);
      assert.ok(bannerRetryDelayMs(1) > bannerRetryDelayMs(0), 'a repeated failure must back off');
      assert.equal(bannerRetryDelayMs(40), bannerRetryDelayMs(41), 'the pause must stay capped');
      const banner = readFileSync(new URL('../src/monetization/LibraryBanner.tsx', import.meta.url), 'utf8');
      assert.match(banner, /bannerRetryDelayMs\(attempt\)/, 'A failed request must schedule another one');
      assert.match(banner, /onAdFailedToLoad=\{\(error\)/, 'The failure reason must be read, not discarded');
    },
  },
  {
    name: 'shows the first interstitial at a natural break',
    run: () => {
      assert.equal(
        shouldShowInterstitial({
          removeAds: false,
          now: 10_000,
          lastShownAt: null,
          shownThisSession: 0,
        }),
        true,
      );
    },
  },
  {
    name: 'never shows an interstitial after remove-ads is purchased',
    run: () => {
      assert.equal(
        shouldShowInterstitial({
          removeAds: true,
          now: 10_000,
          lastShownAt: null,
          shownThisSession: 0,
        }),
        false,
      );
    },
  },
  {
    name: 'enforces the cooldown between interstitials',
    run: () => {
      assert.equal(
        shouldShowInterstitial({
          removeAds: false,
          now: 10_000 + AD_POLICY.cooldownMs - 1,
          lastShownAt: 10_000,
          shownThisSession: 1,
        }),
        false,
      );
      assert.equal(
        shouldShowInterstitial({
          removeAds: false,
          now: 10_000 + AD_POLICY.cooldownMs,
          lastShownAt: 10_000,
          shownThisSession: 1,
        }),
        true,
      );
    },
  },
  {
    name: 'caps the number of interstitials in one session',
    run: () => {
      assert.equal(
        shouldShowInterstitial({
          removeAds: false,
          now: 10_000 + AD_POLICY.cooldownMs * 3,
          lastShownAt: 10_000,
          shownThisSession: AD_POLICY.maxPerSession,
        }),
        false,
      );
    },
  },
  {
    name: 'does not interrupt a short viewer session when leaving',
    run: () => {
      assert.equal(
        shouldShowViewerExitInterstitial({
          removeAds: false,
          now: 10_000 + AD_POLICY.viewerMinDurationMs - 1,
          viewerStartedAt: 10_000,
          lastShownAt: null,
          shownThisSession: 0,
        }),
        false,
      );
    },
  },
  {
    name: 'allows a viewer exit interstitial after a meaningful session',
    run: () => {
      assert.equal(
        shouldShowViewerExitInterstitial({
          removeAds: false,
          now: 10_000 + AD_POLICY.viewerMinDurationMs,
          viewerStartedAt: 10_000,
          lastShownAt: null,
          shownThisSession: 0,
        }),
        true,
      );
    },
  },
  {
    name: 'keeps the client cooldown between 60 and 90 seconds',
    run: () => {
      assert.ok(AD_POLICY.cooldownMs >= 60_000 && AD_POLICY.cooldownMs <= 90_000);
    },
  },
  {
    name: 'never shows an interstitial during the launch grace period',
    run: () => {
      const base = { removeAds: false, lastShownAt: null, shownThisSession: 0, sessionStartedAt: 1_000 };
      assert.equal(shouldShowInterstitial({ ...base, now: 1_000 + AD_POLICY.launchGraceMs - 1 }), false);
      assert.equal(shouldShowInterstitial({ ...base, now: 1_000 + AD_POLICY.launchGraceMs }), true);
    },
  },
  {
    name: 'only every Nth natural transition is an ad break',
    run: () => {
      const eligible = Array.from({ length: 6 }, (_value, index) => isEligibleTransition(index + 1));
      assert.deepEqual(eligible, [false, true, false, true, false, true]);
      assert.equal(isEligibleTransition(0), false);
    },
  },
  {
    name: 'an earned ad-free break suppresses interstitials until it ends',
    run: () => {
      const base = { removeAds: false, lastShownAt: null, shownThisSession: 0 };
      assert.equal(shouldShowInterstitial({ ...base, now: 5_000, adFreeUntil: 10_000 }), false);
      assert.equal(shouldShowInterstitial({ ...base, now: 10_000, adFreeUntil: 10_000 }), true);
      assert.equal(AD_POLICY.rewardedAdFreeMs, 30 * 60 * 1000);
    },
  },
  {
    name: 'the ad-free offer is hidden from buyers and during an active break',
    run: () => {
      assert.equal(shouldOfferAdFreeBreak({ removeAds: true, now: 0, adFreeUntil: null }), false);
      assert.equal(shouldOfferAdFreeBreak({ removeAds: false, now: 0, adFreeUntil: null }), true);
      assert.equal(shouldOfferAdFreeBreak({ removeAds: false, now: 5, adFreeUntil: 10 }), false);
      assert.equal(shouldOfferAdFreeBreak({ removeAds: false, now: 10, adFreeUntil: 10 }), true);
    },
  },
  {
    name: 'full-screen ad loads retry with a capped backoff',
    run: () => {
      assert.equal(fullscreenRetryDelayMs(0), 15_000);
      assert.ok(fullscreenRetryDelayMs(1) > fullscreenRetryDelayMs(0));
      assert.equal(fullscreenRetryDelayMs(50), fullscreenRetryDelayMs(51));
      const ads = readFileSync(new URL('../src/monetization/ads.tsx', import.meta.url), 'utf8');
      assert.match(ads, /preloadInterstitial\(api\)/, 'Interstitials must be preloaded');
      assert.match(ads, /EARNED_REWARD/, 'A reward is granted only when earned');
    },
  },
  {
    name: 'ad personalization follows UMP consent instead of being forced off',
    run: () => {
      for (const file of ['../src/monetization/ads.tsx', '../src/monetization/LibraryBanner.tsx']) {
        const source = readFileSync(new URL(file, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /requestNonPersonalizedAdsOnly:\s*true/, file);
      }
      const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
      assert.equal(app.expo.extra.privacyPolicyUrl, 'https://fareza777.github.io/cutaway/privacy-policy.html');
    },
  },
  {
    name: 'quiz completion no longer triggers an interstitial on the result screen',
    run: () => {
      const quiz = readFileSync(new URL('../app/quiz/[id].tsx', import.meta.url), 'utf8');
      assert.doesNotMatch(quiz, /showInterstitialIfAllowed/);
    },
  },
];

for (const testCase of cases) {
  testCase.run();
  console.log(`✓ ${testCase.name}`);
}

console.log(`${cases.length} monetization policy tests passed`);
