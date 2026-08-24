import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColors, useSettings, useThemeMode } from '@/state/settings';
import { initializeAds } from '@/monetization/ads';
import { disposeBilling, initializeBilling } from '@/monetization/billing';

// Hold the native splash until the stored settings are back. Without this the
// app paints its first frame against whatever the window background happens to
// be — the grey flash — and then jumps again once the theme is known.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colors = useColors();
  const mode = useThemeMode();
  const hydrated = useSettings((state) => state.hydrated);
  const onboarded = useSettings((state) => state.onboarded);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!hydrated) return;
    void SplashScreen.hideAsync();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void initializeAds();
    void initializeBilling();
    return () => {
      void disposeBilling();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const onWelcome = segments[0] === 'welcome';
    if (!onboarded && !onWelcome) router.replace('/welcome');
    if (onboarded && onWelcome) router.replace('/');
  }, [hydrated, onboarded, router, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'fade_from_bottom',
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
