import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OptionCard } from '@/components/OptionCard';
import { showToast } from '@/components/Toast';
import { CloseButton } from '@/components/ui';
import { track } from '@/services/analytics';
import { BackendError } from '@/services/backend';
import { reportRender } from '@/services/generation';
import { colors, layout, spacing } from '@/theme/tokens';

import { REPORT_REASONS as REASONS, type ReportReason as Reason } from '@shared/api';

/** Report flow required for AI/UGC surfaces (App Review 1.2; 48-hour review promise). */
export default function ReportScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ renderId?: string }>();
  const [reason, setReason] = useState<Reason | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reason || !params.renderId) return;
    setSending(true);
    try {
      await reportRender(params.renderId, reason);
      track('content_reported', { reason });
      showToast(t('report.sent'), 'success');
      router.back();
    } catch (error) {
      showToast(t(`errors.${error instanceof BackendError ? error.code : 'unknown'}`), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <AppText variant="title2" accessibilityRole="header">
          {t('report.title')}
        </AppText>
        <CloseButton onPress={() => router.back()} />
      </View>
      <AppText variant="body" color="textSecondary">
        {t('report.subtitle')}
      </AppText>
      <View style={styles.list}>
        {REASONS.map((value) => (
          <OptionCard key={value} title={t(`report.${value}`)} selected={reason === value} onPress={() => setReason(value)} />
        ))}
      </View>
      <Button
        label={t('report.send')}
        onPress={() => void send()}
        loading={sending}
        disabled={!reason}
        style={styles.send}
        testID="report-send"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgElevated, paddingHorizontal: layout.screenPadding, gap: spacing.lg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm },
  list: { gap: spacing.md },
  send: { marginTop: 'auto', marginBottom: spacing.lg },
});
