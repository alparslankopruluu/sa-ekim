/**
 * SVG bar chart for the shed log. No axis numbers: bars are relative to the chart ceiling,
 * today is highlighted, the typical shedding window (days 15–56) is shaded behind the bars,
 * and a day with no entry shows a small dot (not a zero bar). Time runs toward the reading
 * direction (right in LTR, left in RTL).
 */
import { useState } from 'react';
import { I18nManager, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { colors, radius } from '@/theme/tokens';

import { barFraction, chartMax, type ShedDay } from './shedStats';

export interface ShedBarsProps {
  days: readonly ShedDay[];
  height: number;
  /** Compact variant (Today card): thinner gaps, no window shading label. */
  compact?: boolean;
  accessibilityLabel: string;
}

export function ShedBars({ days, height, compact = false, accessibilityLabel }: ShedBarsProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const ordered = I18nManager.isRTL ? [...days].reverse() : days;
  const max = chartMax(days);
  const slot = ordered.length > 0 ? width / ordered.length : 0;
  const gap = Math.min(compact ? 3 : 4, slot * 0.3);
  const barWidth = Math.max(1, slot - gap);
  const barRadius = Math.min(3, barWidth / 2);

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ordered.map((day, index) =>
            day.inWindow ? (
              <Rect
                key={`w-${day.date}`}
                x={index * slot}
                y={0}
                width={slot + 0.5}
                height={height}
                fill={colors.sage}
                opacity={0.08}
              />
            ) : null,
          )}
          {ordered.map((day, index) => {
            const x = index * slot + gap / 2;
            if (day.count === null) {
              return (
                <Circle
                  key={day.date}
                  cx={x + barWidth / 2}
                  cy={height - 2}
                  r={1.5}
                  fill={day.isToday ? colors.primary : colors.strokeStrong}
                />
              );
            }
            const barHeight = Math.max(2, barFraction(day.count, max) * (height - 4));
            return (
              <Rect
                key={day.date}
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx={barRadius}
                fill={day.isToday ? colors.primary : day.inWindow ? colors.sage : colors.textTertiary}
                opacity={day.isToday ? 1 : 0.8}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.xs, overflow: 'hidden' },
});
