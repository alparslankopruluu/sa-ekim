import type { Ionicons } from '@expo/vector-icons';

import type { Goal, Stage } from '@shared/catalog';

import type { PaletteKey } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

export const GOAL_ICON: Record<Goal, IconName> = {
  hairline: 'scan-outline',
  crown: 'ellipse-outline',
  part: 'git-branch-outline',
  brows: 'eye-outline',
  beard: 'man-outline',
};

export const GOAL_PALETTE: Record<Goal, PaletteKey> = {
  hairline: 'copper',
  crown: 'gold',
  part: 'sage',
  brows: 'rose',
  beard: 'ink',
};

export const STAGE_ICON: Record<Stage, IconName> = {
  researching: 'search-outline',
  planned: 'calendar-outline',
  done: 'checkmark-circle-outline',
};
