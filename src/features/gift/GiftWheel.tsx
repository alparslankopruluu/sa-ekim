import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { landingRotation, type PrizeId, WHEEL_SEGMENTS } from '@shared/wheel';

import { currentFeedback } from '@/hooks/useFeedback';
import { colors, palettes } from '@/theme/tokens';
import { easings } from '@/theme/motion';

/** One colour per prize, so the same prize always looks the same on every slice. */
const PRIZE_COLORS: Record<PrizeId, string> = {
  credits10: palettes.gold[1],
  discount40: palettes.copper[1],
  credits5: palettes.sage[1],
  freeHigh: palettes.rose[1],
};
/** Light text on the deep slices, dark text on the gold one. */
const PRIZE_TEXT: Record<PrizeId, string> = {
  credits10: colors.textOnAccent,
  discount40: colors.text,
  credits5: colors.text,
  freeHigh: colors.text,
};
const SEGMENTS = WHEEL_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENTS;
const VIEW = 300;
const C = VIEW / 2;
const R = 132;
const BULBS = 24;
/** Chord available for a label at LABEL_RADIUS inside one slice, minus padding (view units). */
const LABEL_RADIUS = R * 0.66;
const LABEL_MAX_WIDTH = 2 * LABEL_RADIUS * Math.sin(Math.PI / SEGMENTS) - 14;
const LABEL_MAX_FONT = 15;
const LABEL_MIN_FONT = 10;

/** Shrinks long localized prize labels so they stay inside their slice (heavy glyphs ≈ 0.8em wide). */
function labelFontSize(text: string): number {
  const fit = LABEL_MAX_WIDTH / (Math.max(text.length, 1) * 0.8);
  return Math.max(LABEL_MIN_FONT, Math.min(LABEL_MAX_FONT, fit));
}

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) };
}

function slicePath(index: number): string {
  const start = polar(index * SEGMENT_ANGLE, R);
  const end = polar((index + 1) * SEGMENT_ANGLE, R);
  return `M ${C} ${C} L ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y} Z`;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Marquee bulbs around the rim, alternating on the UI thread. */
function Bulb({ index, lights }: { index: number; lights: SharedValue<number> }) {
  const position = polar((index * 360) / BULBS, R + 10);
  const animatedProps = useAnimatedProps(() => ({
    opacity: 0.3 + 0.7 * (index % 2 === 0 ? lights.value : 1 - lights.value),
  }));
  return <AnimatedCircle cx={position.x} cy={position.y} r={3.6} fill={colors.accent} animatedProps={animatedProps} />;
}

export interface GiftWheelHandle {
  /** Starts an open-ended wind-up spin while the server draws the prize. */
  windUp(): void;
  /** Decelerates onto the given segment; resolves when the wheel has landed. */
  landOn(segmentIndex: number): Promise<void>;
  /** Stops a wind-up without a result (server error). */
  abort(): void;
}

export interface GiftWheelProps {
  size: number;
  /** Segment to show under the pointer initially (after a previous spin). */
  initialSegment?: number | null;
}

export const GiftWheel = forwardRef<GiftWheelHandle, GiftWheelProps>(function GiftWheel({ size, initialSegment }, ref) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(initialSegment != null ? landingRotation(initialSegment, 0, 0) : 0);
  const pointer = useSharedValue(0);
  const lights = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    lights.set(withRepeat(withTiming(1, { duration: 520, easing: Easing.linear }), -1, true));
    return () => cancelAnimation(lights);
  }, [lights, reduceMotion]);

  const tick = useCallback(() => {
    currentFeedback().selection();
  }, []);

  // Pointer kick + haptic tick every time a segment boundary passes the pointer.
  useAnimatedReaction(
    () => {
      const normalized = ((rotation.value % 360) + 360) % 360;
      return Math.floor(((360 - normalized) % 360) / SEGMENT_ANGLE);
    },
    (current, previous) => {
      if (previous === null || current === previous) return;
      pointer.value = withSequence(withTiming(-14, { duration: 40 }), withSpring(0, { damping: 8, stiffness: 400 }));
      scheduleOnRN(tick);
    },
  );

  useImperativeHandle(
    ref,
    () => ({
      windUp() {
        cancelAnimation(rotation);
        const from = rotation.value;
        rotation.set(withTiming(from + 1440, { duration: 2400, easing: Easing.in(Easing.quad) }));
      },
      landOn(segmentIndex: number) {
        return new Promise<void>((resolve) => {
          cancelAnimation(rotation);
          const current = rotation.value;
          const landing = landingRotation(segmentIndex, 0, (Math.random() - 0.5) * 0.5) % 360;
          const base = current - (((current % 360) + 360) % 360);
          const turns = reduceMotion ? 1 : 5;
          const target = base + turns * 360 + landing + (landing <= ((current % 360) + 360) % 360 ? 360 : 0);
          rotation.set(withTiming(
            target,
            { duration: reduceMotion ? 900 : 5200, easing: easings.spin },
            (finished) => {
              if (finished) scheduleOnRN(resolve);
            },
          ));
        });
      },
      abort() {
        cancelAnimation(rotation);
        const current = rotation.value;
        rotation.set(withTiming(current + 90, { duration: 800, easing: Easing.out(Easing.cubic) }));
      },
    }),
    [reduceMotion, rotation],
  );

  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const pointerStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${pointer.value}deg` }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={t('ui.a11y.wheel')}>
      <Animated.View style={[StyleSheet.absoluteFill, wheelStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Defs>
            <LinearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.accent} />
              <Stop offset="1" stopColor={colors.primaryPressed} />
            </LinearGradient>
          </Defs>
          <Circle cx={C} cy={C} r={R + 16} fill="url(#rim)" />
          <Circle cx={C} cy={C} r={R + 4} fill={colors.bgElevated} />
          {WHEEL_SEGMENTS.map((prize, index) => {
            const mid = index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
            const label = polar(mid, LABEL_RADIUS);
            const text = t(`gift.prizes.${prize}.short`);
            return (
              <G key={`${prize}-${index}`}>
                <Path d={slicePath(index)} fill={PRIZE_COLORS[prize]} stroke={colors.bg} strokeWidth={2} />
                <SvgText
                  x={label.x}
                  y={label.y}
                  fill={PRIZE_TEXT[prize]}
                  fontSize={labelFontSize(text)}
                  fontWeight="900"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  transform={`rotate(${mid} ${label.x} ${label.y})`}
                >
                  {text}
                </SvgText>
              </G>
            );
          })}
          {Array.from({ length: BULBS }, (_, i) => (
            <Bulb key={i} index={i} lights={lights} />
          ))}
          <Circle cx={C} cy={C} r={30} fill={colors.bg} />
          <Circle cx={C} cy={C} r={25} fill={colors.surfaceHigh} />
          <SvgText x={C} y={C + 1} fontSize={24} textAnchor="middle" alignmentBaseline="middle">
            {'🎁'}
          </SvgText>
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.pointer, { left: size / 2 - 16 }, pointerStyle]}>
        <Svg width={32} height={40} viewBox="0 0 32 40">
          <Path d="M16 38 L 3 8 Q 16 -2 29 8 Z" fill={colors.text} stroke={colors.bg} strokeWidth={3} />
        </Svg>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  pointer: { position: 'absolute', top: -14, transformOrigin: '16px 8px' },
});
