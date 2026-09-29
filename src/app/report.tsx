/**
 * Report a preview (App Review 1.2 for AI output; 48-hour review promise). The report goes to
 * `reports/{id}` via the reportPreview callable; only the preview id and a reason are sent.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { REPORT_REASONS, type ReportReason } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OptionCard } from '@/components/OptionCard';
import { showToast } from '@/components/Toast';
import { CloseButton, EmptyState } from '@/components/ui';
import { useFeedback } from '@/hooks/useFeedback';
import { useErrorMessage } from '@/lib/errors';
import { track } from '@/services/analytics';
import { reportPreview } from '@/services/generation';
import { colors, layout, spacing } from '@/theme/tokens';

export default function ReportScreen() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const errorMessage = useErrorMessage();
  const params = useLocalSearchParams<{ previewId?: string }>();
  const previewId = typeof params.previewId === 'string' && params.previewId.length > 0 ? params.previewId : null;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [sending, setSending] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const send = async () => {
    if (!reason || !previewId || sending) return;
    setSending(true);
    try {
      await reportPreview(previewId, reason);
      track('content_reported', { reason });
      feedback.success();
      showToast(t('report.sent'), 'success');
      close();
    } catch (error) {
      feedback.error();
      showToast(errorMessage(error), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <AppText variant="title2" accessibilityRole="header" style={styles.title}>
          {t('report.title')}
        </AppText>
        <CloseButton onPress={close} testID="report-close" />
      </View>
      {previewId ? (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            <AppText variant="body" color="textSecondary">
              {t('report.subtitle')}
            </AppText>
            <View style={styles.list} accessibilityRole="radiogroup">
              {REPORT_REASONS.map((value) => (
                <OptionCard
                  key={value}
                  title={t(`report.${value}`)}
                  selected={reason === value}
                  onPress={() => setReason(value)}
                  testID={`report-reason-${value}`}
                />
              ))}
            </View>
          </ScrollView>
          <Button
            label={t('report.send')}
            onPress={() => void send()}
            loading={sending}
            disabled={!reason}
            style={styles.send}
            testID="report-send"
          />
        </>
      ) : (
        <EmptyState
          emoji="🗂️"
          title={t('report.title')}
          body={t('report.unavailable')}
          action={{ label: t('common.close'), onPress: close }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgElevated, paddingHorizontal: layout.screenPadding },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  title: { flex: 1 },
  scroll: { gap: spacing.lg, paddingBottom: spacing.lg },
  list: { gap: spacing.md },
  send: { marginBottom: spacing.lg },
});
