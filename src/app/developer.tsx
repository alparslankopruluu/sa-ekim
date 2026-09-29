/**
 * Developer tools (mock / emulator backends only): exercise every state the store and the
 * backend can produce without keys, and watch analytics fire (a DebugView stand-in).
 */
import { router } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PRODUCT_SUFFIXES } from '@shared/products';
import { type PrizeId, PRIZES } from '@shared/wheel';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { showToast } from '@/components/Toast';
import { Card, CloseButton, EmptyState, ListRow } from '@/components/ui';
import { getBackend } from '@/services/backend';
import { readDevLog, subscribeDevLog } from '@/services/backend/devLog';
import { setMockRemoteValue } from '@/services/backend/mock';
import { mockServer } from '@/services/backend/mock/mockServer';
import { triggerTestCrash } from '@/services/crash';
import { MOCK_BUNDLE_ID, type MockStoreFlags, mockStoreFlags, type MockStorefront } from '@/services/purchases/mockStore';
import { refreshGift } from '@/services/rewards';
import { useAccount } from '@/stores/account';
import { useSession } from '@/stores/session';
import { colors, layout, radius, spacing } from '@/theme/tokens';

const DEV_CREDITS = 50;
const COHORT_COUNTS = [0, 5, 20, 140] as const;
const STOREFRONTS: readonly MockStorefront[] = ['USD', 'TRY', 'SAR'];
const PRIZE_IDS = Object.keys(PRIZES) as PrizeId[];

function Options<T extends string>({
  values,
  value,
  onChange,
  label,
}: {
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
}) {
  return (
    <View style={styles.options}>
      {values.map((v) => (
        <Chip key={v} label={label(v)} selected={v === value} onPress={() => onChange(v)} testID={`dev-option-${v}`} />
      ))}
    </View>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <AppText variant="micro" color="textTertiary" accessibilityRole="header">
      {children}
    </AppText>
  );
}

