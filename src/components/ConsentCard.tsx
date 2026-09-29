import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { track } from '@/services/analytics';
import { BackendError } from '@/services/backend';
import { recordConsent } from '@/services/generation';
import { CONSENT_VERSION } from '@/stores/session';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { showToast } from './Toast';

const POINTS = [
  { icon: 'color-wand-outline', key: 'consent.point1' },
  { icon: 'time-outline', key: 'consent.point2' },
  { icon: 'shield-checkmark-outline', key: 'consent.point3' },
  { icon: 'pricetag-outline', key: 'consent.point4' },
] as const;

/**
 * Explicit, in-app AI processing disclosure before any face/voice leaves the
 * device (App Review 5.1.2(i)). Accepting records the consent server-side.
 */
export function ConsentCard({ onAccepted, onDeclined }: { onAccepted: () => void; onDeclined?: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await recordConsent();
      track('consent_accepted', { version: CONSENT_VERSION });
      onAccepted();
    } catch (error) {
      const code = error instanceof BackendError ? error.code : 'unknown';
      showToast(t(`errors.${code}`), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card} testID="consent-card">
      <AppText variant="title2">{t('consent.title')}</AppText>
      <AppText variant="body" color="textSecondary">
        {t('consent.body')}
      </AppText>
      <View style={styles.points}>
        {POINTS.map((point) => (
          <View key={point.key} style={styles.point}>
            <Ionicons name={point.icon} size={20} color={colors.accent} />
            <AppText variant="callout" style={styles.pointText}>
              {t(point.key)}
            </AppText>
          </View>
        ))}
      </View>
      <PressableScale
        onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}
        style={styles.link}
        accessibilityRole="link"
        accessibilityLabel={t('consent.policy')}
      >
        <AppText variant="callout" color="primary">
          {t('consent.policy')}
        </AppText>
      </PressableScale>
      <Button label={t('consent.accept')} onPress={() => void accept()} loading={busy} testID="consent-accept" />
      {onDeclined ? <Button label={t('consent.decline')} onPress={onDeclined} variant="ghost" size="md" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  points: { gap: spacing.md, marginVertical: spacing.xs },
  point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  pointText: { flex: 1 },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
});
