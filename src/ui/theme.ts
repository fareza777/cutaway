/**
 * Two palettes, one shape.
 *
 * Layout, spacing and type never change with the theme — only colour does. So
 * `StyleSheet.create` keeps everything structural (which is what makes it worth
 * using) and colour is applied inline from `useColors()`. Styles created at
 * module scope capture their values once, which is exactly why colours cannot
 * live in them if they are to change at runtime.
 */

import { Platform } from 'react-native';

export type ThemeMode = 'dark' | 'light';

export type Palette = {
  bg: string;
  surface: string;
  surfaceHigh: string;
  surfacePressed: string;
  hairline: string;
  hairlineStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  correct: string;
  wrong: string;
  /** Background of a sheet or panel floating over the 3D view. */
  scrim: string;
  /** Background of a control floating over the 3D view. */
  floating: string;
};

const dark: Palette = {
  bg: '#07090D',
  surface: '#101319',
  surfaceHigh: '#171B24',
  surfacePressed: '#1E2430',
  hairline: 'rgba(255,255,255,0.09)',
  hairlineStrong: 'rgba(255,255,255,0.16)',
  text: '#F3F6FB',
  textMuted: '#98A2B4',
  textFaint: '#5C6577',
  correct: '#3ED598',
  wrong: '#FF5B5B',
  scrim: 'rgba(11,14,19,0.97)',
  floating: 'rgba(16,19,25,0.92)',
};

const light: Palette = {
  // Not pure white: a hair of warmth stops the large flat areas glaring, and
  // gives the 3D stage something for a metal object to sit against.
  bg: '#F4F5F8',
  surface: '#FFFFFF',
  surfaceHigh: '#EDEFF3',
  surfacePressed: '#E2E5EB',
  hairline: 'rgba(16,20,28,0.10)',
  hairlineStrong: 'rgba(16,20,28,0.20)',
  text: '#12161D',
  textMuted: '#5A6474',
  textFaint: '#8B94A3',
  correct: '#0E9F6E',
  wrong: '#D8443C',
  scrim: 'rgba(255,255,255,0.97)',
  floating: 'rgba(255,255,255,0.94)',
};

export const palettes: Record<ThemeMode, Palette> = { dark, light };

/** The dark palette, for the few places that cannot use the hook. */
export const colors = dark;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const type = {
  display: { fontSize: 30, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.35 },
  heading: { fontSize: 16, lineHeight: 21, fontWeight: '600' as const, letterSpacing: -0.15 },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.8 },
} as const;

export const mono = Platform.select({ android: 'monospace', default: 'Menlo' });

/** `hex` at `alpha` — for accent tints without a colour library. */
export function alpha(hex: string, value: number) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${value})`;
}

/**
 * An accent tuned for legibility against the current background.
 *
 * The object accents are chosen to glow on near-black. On a light background
 * the pale ones — the smartphone's cyan especially — turn to mush against
 * white, so they are darkened until they carry text again.
 */
export function readableAccent(hex: string, mode: ThemeMode) {
  if (mode === 'dark') return hex;
  const clean = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  if (luminance <= 0.5) return hex;
  const scale = 0.5 / luminance;
  return `#${rgb.map((c) => Math.round(c * scale).toString(16).padStart(2, '0')).join('')}`;
}