export default function DeveloperScreen() {
  const { t } = useTranslation();
  const backend = getBackend();
  const isMock = backend.mode === 'mock';
  const log = useSyncExternalStore(subscribeDevLog, readDevLog, readDevLog);
  const [store, setStore] = useState<MockStoreFlags>({ ...mockStoreFlags });
  const [placement, setPlacement] = useState<'home' | 'onboarding_exit' | 'off'>('home');
  const [failNext, setFailNext] = useState(mockServer.flags.failNextPreview);
  const [previewsEnabled, setPreviewsEnabled] = useState(mockServer.flags.generationEnabled);
  const [cohort, setCohort] = useState(mockServer.flags.cohortSameWeek);
  const [nextPrize, setNextPrize] = useState<PrizeId | 'honest'>(mockServer.flags.nextPrize ?? 'honest');
  const [pro, setPro] = useState(mockServer.isPro);

  const value = (v: string) => t(`settings.developer.values.${v}` as 'settings.developer.values.ok', { defaultValue: v });

  const updateStore = <K extends keyof MockStoreFlags>(key: K, next: MockStoreFlags[K]) => {
    mockStoreFlags[key] = next;
    setStore({ ...mockStoreFlags });
  };

  if (backend.mode === 'live') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <EmptyState
          emoji="🔒"
          title={t('settings.developer.open')}
          body={t('settings.developer.mockOnly')}
          action={{ label: t('common.close'), onPress: () => router.back() }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <AppText variant="title2" accessibilityRole="header">
          {t('settings.developer.open')}
        </AppText>
        <CloseButton onPress={() => router.back()} testID="developer-close" />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <ListRow icon="server-outline" label={t('settings.developer.backend')} value={backend.mode} />
          <ListRow
            icon="play-back-outline"
            label={t('settings.developer.replayOnboarding')}
            onPress={() => {
              useSession.getState().replayOnboarding();
              router.replace('/onboarding');
            }}
            testID="dev-replay-onboarding"
          />
          <ListRow icon="warning-outline" label={t('settings.developer.testCrash')} onPress={triggerTestCrash} />
        </Card>

        {isMock ? (
          <>
            <Card>
              <ListRow
                icon="star-outline"
                label={t('settings.developer.forcePro')}
                toggle={{
                  value: pro,
                  onChange: (next) => {
                    mockServer.setEntitlement(next, next ? `${MOCK_BUNDLE_ID}.${PRODUCT_SUFFIXES.annual}` : null);
                    setPro(next);
                  },
                }}
                testID="dev-force-pro"
              />
              <ListRow
                icon="flash-outline"
                label={t('settings.developer.addCredits')}
                onPress={() => {
                  mockServer.grantDevCredits(DEV_CREDITS);
                  showToast(t('settings.developer.credits'), 'success');
                }}
                testID="dev-add-credits"
              />
              <ListRow
                icon="sparkles-outline"
                label={t('settings.developer.grantFreeHigh')}
                onPress={() => {
                  mockServer.grantDevFreeHigh(1);
                  showToast(t('settings.developer.credits'), 'success');
                }}
                testID="dev-free-high"
              />
              <ListRow
                icon="bug-outline"
                label={t('settings.developer.failNext')}
                toggle={{
                  value: failNext,
                  onChange: (next) => {
                    mockServer.flags.failNextPreview = next;
                    setFailNext(next);
                  },
                }}
                testID="dev-fail-next"
              />
              <ListRow
                icon="power-outline"
                label={t('settings.developer.previewsEnabled')}
                toggle={{
                  value: previewsEnabled,
                  onChange: (next) => {
                    setMockRemoteValue('previews_enabled', next);
                    mockServer.flags.generationEnabled = next;
                    setPreviewsEnabled(next);
                  },
                }}
              />
              <ListRow
                icon="refresh-circle-outline"
                label={t('settings.developer.reset')}
                destructive
                onPress={() => {
                  void mockServer.reset().then(() => {
                    mockServer.resetFlags();
                    setFailNext(mockServer.flags.failNextPreview);
                    setPreviewsEnabled(mockServer.flags.generationEnabled);
                    setCohort(mockServer.flags.cohortSameWeek);
                    setNextPrize('honest');
                    setPro(false);
                    useAccount.getState().setGift(null);
                    void refreshGift();
                    showToast(t('settings.developer.resetDone'), 'info');
                  });
                }}
                testID="dev-reset"
              />
            </Card>

            <Card style={styles.pad}>
              <Heading>{t('settings.developer.offerings')}</Heading>
              <Options
                values={['ok', 'slow', 'fail', 'empty'] as const}
                value={store.offerings}
                onChange={(v) => updateStore('offerings', v)}
                label={value}
              />
              <Heading>{t('settings.developer.purchase')}</Heading>
              <Options
                values={['success', 'cancel', 'fail'] as const}
                value={store.purchase}
                onChange={(v) => updateStore('purchase', v)}
                label={value}
              />
              <Heading>{t('settings.developer.storefront')}</Heading>
              <Options
                values={STOREFRONTS}
                value={store.storefront}
                onChange={(v) => updateStore('storefront', v)}
                label={(v) => v}
              />
              <ListRow
                label={t('settings.developer.giftOffer')}
                toggle={{ value: store.unlockGiftOffer, onChange: (v) => updateStore('unlockGiftOffer', v) }}
              />
              <AppText variant="caption" color="textTertiary">
                {t('settings.developer.offerCacheNote')}
              </AppText>
            </Card>

            <Card style={styles.pad}>
              <Heading>{t('settings.developer.wheel')}</Heading>
              <Options
                values={['home', 'onboarding_exit', 'off'] as const}
                value={placement}
                onChange={(next) => {
                  setPlacement(next);
                  setMockRemoteValue('wheel_placement', next);
                }}
                label={value}
              />
              <Heading>{t('settings.developer.nextPrize')}</Heading>
              <Options
                values={['honest', ...PRIZE_IDS] as const}
                value={nextPrize}
                onChange={(next) => {
                  setNextPrize(next);
                  mockServer.flags.nextPrize = next === 'honest' ? null : next;
                }}
                label={(v) => (v === 'honest' ? t('settings.developer.honest') : t(`gift.prizes.${v}.title`))}
              />
              <Heading>{t('settings.developer.cohort')}</Heading>
              <Options
                values={COHORT_COUNTS.map(String)}
                value={String(cohort)}
                onChange={(next) => {
                  const count = Number(next);
                  mockServer.flags.cohortSameWeek = count;
                  mockServer.flags.cohortSameGoal = count;
                  setCohort(count);
                }}
                label={(v) => v}
              />
            </Card>
          </>
        ) : (
          <AppText variant="caption" color="textTertiary">
            {t('settings.developer.mockOnly')}
          </AppText>
        )}

        <Card style={styles.pad}>
          <Heading>{t('settings.developer.events')}</Heading>
          {log.length === 0 ? (
            <AppText variant="caption" color="textSecondary">
              {t('settings.developer.empty')}
            </AppText>
          ) : (
            log.slice(0, 60).map((entry, index) => (
              <View key={`${entry.at}-${index}`} style={styles.logRow}>
                <AppText
                  variant="caption"
                  color={entry.kind === 'crash' ? 'danger' : entry.kind === 'event' ? 'accent' : 'textSecondary'}
                >
                  {`${entry.kind} · ${entry.name}`}
                </AppText>
                {entry.detail ? (
                  <AppText variant="caption" color="textTertiary" numberOfLines={2}>
                    {entry.detail}
                  </AppText>
                ) : null}
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgElevated },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
  },
  scroll: { paddingHorizontal: layout.screenPadding, gap: spacing.lg, paddingBottom: spacing.huge },
  pad: { padding: spacing.lg, gap: spacing.sm },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  logRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke,
    borderRadius: radius.xs,
  },
});
