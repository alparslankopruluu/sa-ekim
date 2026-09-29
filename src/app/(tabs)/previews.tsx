/**
 * Previews tab: the user's saved AI previews (grid), in-flight and failed ones, and the
 * "New preview" entry. Previews are deleted 30 days after creation; each card shows the date.
 */
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PreviewDoc } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CreditPill } from '@/components/CreditPill';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { prefillDraftFromPreview } from '@/features/preview/draftFromPreview';
import { PreviewCard } from '@/features/preview/PreviewCard';
import { useDeletePreview } from '@/features/preview/useDeletePreview';
import { cardKind, sortPreviews } from '@/lib/previewFlow';
import { trackScreen } from '@/services/analytics';
import { startSession } from '@/services/session';
import { useAccount } from '@/stores/account';
import { colors, layout, spacing } from '@/theme/tokens';

const COLUMNS = 2;
const GAP = spacing.md;

export default function PreviewsScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const previews = useAccount((s) => s.previews);
  const state = useAccount((s) => s.previewsState);
  const { confirmDelete } = useDeletePreview();
  const [now] = useState(() => Date.now());

  const sorted = useMemo(() => sortPreviews(previews), [previews]);
  const contentWidth = Math.min(width, layout.maxContentWidth + layout.screenPadding * 2) - layout.screenPadding * 2;
  const cardWidth = contentWidth / COLUMNS - GAP;

  useEffect(() => {
    trackScreen('previews');
  }, []);

  const startNew = () => router.push({ pathname: '/preview', params: { entry: 'preview_tab' } });

  const open = (doc: PreviewDoc) => {
    const kind = cardKind(doc.status);
    if (kind === 'ready') router.push({ pathname: '/preview/result', params: { previewId: doc.id } });
    else router.push({ pathname: '/preview/rendering', params: { previewId: doc.id } });
  };

  const retry = (doc: PreviewDoc) => {
    void prefillDraftFromPreview(doc).then(() =>
      router.push({ pathname: '/preview', params: { keep: '1', goal: doc.goal, entry: 'preview_tab' } }),
    );
  };

  const header = (
    <View style={styles.header}>
      <AppText variant="title1" accessibilityRole="header" style={styles.title}>
        {t('preview.tab.title')}
      </AppText>
      <CreditPill onPress={() => router.push({ pathname: '/credits', params: { source: 'previews' } })} />
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {header}
      {state === 'error' ? (
        <ErrorState message={t('preview.tab.loadFailed')} onRetry={() => void startSession()} />
      ) : state !== 'ready' ? (
        <View style={styles.skeletons} accessibilityLabel={t('preview.tab.title')}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ width: cardWidth, height: cardWidth * 1.25 }} />
          ))}
        </View>
      ) : sorted.length === 0 ? (
        <EmptyState
          emoji="✨"
          title={t('preview.tab.emptyTitle')}
          body={t('preview.tab.emptyBody')}
          action={{ label: t('preview.tab.emptyCta'), onPress: startNew }}
        />
      ) : (
        <FlashList
          data={sorted}
          numColumns={COLUMNS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: layout.screenPadding - GAP / 2 }}
          ListHeaderComponent={
            <View style={styles.hero}>
              <Button label={t('preview.tab.new')} icon="add" shine onPress={startNew} testID="previews-new" />
              <AppText variant="caption" color="textTertiary" align="center">
                {t('preview.tab.honest')}
              </AppText>
            </View>
          }
          ListFooterComponent={<View style={{ height: layout.tabBarClearance }} />}
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <PreviewCard
                doc={item}
                width={cardWidth}
                now={now}
                onOpen={open}
                onRetry={retry}
                onDelete={(doc) => confirmDelete(doc)}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
  },
  title: { flex: 1 },
  hero: { gap: spacing.sm, paddingHorizontal: GAP / 2, paddingBottom: spacing.lg },
  cell: { alignItems: 'center', marginBottom: GAP },
  skeletons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: layout.screenPadding,
  },
});
