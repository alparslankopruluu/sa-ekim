import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { useFeedback } from '@/hooks/useFeedback';
import { colors, gradients, radius, spacing } from '@/theme/tokens';

export interface WheelItem {
  value: number;
  label: string;
}

export interface DateWheelProps {
  items: readonly WheelItem[];
  value: number;
  onChange: (value: number) => void;
  /** Column name for screen readers ("Day", "Month", "Year"). */
  label: string;
  testID?: string;
}

export const WHEEL_ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PAD = WHEEL_ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

/**
 * One numeric wheel built from RN primitives: a snapping ScrollView with a fixed selection
 * band. Scroll, tap a row, or use the screen reader's increment/decrement actions. No native
 * date-picker dependency, so it looks and behaves the same on iOS, Android and web.
 */
export function DateWheel({ items, value, onChange, label, testID }: DateWheelProps) {
  const feedback = useFeedback();
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );
  const [liveIndex, setLiveIndex] = useState(selectedIndex);
  // Index the user last reached by scrolling; programmatic scrolls skip it to avoid fighting a drag.
  const fromScroll = useRef(selectedIndex);

  const scrollTo = useCallback((index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated });
  }, []);

  useEffect(() => {
    if (fromScroll.current === selectedIndex) return;
    fromScroll.current = selectedIndex;
    setLiveIndex(selectedIndex);
    // Layout must exist first (initial mount and month-length changes).
    const id = setTimeout(() => scrollTo(selectedIndex, false), 0);
    return () => clearTimeout(id);
  }, [scrollTo, selectedIndex]);

  useEffect(() => {
    const id = setTimeout(() => scrollTo(selectedIndex, false), 0);
    return () => clearTimeout(id);
    // Initial position only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(
    (index: number) => {
      const clamped = Math.min(items.length - 1, Math.max(0, index));
      const item = items[clamped];
      if (!item) return;
      if (fromScroll.current !== clamped) feedback.selection();
      fromScroll.current = clamped;
      setLiveIndex(clamped);
      if (item.value !== value) onChange(item.value);
    },
    [feedback, items, onChange, value],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT);
      const clamped = Math.min(items.length - 1, Math.max(0, index));
      if (clamped !== fromScroll.current) commit(clamped);
    },
    [commit, items.length],
  );

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.min(items.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT)));
      commit(index);
      // Native scroll views snap by themselves; the web one does not.
      if (Platform.OS === 'web') scrollTo(index, true);
    },
    [commit, items.length, scrollTo],
  );

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
      const next = Math.min(items.length - 1, Math.max(0, selectedIndex + delta));
      scrollTo(next, true);
      commit(next);
    },
    [commit, items.length, scrollTo, selectedIndex],
  );

  const current = items[selectedIndex];
  const rows = useMemo(
    () =>
      items.map((item, index) => {
        const distance = Math.abs(index - liveIndex);
        return (
          <Pressable
            key={item.value}
            style={styles.row}
            onPress={() => {
              scrollTo(index, true);
              commit(index);
            }}
            accessible={false}
          >
            <AppText
              variant={distance === 0 ? 'title2' : 'body'}
              color={distance === 0 ? 'text' : 'textTertiary'}
              style={{ opacity: distance === 0 ? 1 : distance === 1 ? 0.7 : 0.38 }}
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      }),
    [commit, items, liveIndex, scrollTo],
  );

  return (
    <View
      style={styles.wheel}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: current?.label ?? '' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      testID={testID}
    >
      <View style={styles.band} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={settle}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        nestedScrollEnabled
      >
        {rows}
      </ScrollView>
      <LinearGradient
        pointerEvents="none"
        colors={[gradients.fadeBottom[1], gradients.fadeBottom[0]]}
        style={[styles.fade, styles.fadeTop]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[gradients.fadeBottom[0], gradients.fadeBottom[1]]}
        style={[styles.fade, styles.fadeBottom]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: { flex: 1, height: WHEEL_ITEM_HEIGHT * VISIBLE_ROWS, overflow: 'hidden' },
  band: {
    position: 'absolute',
    top: PAD,
    start: spacing.xs,
    end: spacing.xs,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  content: { paddingVertical: PAD },
  row: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', start: 0, end: 0, height: PAD },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
});
