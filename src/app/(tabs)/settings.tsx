/**
 * Settings: subscription and credits, language (20, native names), notifications, haptics,
 * data and privacy, account deletion (App Review 5.1.1(v): under an Account-labelled section),
 * legal and support, about, and developer tools on the mock / emulator backends only.
 */
import * as Application from 'expo-application';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Linking, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CALLABLES } from '@shared/api';

import { AppText } from '@/components/AppText';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { PressableScale } from '@/components/PressableScale';
import { showToast } from '@/components/Toast';
import { Card, CloseButton, ListRow } from '@/components/ui';
import { useLanguagePreference } from '@/features/settings/language';
import { useEntitlement } from '@/lib/entitlements';
import { useErrorMessage } from '@/lib/errors';
import { currentLanguage, currentLocaleTag } from '@/lib/i18n';
import { type AppLanguage, LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '@/lib/locales';
import { setUserProperty, track, trackScreen } from '@/services/analytics';
import { backendMode, getBackend } from '@/services/backend';
import { appExtra } from '@/services/backend/mode';
import { recordNonFatal } from '@/services/crash';
import { deletePreview } from '@/services/generation';
import { wipeAllJourneyFiles } from '@/services/journeyFiles';
import {
  cancelJourneyReminders,
  getPermissionState,
  type PermissionState,
  registerPushToken,
  scheduleJourneyReminders,
} from '@/services/notifications';
import { purchases } from '@/services/purchases';
import { startSession, stopSession } from '@/services/session';
import { useAccount } from '@/stores/account';
import { useJourney } from '@/stores/journey';
import { type Preferences, useSession } from '@/stores/session';
import { colors, layout, minTouch, radius, spacing } from '@/theme/tokens';

const LANGUAGES = SUPPORTED_LANGUAGES as readonly AppLanguage[];
const DELETE_ACCOUNT_TIMEOUT_MS = 60000;

function manageSubscriptionUrl(): string {
  if (Platform.OS === 'android') {
    const pkg = Application.applicationId;
    return `https://play.google.com/store/account/subscriptions${pkg ? `?package=${pkg}` : ''}`;
  }
  return 'https://apps.apple.com/account/subscriptions';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="micro" color="textTertiary" style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </AppText>
      <Card>{children}</Card>
    </View>
  );
}

function Hint({ children }: { children: string }) {
  return (
    <AppText variant="caption" color="textTertiary" style={styles.hint}>
      {children}
    </AppText>
  );
}

