import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type MonetizationState = {
  hydrated: boolean;
  removeAds: boolean;
  privacyOptionsRequired: boolean;
  setPrivacyOptionsRequired: (required: boolean) => void;
  /** When this app process started; full-screen ads wait out a grace period. */
  sessionStartedAt: number;
  lastInterstitialAt: number | null;
  shownThisSession: number;
  /** Natural transitions (viewer → library, quiz → back) seen this session. */
  transitionCount: number;
  /** End of an ad-free break earned from a rewarded ad (persisted). */
  adFreeUntil: number | null;
  markRemoveAds: () => void;
  recordInterstitial: (at: number) => void;
  recordTransition: () => number;
  grantAdFree: (until: number) => void;
  resetForTest: () => void;
};

export const useMonetization = create<MonetizationState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      removeAds: false,
      privacyOptionsRequired: false,
      setPrivacyOptionsRequired: (required) => set({ privacyOptionsRequired: required }),
      sessionStartedAt: Date.now(),
      lastInterstitialAt: null,
      shownThisSession: 0,
      transitionCount: 0,
      adFreeUntil: null,

      markRemoveAds: () => set({ removeAds: true }),

      recordInterstitial: (at) =>
        set((state) => ({
          lastInterstitialAt: at,
          shownThisSession: state.shownThisSession + 1,
        })),

      recordTransition: () => {
        const next = get().transitionCount + 1;
        set({ transitionCount: next });
        return next;
      },

      grantAdFree: (until) => set({ adFreeUntil: until }),

      resetForTest: () =>
        set({ removeAds: false, lastInterstitialAt: null, shownThisSession: 0, transitionCount: 0, adFreeUntil: null }),
    }),
    {
      name: 'cutaway.monetization.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // The purchase entitlement and an earned ad-free break persist. Frequency
      // limits intentionally do not, so a fresh session starts clean.
      partialize: (state) => ({ removeAds: state.removeAds, adFreeUntil: state.adFreeUntil }),
      onRehydrateStorage: () => () => useMonetization.setState({ hydrated: true }),
    },
  ),
);
