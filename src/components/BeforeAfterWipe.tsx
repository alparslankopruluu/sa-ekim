import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { type AccessibilityActionEvent, type LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors, glows, radius, spacing } from '@/theme/tokens';
import { springs } from '@/theme/motion';

import { AppText } from './AppText';

export interface BeforeAfterWipeProps {
  /** Image shown on the left of the divider (the "before"). */
  beforeUri: string;
  /** Image shown on the right of the divider (the "after"). */
  afterUri: string;
  beforeLabel: string;
  afterLabel: string;
  /** Height of the frame; the width fills the parent. */
  height?: number;
  /** Initial divider position, 0..1 from the left edge (default 0.5). */
  initial?: number;
  /** Optional small mark drawn bottom-end over the after image (e.g. the free watermark). */
  mark?: string;
  /** Blur the after image (locked state for free users). */
  lockedAfter?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
  onPositionChange?: (fraction: number) => void;
}

const HANDLE = 44;
const KEY_STEP = 0.1;

/**
 * Before/after wipe slider. The divider is physical (left = before, right = after) in every
 * language, so the picture reads the same in RTL. Drag, tap, or use the accessibility
 * increment/decrement actions. All motion runs on the UI thread.
 */
export function BeforeAfterWipe({
  beforeUri,
  afterUri,
  beforeLabel,
  afterLabel,
  height = 420,
  initial = 0.5,
  mark,
  lockedAfter = false,
  accessibilityLabel,
  style,
  onPositionChange,
}: BeforeAfterWipeProps) {
  const [width, setWidth] = useState(0);
  const fraction = useSharedValue(clamp(initial, 0, 1));

  const notify = useCallback(
    (value: number) => {
      onPositionChange?.(value);
    },
    [onPositionChange],
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      if (width > 0) {
        fraction.set(clamp(event.x / width, 0, 1));
      }
    })
    .onUpdate((event) => {
      if (width > 0) fraction.set(clamp(event.x / width, 0, 1));
    })
    .onEnd(() => {
      scheduleOnRN(notify, fraction.get());
    });

  const beforeWidth = useAnimatedStyle(() => ({ width: width * fraction.get() }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: width * fraction.get() - HANDLE / 2 }],
  }));
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: width * fraction.get() - 1 }] }));

  const onLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const delta = event.nativeEvent.actionName === 'increment' ? KEY_STEP : -KEY_STEP;
      const next = clamp(fraction.get() + delta, 0, 1);
      fraction.set(withSpring(next, springs.snappy));
      notify(next);
    },
    [fraction, notify],
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={onLayout}
        style={[styles.frame, { height }, style]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
      >
        {/* "Before" fills the frame; "after" is revealed from the left up to the divider. */}
        <Image source={{ uri: afterUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={lockedAfter ? 40 : 0} />
        <Animated.View style={[styles.beforeClip, beforeWidth]} pointerEvents="none">
          <Image
            source={{ uri: beforeUri }}
            style={[styles.beforeImage, { width }]}
            contentFit="cover"
          />
        </Animated.View>

        <Animated.View style={[styles.line, lineStyle]} pointerEvents="none" />
        <Animated.View style={[styles.handle, handleStyle]} pointerEvents="none">
          <View style={styles.grip} />
          <View style={styles.grip} />
        </Animated.View>

        <View style={[styles.tag, styles.tagStart]} pointerEvents="none">
          <AppText variant="micro" color="textOnAccent">
            {beforeLabel}
          </AppText>
        </View>
        <View style={[styles.tag, styles.tagEnd]} pointerEvents="none">
          <AppText variant="micro" color="textOnAccent">
            {afterLabel}
          </AppText>
        </View>
        {mark ? (
          <View style={styles.mark} pointerEvents="none">
            <AppText variant="micro" color="textOnAccent">
              {mark}
            </AppText>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  // The clip grows from the left; it shows the "before" image, anchored to the frame's left.
  beforeClip: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
  beforeImage: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  line: { position: 'absolute', top: 0, bottom: 0, width: 2, left: 0, backgroundColor: colors.textOnAccent },
  handle: {
    position: 'absolute',
    top: '50%',
    marginTop: -HANDLE / 2,
    left: 0,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    boxShadow: glows.primary,
  },
  grip: { width: 2, height: 16, borderRadius: 1, backgroundColor: colors.textOnAccent },
  tag: {
    position: 'absolute',
    top: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  tagStart: { left: spacing.md },
  tagEnd: { right: spacing.md },
  mark: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
});
