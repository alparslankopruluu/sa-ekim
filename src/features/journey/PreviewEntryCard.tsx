import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { colors, radius, spacing } from '@/theme/tokens';

import { Chevron } from './Chevron';

/** Today's entry into the preview flow (style picker). Always labelled as a preview, never a promise. */
export function PreviewEntryCard() {
  const { t } = useTranslation();
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/preview', params: { entry: 'home_card' } })}
      pressedScale={0.985}
      accessibilityLabel={`${t('journey.previewCard.title')}. ${t('journey.previewCard.body')}`}
      style={styles.card}
      testID="preview-entry-card"
    >
      <View style={styles.icon}>
        <Ionicons name="sparkles-outline" size={22} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <AppText variant="headline">{t('journey.previewCard.title')}</AppText>
        <AppText variant="caption" color="textSecondary">
          {t('journey.previewCard.body')}
        </AppText>
      </View>
      <Chevron />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  text: { flex: 1, gap: 2 },
});
