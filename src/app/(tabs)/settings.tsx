import * as Application from 'expo-application';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CALLABLES } from '@shared/api';

import { AppText } from '@/components/AppText';
import { showToast } from '@/components/Toast';
import { Card, ListRow } from '@/components/ui';
import { currentLocaleTag } from '@/lib/i18n';
import { setUserProperty, track, trackScreen } from '@/services/analytics';
import { getBackend, isMockBackend } from '@/services/backend';
import { appExtra } from '@/services/backend/mode';
import { getPermissionState, registerPushToken } from '@/services/notifications';
import { purchases } from '@/services/purchases';
import { startSession, stopSession } from '@/services/session';
import { useAccount } from '@/stores/account';
import { type Preferences, useSession } from '@/stores/session';
import { colors, layout, spacing } from '@/theme/tokens';

const MANAGE_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
  default: 'https://apps.apple.com/account/subscriptions',
});

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

export default function SettingsScreen() {
  const { t } = useTranslation();
  const uid = useAccount((s) => s.uid);
  const entitlement = useAccount((s) => s.entitlement);
  const wallet = useAccount((s) => s.wallet);
  const preferences = useSession((s) => s.preferences);
  const setPreference = useSession((s) => s.setPreference);
  const [systemNotifications, setSystemNotifications] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    trackScreen('settings');
    void getPermissionState().then(setSystemNotifications);
  }, []);

  const toggle = (key: keyof Preferences) => (value: boolean) => {
    setPreference(key, value);
    if (key === 'notifyOffers') {
      setUserProperty('offers_opt_in', value ? 'yes' : 'no');
      void registerPushToken();
    }
  };

  const restore = async () => {
    try {
      const state = await purchases.restore();
      showToast(state.isPro ? t('paywall.restoreSuccess') : t('paywall.restoreNone'), state.isPro ? 'success' : 'info');
    } catch {
      showToast(t('errors.offline'), 'error');
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await getBackend().functions.call(CALLABLES.deleteAccount, {}, 60000);
      track('account_deleted', { had_pro: entitlement.isPro });
      stopSession();
      await getBackend().auth.signOutLocal();
      useAccount.getState().reset();
      useSession.getState().resetAll();
      showToast(t('settings.account.deleted'), 'success');
      router.replace('/onboarding');
      void startSession();
    } catch {
      showToast(t('errors.unknown'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Double confirmation for an irreversible action (docs/checklists/accessibility.md).
  const confirmDelete = () => {
    Alert.alert(t('settings.account.deleteTitle'), t('settings.account.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.continue'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('settings.account.deleteConfirmTitle'), t('settings.account.deleteConfirmBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.account.deleteConfirm'), style: 'destructive', onPress: () => void deleteAccount() },
          ]),
      },
    ]);
  };

  const planLabel = entitlement.isPro
    ? entitlement.isTrial
      ? t('settings.subscription.trial')
      : t('settings.subscription.pro')
    : t('settings.subscription.free');
  const date = entitlement.expiresAt
    ? new Date(entitlement.expiresAt).toLocaleDateString(currentLocaleTag(), { dateStyle: 'medium' })
    : null;
  const version = Application.nativeApplicationVersion ?? '1.0.0';
  const build = Application.nativeBuildVersion ?? '1';
  const supportEmail = appExtra.legal?.supportEmail;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppText variant="title1" accessibilityRole="header">
          {t('settings.title')}
        </AppText>

        <Section title={t('settings.sections.subscription')}>
          <ListRow
            icon="star"
            label={planLabel}
            value={
              date
                ? entitlement.willRenew
                  ? t('settings.subscription.renews', { date })
                  : t('settings.subscription.expires', { date })
                : undefined
            }
          />
          {entitlement.isPro ? (
            <ListRow icon="card-outline" label={t('settings.subscription.manage')} onPress={() => void Linking.openURL(MANAGE_URL)} />
          ) : (
            <ListRow
              icon="rocket-outline"
              label={t('settings.subscription.upgrade')}
              onPress={() => router.push({ pathname: '/paywall', params: { source: 'settings' } })}
              testID="settings-upgrade"
            />
          )}
          <ListRow icon="refresh-outline" label={t('settings.subscription.restore')} onPress={() => void restore()} />
        </Section>

        <Section title={t('settings.sections.credits')}>
          <ListRow icon="flash-outline" label={t('settings.credits.balance')} value={t('common.credits', { count: wallet.balance })} />
          {wallet.freePosterTokens > 0 ? (
            <ListRow icon="color-palette-outline" label={t('settings.credits.freePoster', { count: wallet.freePosterTokens })} />
          ) : null}
          {wallet.hdBoostTokens > 0 ? (
            <ListRow icon="sparkles-outline" label={t('settings.credits.hdBoost', { count: wallet.hdBoostTokens })} />
          ) : null}
          <ListRow
            icon="add-circle-outline"
            label={t('settings.credits.buy')}
            onPress={() => router.push({ pathname: '/credits', params: { source: 'settings' } })}
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
            icon="videocam-outline"
            label={t('settings.notifications.renders')}
            toggle={{ value: preferences.notifyRenders, onChange: toggle('notifyRenders') }}
          />
          <ListRow
            icon="gift-outline"
            label={t('settings.notifications.offers')}
            toggle={{ value: preferences.notifyOffers, onChange: toggle('notifyOffers') }}
          />
          <ListRow
            icon="calendar-outline"
            label={t('settings.notifications.reminders')}
            toggle={{ value: preferences.notifyReminders, onChange: toggle('notifyReminders') }}
          />
        </Section>

        <Section title={t('settings.sections.preferences')}>
          <ListRow icon="pulse-outline" label={t('settings.preferences.haptics')} toggle={{ value: preferences.haptics, onChange: toggle('haptics') }} />
          <ListRow icon="volume-medium-outline" label={t('settings.preferences.sounds')} toggle={{ value: preferences.sounds, onChange: toggle('sounds') }} />
        </Section>

        <Section title={t('settings.sections.account')}>
          <ListRow icon="person-circle-outline" label={t('settings.account.guest')} value={uid ? uid.slice(0, 8) : undefined} />
          <ListRow
            icon="trash-outline"
            label={deleting ? t('settings.account.deleting') : t('settings.account.delete')}
            onPress={deleting ? undefined : confirmDelete}
            destructive
            testID="delete-account"
          />
        </Section>

        <Section title={t('settings.sections.legal')}>
          <ListRow icon="shield-outline" label={t('settings.legal.privacy')} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
          <ListRow icon="document-text-outline" label={t('settings.legal.terms')} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
          <ListRow icon="sparkles-outline" label={t('settings.legal.ai')} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'ai' } })} />
        </Section>

        <Section title={t('settings.sections.about')}>
          {supportEmail ? (
            <ListRow icon="mail-outline" label={t('settings.about.support')} onPress={() => void Linking.openURL(`mailto:${supportEmail}`)} />
          ) : null}
          <ListRow
            icon="heart-outline"
            label={t('settings.about.rate')}
            onPress={() => {
              const url = StoreReview.storeUrl();
              if (url) void Linking.openURL(url);
            }}
          />
          <ListRow icon="information-circle-outline" label={t('settings.about.version', { version, build })} />
        </Section>

        {__DEV__ || isMockBackend ? (
          <Section title={t('settings.sections.developer')}>
            <ListRow icon="construct-outline" label={t('settings.sections.developer')} onPress={() => router.push('/developer')} testID="open-developer" />
          </Section>
        ) : null}
        <View style={{ height: layout.tabBarClearance }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.md, gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.xs },
});
