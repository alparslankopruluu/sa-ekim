import { Ionicons } from '@expo/vector-icons';
import { I18nManager } from 'react-native';

import { colors } from '@/theme/tokens';

/** "Go forward" arrow that points along the reading direction (mirrors in RTL locales). */
export function Chevron({ size = 18, color = colors.textTertiary }: { size?: number; color?: string }) {
  return <Ionicons name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'} size={size} color={color} />;
}
