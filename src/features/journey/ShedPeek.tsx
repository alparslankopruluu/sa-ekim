import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { ShedMiniChart } from '@/features/shed/ShedMiniChart';
import { colors, radius, spacing } from '@/theme/tokens';

import { Chevron } from './Chevron';

/** Compact recent-shedding chart on Today (owned by the shed feature); opens the shed log. */
export function ShedPeek() {
  const { t } = useTranslation();
  return (
    <PressableScale
      onPress={() => router.push('/shed')}
      pressedScale={0.985}
      accessibilityLabel={t('journey.shedPeek.title')}
      accessibilityHint={t('journey.shedPeek.hint')}
      style={styles.card}
      testID="shed-peek"
    >
      <View style={styles.head}>
        <AppText variant="headline" style={styles.title}>
          {t('journey.shedPeek.title')}
        </AppText>
        <Chevron />
      </View>
      <ShedMiniChart days={14} />
      <AppText variant="caption" color="textTertiary">
        {t('journey.shedPeek.note')}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
});
