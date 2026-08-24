import assert from 'node:assert/strict';

import { AD_POLICY, shouldShowInterstitial } from '../src/monetization/policy.ts';

type Case = { name: string; run: () => void };

const cases: Case[] = [
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
];

for (const testCase of cases) {
  testCase.run();
  console.log(`✓ ${testCase.name}`);
}

console.log(`${cases.length} monetization policy tests passed`);
