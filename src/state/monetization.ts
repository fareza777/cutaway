import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type MonetizationState = {
  removeAds: boolean;
  lastInterstitialAt: number | null;
  shownThisSession: number;
  markRemoveAds: () => void;
  recordInterstitial: (at: number) => void;
  resetForTest: () => void;
};

export const useMonetization = create<MonetizationState>()(
  persist(
    (set) => ({
      removeAds: false,
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
    },
  ),
);
