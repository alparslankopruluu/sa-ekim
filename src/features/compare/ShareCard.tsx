import { Image } from 'expo-image';
import { forwardRef } from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/theme/tokens';

export interface ShareCardProps {
  beforeUri: string;
  afterUri: string;
  beforeLabel: string;
  afterLabel: string;
  mark: string;
  disclaimer: string;
}

/** Fixed-size card that is rasterized for "Share as image" (before on the left in every language). */
export const SHARE_CARD_WIDTH = 1080 / 3;

export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { beforeUri, afterUri, beforeLabel, afterLabel, mark, disclaimer },
  ref,
) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.row}>
        {[
          { uri: beforeUri, label: beforeLabel },
          { uri: afterUri, label: afterLabel },
        ].map((photo) => (
          <View key={photo.label} style={styles.frame}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.tag}>
              <AppText variant="micro" color="textOnAccent">
                {photo.label}
              </AppText>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <AppText variant="headline">{mark}</AppText>
        <AppText variant="caption" color="textSecondary" style={styles.flex}>
          {disclaimer}
        </AppText>
      </View>
    </View>
  );
});

const FRAME = (SHARE_CARD_WIDTH - spacing.md * 2 - spacing.sm) / 2;

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  row: { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', gap: spacing.sm },
  frame: {
    width: FRAME,
    height: FRAME * (4 / 3),
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
  },
  tag: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
