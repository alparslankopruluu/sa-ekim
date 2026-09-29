import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, type ColorToken, typography, type TypographyVariant } from '@/theme/tokens';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
}

/** Display styles cap Dynamic Type growth so hero lines never overflow; body text scales freely. */
const SCALE_CAP: Partial<Record<TypographyVariant, number>> = {
  display: 1.35,
  title1: 1.4,
  title2: 1.5,
  micro: 1.6,
};

export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={SCALE_CAP[variant]}
      style={[
        styles.base,
        typography[variant] as TextStyle,
        { color: colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { writingDirection: 'auto' },
});
