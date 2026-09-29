import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import { useAccount } from '@/stores/account';
import { colors } from '@/theme/tokens';

/**
 * System tab bar: UITabBar (Liquid Glass on iOS 26) and Material 3 bottom
 * navigation on Android — no custom chrome to maintain.
 * Tabs: Today (day/phase/next task) · Journey (timeline + photos) · Previews · Settings.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const rendering = useAccount(
    (s) => s.previews.filter((p) => p.status === 'queued' || p.status === 'processing' || p.status === 'finalizing').length,
  );

  return (
    <NativeTabs tintColor={colors.primary} iconColor={colors.textSecondary} labelStyle={{ color: colors.textSecondary }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('nav.today')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="wb_sunny" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journey">
        <NativeTabs.Trigger.Label>{t('nav.journey')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.line.uptrend.xyaxis', selected: 'chart.line.uptrend.xyaxis' }}
          md="show_chart"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="previews">
        <NativeTabs.Trigger.Label>{t('nav.previews')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'wand.and.stars', selected: 'wand.and.stars' }} md="auto_fix_high" />
        {rendering > 0 ? <NativeTabs.Trigger.Badge>{String(rendering)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('nav.settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
