/**
 * Kök design tokens — Apple system design language (HIG "Color" + "Typography").
 *
 * Values are Apple's iOS semantic system colors (light and dark appearances) and the SF Pro
 * type ramp (Large Title 34 · Title 1 28 · Title 2 22 · Headline 17 semibold · Body 17 ·
 * Callout 16 · Footnote 13). Layout follows the grouped style of Health/Settings: a grouped
 * background, elevated white (or #1C1C1E) cards, separators instead of heavy borders, one
 * tint colour (systemBlue) for actions, systemGreen for growth.
 *
 * The appearance follows the device (like Apple's apps). It is read once at launch, so every
 * StyleSheet stays static; a change of system appearance applies on the next launch.
 * Screens use these tokens only (no raw colors/spacing — AGENTS.md §4). Decision D-016.
 */
import { Appearance } from 'react-native';

import type { StyleDef } from '@shared/catalog';

export type Scheme = 'light' | 'dark';

export const scheme: Scheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
export const isDark = scheme === 'dark';

/** Apple iOS system colors. Names on the right are the UIKit/SwiftUI semantic names. */
const LIGHT = {
  bg: '#F2F2F7', // systemGroupedBackground
  bgElevated: '#FFFFFF', // secondarySystemGroupedBackground
  surface: '#FFFFFF', // secondarySystemGroupedBackground (cards)
  surfaceHigh: '#F2F2F7', // tertiarySystemGroupedBackground / systemGray6 (inset wells)
  surfacePressed: '#E5E5EA', // systemGray5
  stroke: 'rgba(60,60,67,0.12)', // separator (hairline strength)
  strokeStrong: 'rgba(60,60,67,0.29)', // separator
  scrim: 'rgba(0,0,0,0.4)',
  text: '#000000', // label
  textSecondary: 'rgba(60,60,67,0.6)', // secondaryLabel
  textTertiary: 'rgba(60,60,67,0.46)', // between tertiaryLabel and secondaryLabel (legible at 13 pt)
  textOnAccent: '#FFFFFF',
  primary: '#007AFF', // systemBlue
  primaryPressed: '#0062CC',
  accent: '#FF9500', // systemOrange
  sage: '#248A3D', // systemGreen, accessible (text-safe on white)
  sageDeep: '#34C759', // systemGreen (fills)
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30', // systemRed
  transparent: 'transparent',
} as const;

const DARK: { [K in keyof typeof LIGHT]: string } = {
  bg: '#000000', // systemGroupedBackground (dark)
  bgElevated: '#1C1C1E',
  surface: '#1C1C1E', // secondarySystemGroupedBackground
  surfaceHigh: '#2C2C2E', // tertiarySystemGroupedBackground
  surfacePressed: '#3A3A3C', // systemGray4
  stroke: 'rgba(84,84,88,0.36)',
  strokeStrong: 'rgba(84,84,88,0.65)', // separator (dark)
  scrim: 'rgba(0,0,0,0.6)',
  text: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.6)',
  textTertiary: 'rgba(235,235,245,0.42)',
  textOnAccent: '#FFFFFF',
  primary: '#0A84FF',
  primaryPressed: '#0071E3',
  accent: '#FF9F0A',
  sage: '#30D158',
  sageDeep: '#30D158',
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  transparent: 'transparent',
};

export const colors: { readonly [K in keyof typeof LIGHT]: string } = isDark ? DARK : LIGHT;

export type ColorToken = keyof typeof LIGHT;

export type PaletteKey = StyleDef['palette'];

/** Two-stop gradients keyed by the palette a preview style declares (Apple system hues). */
export const palettes: Record<PaletteKey, readonly [string, string]> = {
  copper: ['#FFB340', '#FF9500'], // systemOrange
  sage: ['#5CD67F', '#34C759'], // systemGreen
  gold: ['#FFD60A', '#FFCC00'], // systemYellow
  rose: ['#FF6482', '#FF2D55'], // systemPink
  ink: ['#7D7AFF', '#5856D6'], // systemIndigo
};

export const gradients = {
  hero: ['#5AC8FA', '#007AFF', '#5856D6'] as const, // teal → blue → indigo
  cta: [isDark ? '#1A8FFF' : '#1A88FF', colors.primary] as const,
  gold: ['#FFB340', '#FF9500'] as const,
  sage: ['#5CD67F', '#34C759'] as const,
  stage: [colors.bg, colors.bg] as const,
  glass: isDark
    ? (['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)'] as const)
    : (['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)'] as const),
  fadeBottom: isDark
    ? (['rgba(0,0,0,0)', 'rgba(0,0,0,0.94)'] as const)
    : (['rgba(242,242,247,0)', 'rgba(242,242,247,0.96)'] as const),
  /** Fade a wheel/list edge into the grouped background. */
  edgeFade: isDark ? (['rgba(0,0,0,0)', '#000000'] as const) : (['rgba(255,255,255,0)', '#FFFFFF'] as const),
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

/** iOS continuous-corner feel: grouped cells 10–12, cards 16–20, sheets 28. */
export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** SF Pro is the system font: no custom font family on purpose. */
export const fonts = {} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 }, // Large Title
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 }, // Title 1
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 }, // Title 2
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 }, // Headline
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 }, // Body
  bodyStrong: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 }, // Callout
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 }, // Footnote
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase' }, // Caption 1, section header
} as const;

export type TypographyVariant = keyof typeof typography;

/** Soft Apple-style elevation (RN `boxShadow`, New Architecture). */
export const glows = isDark
  ? {
      primary: '0px 6px 18px rgba(10,132,255,0.35)',
      gold: '0px 6px 18px rgba(255,159,10,0.3)',
      sage: '0px 6px 18px rgba(48,209,88,0.3)',
      soft: '0px 8px 24px rgba(0,0,0,0.6)',
    }
  : {
      primary: '0px 6px 16px rgba(0,122,255,0.28)',
      gold: '0px 6px 16px rgba(255,149,0,0.25)',
      sage: '0px 6px 16px rgba(52,199,89,0.25)',
      soft: '0px 4px 16px rgba(0,0,0,0.08)',
    };

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/** Minimum interactive size (HIG default 44pt). */
export const minTouch = 44;

export const layout = {
  screenPadding: spacing.lg,
  maxContentWidth: 560,
  tabBarClearance: 96,
} as const;
