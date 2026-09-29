/**
 * Small shared building blocks: header row, close button, section header,
 * list rows, badges, empty/error states, skeletons and the demo-mode banner.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { isMockBackend } from '@/services/backend';
import { colors, minTouch, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { PressableScale } from './PressableScale';

export function IconButton({
  icon,
  onPress,
  label,
  size = 22,
  style,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.iconButton, style]}
      testID={testID}
    >
      <Ionicons name={icon} size={size} color={colors.text} />
    </PressableScale>
  );
}

export function CloseButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const { t } = useTranslation();
  return <IconButton icon="close" onPress={onPress} label={t('a11y.close')} testID={testID ?? 'close-button'} />;
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="title2" accessibilityRole="header">
        {title}
      </AppText>
      {action ? (
        <PressableScale onPress={action.onPress} accessibilityLabel={action.label} style={styles.sectionAction}>
          <AppText variant="callout" color="primary">
            {action.label}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function Badge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'primary' | 'muted' }) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'primary' && { backgroundColor: colors.primary },
        tone === 'muted' && { backgroundColor: colors.surfaceHigh },
      ]}
    >
      <AppText variant="micro" color={tone === 'accent' ? 'textOnAccent' : 'text'}>
        {label}
      </AppText>
    </View>
  );
}

export function ListRow({
  icon,
  label,
  value,
  onPress,
  destructive,
  toggle,
  testID,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  toggle?: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean };
  testID?: string;
}) {
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={20} color={destructive ? colors.danger : colors.textSecondary} /> : null}
      <AppText variant="body" color={destructive ? 'danger' : 'text'} style={styles.rowLabel}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="callout" color="textTertiary" numberOfLines={1} style={styles.rowValue}>
          {value}
        </AppText>
      ) : null}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          disabled={toggle.disabled}
          trackColor={{ true: colors.primary, false: colors.surfacePressed }}
          accessibilityLabel={label}
          style={styles.switch}
        />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      ) : null}
    </>
  );
  if (onPress && !toggle) {
    return (
      <PressableScale onPress={onPress} pressedScale={0.99} style={styles.row} accessibilityLabel={label} testID={testID}>
        {content}
      </PressableScale>
    );
  }
  return (
    <View style={styles.row} testID={testID}>
      {content}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <AppText style={styles.emptyEmoji} accessibilityElementsHidden importantForAccessibility="no">
        {emoji}
      </AppText>
      <AppText variant="title2" align="center">
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {body}
      </AppText>
      {action ? <Button label={action.label} onPress={action.onPress} shine style={styles.emptyButton} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
      <AppText variant="body" color="textSecondary" align="center">
        {message}
      </AppText>
      <Button label={t('common.retry')} onPress={onRetry} variant="secondary" size="md" icon="refresh" />
    </View>
  );
}

/** Shimmering placeholder — skeletons instead of spinners (design polish bar). */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.9, { duration: 800 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.skeleton, animated, style]} accessibilityElementsHidden />;
}

export function DemoModeBanner() {
  const { t } = useTranslation();
  if (!isMockBackend) return null;
  return (
    <View style={styles.demo} accessibilityRole="text">
      <Ionicons name="flask-outline" size={16} color={colors.cyan} />
      <AppText variant="caption" color="textSecondary" style={styles.demoText}>
        {t('home.demoMode')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionAction: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: spacing.xs },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  row: {
    minHeight: minTouch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowLabel: { flex: 1 },
  rowValue: { maxWidth: '45%' },
  // RN's Switch defaults to alignSelf: 'flex-start', which overrides the row's centering.
  switch: { alignSelf: 'center' },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 56, lineHeight: 66 },
  emptyButton: { alignSelf: 'stretch', marginTop: spacing.sm },
  skeleton: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
  },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(61,245,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(61,245,255,0.25)',
  },
  demoText: { flex: 1 },
});
