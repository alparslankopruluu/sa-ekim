import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { track } from '@/services/analytics';
import { recordConsent } from '@/services/generation';
import { CONSENT_VERSION } from '@/stores/session';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { showToast } from './Toast';

const POINTS = [
  { icon: 'image-outline', key: 'sent' },
  { icon: 'server-outline', key: 'who' },
  { icon: 'time-outline', key: 'retention' },
  { icon: 'hand-left-outline', key: 'choice' },
] as const;

/**
 * Accepting records the consent server-side (App Review 5.1.2(i)) and locally. Exposed as a
 * hook so onboarding can pin the buttons below a scrolling body at large Dynamic Type.
 */
export function useConsentAccept(onAccepted: () => void) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const accept = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await recordConsent();
      track('consent_accepted', { version: CONSENT_VERSION });
      onAccepted();
    } catch {
      showToast(t('consent.error'), 'error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [onAccepted, t]);

  return { accept, busy };
}

/** The disclosure itself: what is sent, who processes it, how long it stays, the choice. */
export function ConsentBody() {
  const { t } = useTranslation();
  return (
    <View style={styles.body} testID="consent-body">
      <AppText variant="title1" accessibilityRole="header">
        {t('consent.title')}
      </AppText>
      <AppText variant="body" color="textSecondary">
        {t('consent.body')}
      </AppText>
      <View style={styles.points}>
        {POINTS.map((point) => (
          <View key={point.key} style={styles.point}>
            <View style={styles.pointIcon}>
              <Ionicons name={point.icon} size={20} color={colors.accent} />
            </View>
            <View style={styles.pointText}>
              <AppText variant="bodyStrong">{t(`consent.${point.key}.title`)}</AppText>
              <AppText variant="callout" color="textSecondary">
                {t(`consent.${point.key}.body`)}
              </AppText>
            </View>
          </View>
        ))}
      </View>
      <AppText variant="caption" color="textTertiary">
        {t('consent.note')}
      </AppText>
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
    </View>
  );
}

/** Body plus accept / decline buttons: used by the standalone consent modal. */
export function ConsentCard({ onAccepted, onDeclined }: { onAccepted: () => void; onDeclined?: () => void }) {
  const { t } = useTranslation();
  const { accept, busy } = useConsentAccept(onAccepted);

  return (
    <View style={styles.card} testID="consent-card">
      <ConsentBody />
      <View style={styles.actions}>
        <Button label={t('consent.accept')} onPress={() => void accept()} loading={busy} testID="consent-accept" />
        {onDeclined ? (
          <Button label={t('consent.decline')} onPress={onDeclined} variant="ghost" size="md" testID="consent-decline" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  body: { gap: spacing.md },
  points: { gap: spacing.lg, marginVertical: spacing.xs },
  point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  pointIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  pointText: { flex: 1, gap: spacing.xxs },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  actions: { gap: spacing.xs },
});
