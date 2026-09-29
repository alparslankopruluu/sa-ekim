/**
 * Kök design tokens — "Warm Clinic Noir".
 * Personality: calm, warm, reassuring and precise — a night-stand companion, not a beauty
 * filter. Deep espresso surfaces, copper (hair) as the action colour, sage for growth and
 * "you are on track", gold for highlights. Screens use these tokens only (no raw
 * colors/spacing — AGENTS.md §4). Dark-only by decision D-007 (see docs/decisions.md).
 */
import type { StyleDef } from '@shared/catalog';

export const colors = {
  bg: '#0D0A08',
  bgElevated: '#151009',
  surface: '#1D1710',
  surfaceHigh: '#2A2118',
  surfacePressed: '#362A1E',
  stroke: 'rgba(255,244,230,0.09)',
  strokeStrong: 'rgba(255,244,230,0.2)',
  scrim: 'rgba(13,10,8,0.74)',
  text: '#FBF6EF',
  textSecondary: 'rgba(251,246,239,0.76)',
  textTertiary: 'rgba(251,246,239,0.56)',
  textOnAccent: '#1A0F07',
  primary: '#E89A5B',
  primaryPressed: '#CC7F42',
  accent: '#F4CE86',
  sage: '#8FD3B0',
  sageDeep: '#3F7D63',
  success: '#7FD6A5',
  warning: '#F2B45A',
  danger: '#F0736B',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;

export type PaletteKey = StyleDef['palette'];

/** Two-stop gradients keyed by the palette a preview style declares in the shared catalog. */
export const palettes: Record<PaletteKey, readonly [string, string]> = {
  copper: ['#F2B27A', '#B4682F'],
  sage: ['#8FD3B0', '#2F6B52'],
  gold: ['#F8E0A8', '#C9973F'],
  rose: ['#F2A6A0', '#8A4A5C'],
  ink: ['#6E5B4A', '#241B14'],
};

export const gradients = {
  hero: ['#F8E0A8', '#E89A5B', '#B4682F'] as const,
  cta: ['#F2B27A', '#DA8248'] as const,
  gold: ['#F8E0A8', '#E9B85E'] as const,
  sage: ['#8FD3B0', '#4C9A78'] as const,
  stage: ['#261A12', '#0D0A08'] as const,
  glass: ['rgba(255,244,230,0.14)', 'rgba(255,244,230,0.04)'] as const,
  fadeBottom: ['rgba(13,10,8,0)', 'rgba(13,10,8,0.94)'] as const,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** DM Serif Display (OFL) — one weight, used only for display/title; body is the system font. */
export const fonts = {
  display: 'DMSerifDisplay-Regular',
  displayItalic: 'DMSerifDisplay-Italic',
} as const;

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, letterSpacing: -0.4 },
  title1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  title2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.1 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Cross-platform glows via the RN `boxShadow` style (New Architecture). */
export const glows = {
  primary: '0px 10px 28px rgba(232, 154, 91, 0.38)',
  gold: '0px 8px 24px rgba(244, 206, 134, 0.34)',
  sage: '0px 8px 24px rgba(143, 211, 176, 0.32)',
  soft: '0px 12px 32px rgba(0, 0, 0, 0.5)',
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/** Minimum interactive size (HIG default 44pt). */
export const minTouch = 44;

export const layout = {
  screenPadding: spacing.xl,
  maxContentWidth: 520,
  tabBarClearance: 96,
} as const;
