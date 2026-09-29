import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { colors, minTouch, radius, spacing } from '@/theme/tokens';
import { springs } from '@/theme/motion';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface SegmentedTabsProps<T extends string> {
  tabs: readonly { id: T; label: string; badge?: string }[];
  value: T;
  onChange: (id: T) => void;
}

/** Segmented control with a spring-driven highlight that follows the selection. */
export function SegmentedTabs<T extends string>({ tabs, value, onChange }: SegmentedTabsProps<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === value));
  const segment = tabs.length ? width / tabs.length : 0;

  const indicator = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withSpring(index * segment, springs.snappy) }],
  }));

  return (
    <View
      style={styles.track}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width - 8)}
      accessibilityRole="tablist"
    >
      {width > 0 ? <Animated.View style={[styles.indicator, indicator]} /> : null}
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <PressableScale
            key={tab.id}
            onPress={() => onChange(tab.id)}
            haptic="selection"
            pressedScale={0.98}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            style={styles.tab}
            testID={`tab-${tab.id}`}
          >
            <AppText variant="callout" color={selected ? 'text' : 'textSecondary'} numberOfLines={1}>
              {tab.label}
            </AppText>
            {tab.badge ? (
              <View style={styles.badge}>
                <AppText variant="micro" color="textOnAccent">
                  {tab.badge}
                </AppText>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePressed,
  },
  tab: {
    flex: 1,
    minHeight: minTouch - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
