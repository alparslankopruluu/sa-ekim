/**
 * Framing guide drawn over the camera: the oval (face) or circle (scalp) from `guide.ts`,
 * rule-of-thirds lines, and the brow line for face angles. Purely visual.
 */
import { StyleSheet } from 'react-native';
import Svg, { Ellipse, Line } from 'react-native-svg';

import type { Angle } from '@shared/catalog';

import { colors } from '@/theme/tokens';

import { browLineY, guideOval } from './guide';

export function GuideOverlay({ angle, width, height, ok }: { angle: Angle; width: number; height: number; ok: boolean }) {
  const oval = guideOval(angle);
  const stroke = ok ? colors.sage : colors.text;
  const face = angle !== 'top' && angle !== 'crown';
  const browY = browLineY(oval) * height;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {[1, 2].map((i) => (
        <Line
          key={`v${i}`}
          x1={(width * i) / 3}
          x2={(width * i) / 3}
          y1={0}
          y2={height}
          stroke={colors.text}
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      ))}
      {[1, 2].map((i) => (
        <Line
          key={`h${i}`}
          x1={0}
          x2={width}
          y1={(height * i) / 3}
          y2={(height * i) / 3}
          stroke={colors.text}
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      ))}
      <Ellipse
        cx={oval.cx * width}
        cy={oval.cy * height}
        rx={oval.rx * width}
        ry={oval.ry * height}
        stroke={stroke}
        strokeOpacity={0.85}
        strokeWidth={2}
        strokeDasharray={ok ? undefined : '8 6'}
        fill="none"
      />
      {face ? (
        <Line
          x1={(oval.cx - oval.rx * 0.8) * width}
          x2={(oval.cx + oval.rx * 0.8) * width}
          y1={browY}
          y2={browY}
          stroke={stroke}
          strokeOpacity={0.45}
          strokeWidth={1}
          strokeDasharray="4 6"
        />
      ) : null}
    </Svg>
  );
}
