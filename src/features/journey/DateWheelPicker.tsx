import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { IsoDate } from '@shared/timeline';

import { AppText } from '@/components/AppText';
import { useFeedback } from '@/hooks/useFeedback';
import { currentLocaleTag } from '@/lib/i18n';
import { colors, radius, spacing } from '@/theme/tokens';

import {
  clampIso,
  type DateField,
  dateFieldOrder,
  daysInMonth,
  monthLabels,
  parseIso,
  toIso,
  yearRange,
} from './dateWheel';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

interface WheelItem {
  key: string;
  label: string;
}

function WheelColumn({
  items,
  index,
  onIndexChange,
  accessibilityLabel,
  flex,
}: {
  items: readonly WheelItem[];
  index: number;
  onIndexChange: (next: number) => void;
  accessibilityLabel: string;
  flex: number;
}) {
  const ref = useRef<ScrollView>(null);
  const reported = useRef(index);
  const feedback = useFeedback();
  const max = items.length - 1;

  // Follow external changes (clamped day, min/max window, a new value from the parent).
  useEffect(() => {
    if (index !== reported.current) {
      reported.current = index;
      ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    }
  }, [index]);

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.min(max, Math.max(0, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
      if (next !== reported.current) {
        reported.current = next;
        feedback.selection();
        onIndexChange(next);
      }
    },
    [feedback, max, onIndexChange],
  );

  const jump = useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(0, next));
      if (clamped === reported.current) return;
      reported.current = clamped;
      ref.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
      feedback.selection();
      onIndexChange(clamped);
    },
    [feedback, max, onIndexChange],
  );

  return (
    <View
      style={{ flex }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[index]?.label ?? '' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => jump(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={32}
        onLayout={() => ref.current?.scrollTo({ y: reported.current * ITEM_HEIGHT, animated: false })}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: PAD }}
        importantForAccessibility="no-hide-descendants"
      >
        {items.map((item, i) => (
          <Pressable key={item.key} onPress={() => jump(i)} style={styles.item} accessible={false}>
            <AppText
              variant={i === index ? 'headline' : 'body'}
              color={Math.abs(i - index) === 0 ? 'text' : Math.abs(i - index) === 1 ? 'textSecondary' : 'textTertiary'}
              numberOfLines={1}
              align="center"
            >
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export interface DateWheelPickerProps {
  value: IsoDate;
  onChange: (next: IsoDate) => void;
  minDate?: IsoDate;
  maxDate?: IsoDate;
  /** Years offered before/after `anchorYear` (defaults: the year of `value`). */
  yearsBack?: number;
  yearsForward?: number;
  anchorYear?: number;
  /** Background colour (7-character hex) the top/bottom fades blend into. */
  fadeColor?: string;
  labels: { day: string; month: string; year: string };
  locale?: string;
}

/**
 * Three-wheel date picker (day · month · year, in the locale's order). Controlled: it clamps
 * impossible days (Feb 31) and the optional min/max window, and reports a valid ISO date.
 * Screen-reader users adjust each wheel with increment/decrement.
 */
export function DateWheelPicker({
  value,
  onChange,
  minDate,
  maxDate,
  yearsBack = 3,
  yearsForward = 2,
  anchorYear,
  fadeColor = colors.surface,
  labels,
  locale = currentLocaleTag(),
}: DateWheelPickerProps) {
  const parts = parseIso(value);
  const baseYear = anchorYear ?? parts.year;
  const years = useMemo(() => {
    const from = minDate ? parseIso(minDate).year : baseYear - yearsBack;
    const to = maxDate ? parseIso(maxDate).year : baseYear + yearsForward;
    return yearRange(from, 0, Math.max(0, to - from));
  }, [baseYear, maxDate, minDate, yearsBack, yearsForward]);
  const months = useMemo(() => monthLabels(locale), [locale]);
  const order = useMemo(() => dateFieldOrder(locale), [locale]);

  const dayItems = useMemo<WheelItem[]>(
    () => Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => ({ key: String(i + 1), label: String(i + 1) })),
    [parts.month, parts.year],
  );
  const monthItems = useMemo<WheelItem[]>(() => months.map((label, i) => ({ key: String(i + 1), label })), [months]);
  const yearItems = useMemo<WheelItem[]>(() => years.map((y) => ({ key: String(y), label: String(y) })), [years]);

  const emit = useCallback(
    (next: { year: number; month: number; day: number }) => {
      onChange(clampIso(toIso(next.year, next.month, next.day), minDate, maxDate));
    },
    [maxDate, minDate, onChange],
  );

  const columns: Record<DateField, { items: WheelItem[]; index: number; onIndexChange: (i: number) => void; label: string; flex: number }> = {
    day: {
      items: dayItems,
      index: Math.min(dayItems.length - 1, parts.day - 1),
      onIndexChange: (i) => emit({ ...parts, day: i + 1 }),
      label: labels.day,
      flex: 0.8,
    },
    month: {
      items: monthItems,
      index: parts.month - 1,
      onIndexChange: (i) => emit({ ...parts, month: i + 1 }),
      label: labels.month,
      flex: 1.5,
    },
    year: {
      items: yearItems,
      index: Math.max(0, years.indexOf(parts.year)),
      onIndexChange: (i) => emit({ ...parts, year: years[i] ?? parts.year }),
      label: labels.year,
      flex: 1,
    },
  };

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.highlight} />
      <View style={styles.row}>
        {order.map((field) => {
          const column = columns[field];
          return (
            <WheelColumn
              key={field}
              items={column.items}
              index={column.index}
              onIndexChange={column.onIndexChange}
              accessibilityLabel={column.label}
              flex={column.flex}
            />
          );
        })}
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={[fadeColor, `${fadeColor}00`]}
        style={[styles.fade, styles.fadeTop]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`${fadeColor}00`, fadeColor]}
        style={[styles.fade, styles.fadeBottom]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: ITEM_HEIGHT * VISIBLE_ROWS, justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.xs },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  highlight: {
    position: 'absolute',
    start: 0,
    end: 0,
    top: PAD,
    height: ITEM_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
  },
  fade: { position: 'absolute', start: 0, end: 0, height: PAD - 4 },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
});
