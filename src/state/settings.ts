/**
 * User preferences. Currently just the theme, persisted alongside progress.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { palettes, readableAccent, type Palette, type ThemeMode } from '@/ui/theme';
import { translate, translateCategory, type Locale, type TranslationKey } from '@/i18n/strings';
import { DEFAULT_THEME_MODE } from './defaults';

type SettingsState = {
  mode: ThemeMode;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** False until the welcome flow has been seen or skipped. */
  onboarded: boolean;
  /** True once the persisted value has been read back from storage. */
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  completeOnboarding: () => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      mode: DEFAULT_THEME_MODE,
      locale: 'en',
      setLocale: (locale) => set({ locale }),
      onboarded: false,
      hydrated: false,
      setMode: (mode) => set({ mode }),
      toggleMode: () => set({ mode: get().mode === 'dark' ? 'light' : 'dark' }),
      completeOnboarding: () => set({ onboarded: true }),
    }),
    {
      name: 'cutaway.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ mode: state.mode, locale: state.locale, onboarded: state.onboarded }),
      // Storage is async, so the first render happens before the stored answer
      // arrives. Routing on `onboarded` before that would flash the welcome
      // flow at somebody who finished it months ago.
      onRehydrateStorage: () => () => useSettings.setState({ hydrated: true }),
    },
  ),
);

export function useThemeMode(): ThemeMode {
  return useSettings((state) => state.mode);
}

/** The active palette. Subscribing here is what re-colours a screen. */
export function useColors(): Palette {
  return palettes[useSettings((state) => state.mode)];
}

/** Foreground only: preserve the original accent for decorative fills. */
export function useReadableAccent(accent: string) {
  return readableAccent(accent, useThemeMode());
}

export function useLocale(): Locale {
  return useSettings((state) => state.locale);
}

/**
 * The translator, bound to the current locale.
 *
 * Returned as a function rather than a pre-built table so a screen can pass
 * values in — counts and names change per render and cannot live in a constant.
 */
export function useT() {
  const locale = useSettings((state) => state.locale);
  return (key: TranslationKey, values?: Record<string, string | number>) => translate(locale, key, values);
}

/** Category labels fall back to the content's own wording when untranslated. */
export function useCategoryLabel() {
  const locale = useSettings((state) => state.locale);
  return (category: string) => translateCategory(locale, category);
}
