/**
 * Developer tools (dev builds and mock mode only): exercise every state the
 * store/backend can produce without keys, and watch analytics fire (DebugView stand-in).
 */
import { router } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { showToast } from '@/components/Toast';
import { Card, CloseButton, ListRow } from '@/components/ui';
import { getBackend } from '@/services/backend';
import { readDevLog, subscribeDevLog } from '@/services/backend/devLog';
import { setMockRemoteValue } from '@/services/backend/mock';
import { mockServer } from '@/services/backend/mock/mockServer';
import { triggerTestCrash } from '@/services/crash';
import { mockStoreFlags } from '@/services/purchases/mockStore';
import { refreshGift } from '@/services/rewards';
import { useAccount } from '@/stores/account';
import { useSession } from '@/stores/session';
import { colors, layout, radius, spacing } from '@/theme/tokens';

function Options<T extends string>({ values, value, onChange }: { values: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.options}>
      {values.map((v) => (
        <Chip key={v} label={v} selected={v === value} onPress={() => onChange(v)} />
      ))}
    </View>
  );
}

export default function DeveloperScreen() {
  const { t } = useTranslation();
  const backend = getBackend();
  const isMock = backend.mode === 'mock';
  const log = useSyncExternalStore(subscribeDevLog, readDevLog, readDevLog);
  const [offerings, setOfferings] = useState(mockStoreFlags.offerings);
  const [purchase, setPurchase] = useState(mockStoreFlags.purchase);
  const [placement, setPlacement] = useState<'home' | 'onboarding_exit' | 'off'>('home');
  const [failNext, setFailNext] = useState(mockServer.flags.failNextRender);

  useEffect(() => {
    mockStoreFlags.offerings = offerings;
    mockStoreFlags.purchase = purchase;
  }, [offerings, purchase]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <AppText variant="title2">{t('settings.sections.developer')}</AppText>
        <CloseButton onPress={() => router.back()} />
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
          {isMock ? (
            <>
              <ListRow
                icon="flash-outline"
                label={t('settings.developer.addCredits')}
                onPress={() => {
                  mockServer.grantDevCredits(200);
                  showToast(t('credits.success', { count: 200 }), 'success');
                }}
                testID="dev-add-credits"
              />
              <ListRow
                icon="bug-outline"
                label={t('settings.developer.failNext')}
                toggle={{
                  value: failNext,
                  onChange: (value) => {
                    mockServer.flags.failNextRender = value;
                    setFailNext(value);
                  },
                }}
              />
              <ListRow
                icon="refresh-circle-outline"
                label={t('settings.developer.reset')}
                destructive
                onPress={() => {
                  void mockServer.reset().then(() => {
                    useAccount.getState().setGift(null);
                    void refreshGift();
                    showToast(t('settings.developer.reset'), 'info');
                  });
                }}
              />
            </>
          ) : null}
          <ListRow icon="warning-outline" label={t('settings.developer.testCrash')} onPress={triggerTestCrash} />
        </Card>

        {isMock ? (
          <Card style={styles.pad}>
            <AppText variant="micro" color="textTertiary">
              {t('settings.developer.offerings')}
            </AppText>
            <Options values={['ok', 'slow', 'fail', 'empty'] as const} value={offerings} onChange={setOfferings} />
            <AppText variant="micro" color="textTertiary">
              {t('settings.developer.purchase')}
            </AppText>
            <Options values={['success', 'cancel', 'fail'] as const} value={purchase} onChange={setPurchase} />
            <AppText variant="micro" color="textTertiary">
              {t('settings.developer.wheel')}
            </AppText>
            <Options
              values={['home', 'onboarding_exit', 'off'] as const}
              value={placement}
              onChange={(value) => {
                setPlacement(value);
                setMockRemoteValue('wheel_placement', value);
              }}
            />
          </Card>
        ) : null}

        <Card style={styles.pad}>
          <AppText variant="micro" color="textTertiary">
            {t('settings.developer.events')}
          </AppText>
          {log.length === 0 ? (
            <AppText variant="caption" color="textSecondary">
              {t('settings.developer.empty')}
            </AppText>
          ) : (
            log.slice(0, 60).map((entry, index) => (
              <View key={`${entry.at}-${index}`} style={styles.logRow}>
                <AppText variant="caption" color={entry.kind === 'crash' ? 'danger' : entry.kind === 'event' ? 'accent' : 'textSecondary'}>
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
