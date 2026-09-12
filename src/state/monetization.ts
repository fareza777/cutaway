import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type MonetizationState = {
  hydrated: boolean;
  removeAds: boolean;
  privacyOptionsRequired: boolean;
  setPrivacyOptionsRequired: (required: boolean) => void;
  lastInterstitialAt: number | null;
  shownThisSession: number;
  markRemoveAds: () => void;
  recordInterstitial: (at: number) => void;
  resetForTest: () => void;
};

export const useMonetization = create<MonetizationState>()(
  persist(
    (set) => ({
      hydrated: false,
      removeAds: false,
      privacyOptionsRequired: false,
      setPrivacyOptionsRequired: (required) => set({ privacyOptionsRequired: required }),
      lastInterstitialAt: null,
      shownThisSession: 0,

      markRemoveAds: () => set({ removeAds: true }),

      recordInterstitial: (at) =>
        set((state) => ({
          lastInterstitialAt: at,
          shownThisSession: state.shownThisSession + 1,
        })),

      resetForTest: () => set({ removeAds: false, lastInterstitialAt: null, shownThisSession: 0 }),
    }),
    {
      name: 'cutaway.monetization.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // The purchase entitlement persists. Frequency limits intentionally do
      // not, so a fresh app session starts with a clean ad budget.
      partialize: (state) => ({ removeAds: state.removeAds }),
      onRehydrateStorage: () => () => useMonetization.setState({ hydrated: true }),
    },
  ),
);