/** Clears everything the journey keeps on this device (store, files, scheduled reminders). */
async function wipeLocalJourney(): Promise<number> {
  const photos = useJourney.getState().photos.length;
  await cancelJourneyReminders().catch((e: unknown) => recordNonFatal(e, 'wipe_reminders'));
  try {
    await wipeAllJourneyFiles();
  } catch (error) {
    recordNonFatal(error, 'wipe_journey_files');
  }
  useJourney.getState().wipe();
  return photos;
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { isPro } = useEntitlement();
  const uid = useAccount((s) => s.uid);
  const entitlement = useAccount((s) => s.entitlement);
  const wallet = useAccount((s) => s.wallet);
  const previews = useAccount((s) => s.previews);
  const preferences = useSession((s) => s.preferences);
  const setPreference = useSession((s) => s.setPreference);
  const chooseLanguage = useLanguagePreference((s) => s.choose);
  const [language, setLanguage] = useState<AppLanguage>(currentLanguage());
  const [picker, setPicker] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState<PermissionState>('undetermined');
  const [restoring, setRestoring] = useState(false);
  const [confirm, setConfirm] = useState<'wipe' | 'account' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    trackScreen('settings');
    void getPermissionState()
      .then(setSystemNotifications)
      .catch(() => undefined);
  }, []);

  const toggle = (key: keyof Preferences) => (value: boolean) => {
    setPreference(key, value);
    if (key === 'notifyOffers') {
      setUserProperty('offers_opt_in', value ? 'yes' : 'no');
      void registerPushToken().catch(() => undefined);
    }
    if (key === 'notifyReminders') {
      const task = value ? scheduleJourneyReminders() : cancelJourneyReminders();
      void task.catch((e: unknown) => recordNonFatal(e, 'toggle_reminders'));
    }
  };

  const pickLanguage = async (next: AppLanguage) => {
    setPicker(false);
    if (next === language) return;
    setLanguage(next);
    const { needsRestart } = await chooseLanguage(next);
    if (useSession.getState().preferences.notifyReminders) {
      // Reminder bodies are translated strings: rebuild them in the new language.
      void scheduleJourneyReminders().catch(() => undefined);
    }
    if (needsRestart) showToast(t('settings.language.rtlNote'), 'info');
  };

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const state = await purchases.restore();
      showToast(
        state.isPro ? t('settings.subscription.restoreDone') : t('settings.subscription.restoreNone'),
        state.isPro ? 'success' : 'info',
      );
    } catch (error) {
      showToast(errorMessage(error), 'error');
    } finally {
      setRestoring(false);
    }
  };

  const wipeData = async () => {
    setBusy(true);
    try {
      const photos = await wipeLocalJourney();
      const finished = previews.filter((p) => p.status === 'succeeded' || p.status === 'failed' || p.status === 'canceled');
      await Promise.allSettled(finished.map((p) => deletePreview(p.id)));
      track('data_wiped', { photos });
      useSession.getState().resetAll();
      setConfirm(null);
      showToast(t('settings.data.wiped'), 'success');
      router.replace('/onboarding');
    } catch (error) {
      showToast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await getBackend().functions.call(CALLABLES.deleteAccount, {}, DELETE_ACCOUNT_TIMEOUT_MS);
      track('account_deleted', { had_pro: entitlement.isPro });
      stopSession();
      await getBackend().auth.signOutLocal();
      await wipeLocalJourney();
      useAccount.getState().reset();
      useSession.getState().resetAll();
      setConfirm(null);
      showToast(t('settings.account.deleted'), 'success');
      router.replace('/onboarding');
      void startSession();
    } catch (error) {
      showToast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const planLabel = isPro ? t('settings.subscription.pro') : t('settings.subscription.free');
  const date = entitlement.expiresAt
    ? new Date(entitlement.expiresAt).toLocaleDateString(currentLocaleTag(), { dateStyle: 'medium' })
    : null;
  const planValue = isPro && date
    ? entitlement.willRenew
      ? t('settings.subscription.renews', { date })
      : t('settings.subscription.expires', { date })
    : undefined;
  const version = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion ?? '1';
  const supportEmail = appExtra.legal?.supportEmail;
  const openLegal = (doc: 'privacy' | 'terms' | 'ai' | 'support') =>
    router.push({ pathname: '/legal/[doc]', params: { doc } });

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppText variant="title1" accessibilityRole="header">
          {t('settings.title')}
        </AppText>

        <Section title={t('settings.sections.subscription')}>
          <ListRow icon="star" label={planLabel} value={planValue} />
          {isPro ? (
            <ListRow
              icon="card-outline"
              label={t('settings.subscription.manage')}
              onPress={() => void Linking.openURL(manageSubscriptionUrl())}
              testID="settings-manage"
            />
          ) : (
            <ListRow
              icon="leaf-outline"
              label={t('settings.subscription.upgrade')}
              onPress={() => router.push({ pathname: '/paywall', params: { source: 'settings' } })}
              testID="settings-upgrade"
            />
          )}
          <ListRow
            icon="refresh-outline"
            label={t('settings.subscription.restore')}
            value={restoring ? t('common.loading') : undefined}
            onPress={restoring ? undefined : () => void restore()}
            testID="settings-restore"
          />
          <ListRow
            icon="flash-outline"
            label={t('settings.subscription.balance')}
            value={t('common.credits', { count: wallet.balance })}
          />
          {wallet.freeHighTokens > 0 ? (
            <ListRow icon="sparkles-outline" label={t('settings.subscription.freeHigh', { count: wallet.freeHighTokens })} />
          ) : null}
          <ListRow
            icon="add-circle-outline"
            label={t('settings.subscription.buyCredits')}
            onPress={() => router.push({ pathname: '/credits', params: { source: 'settings' } })}
            testID="settings-credits"
          />
        </Section>

        <Section title={t('settings.sections.language')}>
          <ListRow
            icon="language-outline"
            label={t('settings.language.title')}
            value={LANGUAGE_NAMES[language]}
            onPress={() => setPicker(true)}
            testID="settings-language"
          />
        </Section>

        <Section title={t('settings.sections.notifications')}>
          {systemNotifications === 'denied' ? (
            <ListRow
              icon="notifications-off-outline"
              label={t('settings.notifications.systemOff')}
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
          <ListRow
            icon="image-outline"
            label={t('settings.notifications.previews')}
            toggle={{ value: preferences.notifyPreviews, onChange: toggle('notifyPreviews') }}
            testID="settings-notify-previews"
          />
          <ListRow
            icon="gift-outline"
            label={t('settings.notifications.offers')}
            toggle={{ value: preferences.notifyOffers, onChange: toggle('notifyOffers') }}
            testID="settings-notify-offers"
          />
          <ListRow
            icon="calendar-outline"
            label={t('settings.notifications.reminders')}
            toggle={{ value: preferences.notifyReminders, onChange: toggle('notifyReminders') }}
            testID="settings-notify-reminders"
          />
          <Hint>{t('settings.notifications.remindersHint')}</Hint>
        </Section>

        <Section title={t('settings.sections.preferences')}>
          <ListRow
            icon="pulse-outline"
            label={t('settings.preferences.haptics')}
            toggle={{ value: preferences.haptics, onChange: toggle('haptics') }}
            testID="settings-haptics"
          />
        </Section>

        <Section title={t('settings.sections.data')}>
          <ListRow
            icon="trash-bin-outline"
            label={t('settings.data.wipe')}
            onPress={() => setConfirm('wipe')}
            destructive
            testID="settings-wipe"
          />
          <Hint>{t('settings.data.wipeHint')}</Hint>
        </Section>

        <Section title={t('settings.sections.account')}>
          <ListRow
            icon="person-circle-outline"
            label={t('settings.account.guest')}
            value={uid ? uid.slice(0, 8) : undefined}
          />
          <ListRow
            icon="trash-outline"
            label={t('settings.account.delete')}
            onPress={() => setConfirm('account')}
            destructive
            testID="delete-account"
          />
          <Hint>{t('settings.account.deleteHint')}</Hint>
        </Section>

        <Section title={t('settings.sections.legal')}>
          <ListRow icon="shield-outline" label={t('settings.legal.privacy')} onPress={() => openLegal('privacy')} />
          <ListRow icon="document-text-outline" label={t('settings.legal.terms')} onPress={() => openLegal('terms')} />
          <ListRow icon="sparkles-outline" label={t('settings.legal.ai')} onPress={() => openLegal('ai')} />
          <ListRow icon="help-buoy-outline" label={t('settings.legal.support')} onPress={() => openLegal('support')} />
        </Section>

        <Section title={t('settings.sections.about')}>
          {supportEmail ? (
            <ListRow
              icon="mail-outline"
              label={t('settings.about.contact')}
              onPress={() => void Linking.openURL(`mailto:${supportEmail}`)}
            />
          ) : null}
          <ListRow
            icon="heart-outline"
            label={t('settings.about.rate')}
            onPress={() => {
              const url = StoreReview.storeUrl();
              if (url) void Linking.openURL(url);
            }}
          />
          <ListRow
            icon="play-back-outline"
            label={t('settings.about.replay')}
            onPress={() => {
              useSession.getState().replayOnboarding();
              router.replace('/onboarding');
            }}
            testID="settings-replay"
          />
          <ListRow icon="information-circle-outline" label={t('settings.about.version', { version, build })} />
        </Section>

        {backendMode !== 'live' ? (
          <Section title={t('settings.sections.developer')}>
            <ListRow
              icon="construct-outline"
              label={t('settings.developer.open')}
              onPress={() => router.push('/developer')}
              testID="open-developer"
            />
          </Section>
        ) : null}
        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal visible={picker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicker(false)}>
        <SafeAreaView style={styles.pickerRoot} edges={['top', 'bottom']}>
          <View style={styles.pickerTop}>
            <AppText variant="title2" accessibilityRole="header" style={styles.pickerTitle}>
              {t('settings.language.pickerTitle')}
            </AppText>
            <CloseButton onPress={() => setPicker(false)} testID="language-close" />
          </View>
          <FlatList
            data={LANGUAGES}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => {
              const selected = item === language;
              return (
                <PressableScale
                  onPress={() => void pickLanguage(item)}
                  haptic="selection"
                  pressedScale={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={LANGUAGE_NAMES[item]}
                  accessibilityLanguage={item}
                  style={[styles.languageRow, selected && styles.languageSelected]}
                  testID={`language-${item}`}
                >
                  <AppText variant="body" style={styles.languageName}>
                    {LANGUAGE_NAMES[item]}
                  </AppText>
                  {selected ? (
                    <AppText variant="caption" color="primary">
                      {t('ui.a11y.selected')}
                    </AppText>
                  ) : null}
                </PressableScale>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <ConfirmSheet
        visible={confirm === 'wipe'}
        title={t('settings.data.wipeTitle')}
        body={t('settings.data.wipeBody')}
        confirmLabel={busy ? t('settings.data.wiping') : t('settings.data.wipeConfirm')}
        destructive
        loading={busy}
        onConfirm={() => void wipeData()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        visible={confirm === 'account'}
        title={t('settings.account.deleteTitle')}
        body={t('settings.account.deleteBody')}
        confirmLabel={busy ? t('settings.account.deleting') : t('settings.account.deleteConfirm')}
        destructive
        loading={busy}
        onConfirm={() => void deleteAccount()}
        onCancel={() => setConfirm(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    gap: spacing.xl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.xs },
  hint: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  bottomSpace: { height: layout.tabBarClearance },
  pickerRoot: { flex: 1, backgroundColor: colors.bgElevated },
  pickerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
  },
  pickerTitle: { flex: 1 },
  pickerList: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.huge, gap: spacing.xs },
  languageRow: {
    minHeight: minTouch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  languageSelected: { borderWidth: 1.5, borderColor: colors.primary },
  languageName: { flex: 1 },
});
