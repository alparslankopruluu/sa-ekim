import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { Goal } from '@shared/catalog';
import { maturationMonthsFor } from '@shared/catalog';
import type { PhaseId } from '@shared/timeline';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { bandGeometry, dotPosition } from '@/lib/phaseView';
import { easings } from '@/theme/motion';
import { colors, radius, spacing } from '@/theme/tokens';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface PhaseBandChartProps {
  /** Day index for the "you are here" dot; null hides it (no date yet, or before the operation). */
  day: number | null;
  goal: Goal;
  /** Phase the day falls in (only used for the text alternative). */
  phaseId?: PhaseId | null;
  height?: number;
  /** Free tier: softly blurred with a lock chip; the whole chart opens the paywall. */
  locked?: boolean;
  onLockedPress?: () => void;
}

/**
 * The expected-phase band ("typical range — individual results vary"): a smooth, unlabeled
 * band with a "you are here" dot. Illustrative shape from `BAND_ANCHORS`, never a prediction,
 * deliberately without numbers on the axis.
 */
export function PhaseBandChart({ day, goal, phaseId, height = 148, locked = false, onLockedPress }: PhaseBandChartProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const rawId = useId();
  const uid = rawId.replace(/[^A-Za-z0-9]/g, '');
  const [width, setWidth] = useState(0);

  const geometry = useMemo(() => (width > 0 ? bandGeometry({ width, height, goal }) : null), [width, height, goal]);
  const dot = geometry && day !== null && day >= 0 ? dotPosition(geometry, day) : null;

  const reveal = useSharedValue(0);
  const dotOpacity = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (width <= 0) return;
    if (reduceMotion) {
      reveal.set(width);
      dotOpacity.set(1);
      pulse.set(0);
      return;
    }
    reveal.set(0);
    dotOpacity.set(0);
    reveal.set(withTiming(width, { duration: 1100, easing: easings.standard }));
    dotOpacity.set(withDelay(800, withTiming(1, { duration: 320 })));
    pulse.set(withDelay(1200, withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1)));
    return () => {
      cancelAnimation(reveal);
      cancelAnimation(dotOpacity);
      cancelAnimation(pulse);
    };
  }, [width, reduceMotion, reveal, dotOpacity, pulse]);

  const clipProps = useAnimatedProps(() => ({ width: reveal.value }));
  const coreProps = useAnimatedProps(() => ({ opacity: dotOpacity.value }));
  const haloProps = useAnimatedProps(() => ({ r: 9 + pulse.value * 5, opacity: dotOpacity.value * (0.34 - pulse.value * 0.26) }));

  const phaseTitle = phaseId ? t(`guide.${phaseId}.title`) : null;
  const label = locked
    ? t('journey.band.a11yLocked')
    : phaseTitle
      ? t('journey.band.a11y', { phase: phaseTitle })
      : t('journey.band.a11yNone');
  const months = maturationMonthsFor(goal);

  const chart = (
    <View
      style={[styles.chart, { height }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))}
    >
      {geometry ? (
        <Svg width={geometry.width} height={geometry.height}>
          <Defs>
            <LinearGradient id={`fill${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.sage} stopOpacity={0.6} />
              <Stop offset="1" stopColor={colors.sageDeep} stopOpacity={0.14} />
            </LinearGradient>
            <LinearGradient id={`line${uid}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.9} />
              <Stop offset="1" stopColor={colors.sage} stopOpacity={0.9} />
            </LinearGradient>
            <ClipPath id={`clip${uid}`}>
              <AnimatedRect x={0} y={0} height={geometry.height} animatedProps={clipProps} />
            </ClipPath>
          </Defs>
          {geometry.boundaries.map((x) => (
            <Line
              key={x}
              x1={x}
              x2={x}
              y1={8}
              y2={geometry.height - 8}
              stroke={colors.strokeStrong}
              strokeWidth={StyleSheet.hairlineWidth}
              strokeDasharray="2 5"
            />
          ))}
          <G clipPath={`url(#clip${uid})`}>
            <Path d={geometry.areaPath} fill={`url(#fill${uid})`} />
            <Path d={geometry.midPath} fill="none" stroke={`url(#line${uid})`} strokeWidth={2} strokeLinecap="round" />
          </G>
          {dot ? (
            <G>
              <AnimatedCircle cx={dot.x} cy={dot.y} fill={colors.primary} animatedProps={haloProps} />
              <AnimatedCircle
                cx={dot.x}
                cy={dot.y}
                r={5.5}
                fill={colors.primary}
                stroke={colors.bg}
                strokeWidth={2}
                animatedProps={coreProps}
              />
            </G>
          ) : null}
        </Svg>
      ) : null}
      {locked ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView intensity={Platform.OS === 'android' ? 30 : 22} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.lockWrap]}>
            <View style={styles.lockChip}>
              <Ionicons name="lock-closed" size={14} color={colors.textOnAccent} />
              <AppText variant="caption" color="textOnAccent">
                {t('journey.band.lockChip')}
              </AppText>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {locked ? (
        <PressableScale
          onPress={onLockedPress}
          pressedScale={0.99}
          accessibilityLabel={label}
          accessibilityHint={t('journey.band.lockedHint')}
          style={styles.frame}
        >
          {chart}
        </PressableScale>
      ) : (
        <View style={styles.frame} accessible accessibilityRole="image" accessibilityLabel={label}>
          {chart}
        </View>
      )}
      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <AppText variant="micro" color="textTertiary">
          {t('journey.band.start')}
        </AppText>
        <AppText variant="micro" color="textTertiary">
          {t('journey.band.end', { months })}
        </AppText>
      </View>
      <AppText variant="caption" color="textTertiary">
        {t('journey.band.disclaimer')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  frame: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bgElevated },
  chart: { width: '100%' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  lockWrap: { alignItems: 'center', justifyContent: 'center' },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
