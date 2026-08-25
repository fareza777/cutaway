import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_THEME_MODE } from '../src/state/defaults.ts';

import { AD_POLICY, shouldShowInterstitial, shouldShowViewerExitInterstitial } from '../src/monetization/policy.ts';

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
    name: 'does not render banner ads anywhere in the app',
    run: () => {
      for (const file of ['../app/index.tsx', '../app/object/[id].tsx', '../src/monetization/ads.tsx']) {
        const source = readFileSync(new URL(file, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /\bAdBanner\b/);
      }
      const appConfig = readFileSync(new URL('../app.json', import.meta.url), 'utf8');
      assert.doesNotMatch(appConfig, /bannerUnitId/);
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
];

for (const testCase of cases) {
  testCase.run();
  console.log(`✓ ${testCase.name}`);
}

console.log(`${cases.length} monetization policy tests passed`);
