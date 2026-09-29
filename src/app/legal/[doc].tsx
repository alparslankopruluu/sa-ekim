/**
 * In-app legal pages (privacy, terms, AI previews, support): always available offline, text
 * from the `legal` namespace. The web version (hosting/public) carries the same text.
 */
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CloseButton } from '@/components/ui';
import { currentLocaleTag } from '@/lib/i18n';
import { trackScreen } from '@/services/analytics';
import { appExtra } from '@/services/backend/mode';
import { colors, layout, spacing } from '@/theme/tokens';

export const LEGAL_DOCS = ['privacy', 'terms', 'ai', 'support'] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

/** Date the texts in `legal.json` and hosting/public were last changed. */
const LAST_UPDATED = new Date(Date.UTC(2026, 8, 29));

interface Section {
  heading: string;
  body: string;
}

function parseDoc(value: unknown): LegalDoc {
  return (LEGAL_DOCS as readonly unknown[]).includes(value) ? (value as LegalDoc) : 'privacy';
}

export default function LegalScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ doc?: string }>();
  const doc = parseDoc(params.doc);
  const raw: unknown = t(`legal.${doc}.sections`, { returnObjects: true });
  const sections = Array.isArray(raw) ? (raw as Section[]) : [];
  const webUrl = doc === 'privacy' ? appExtra.legal?.privacyUrl : doc === 'terms' ? appExtra.legal?.termsUrl : null;
  const supportEmail = appExtra.legal?.supportEmail;
  const updated = LAST_UPDATED.toLocaleDateString(currentLocaleTag(), { dateStyle: 'long', timeZone: 'UTC' });

  useEffect(() => {
    trackScreen(`legal_${doc}`);
  }, [doc]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <AppText variant="title2" accessibilityRole="header" style={styles.title}>
          {t(`legal.${doc}.title`)}
        </AppText>
        <CloseButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'))} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppText variant="caption" color="textTertiary">
          {t('legal.updated', { date: updated })}
        </AppText>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <AppText variant="headline" accessibilityRole="header">
              {section.heading}
            </AppText>
            <AppText variant="body" color="textSecondary">
              {section.body}
            </AppText>
          </View>
        ))}
        <AppText variant="caption" color="textTertiary">
          {t('legal.publisher')}
        </AppText>
        {doc === 'support' && supportEmail ? (
          <Button
            label={t('legal.emailSupport')}
            icon="mail-outline"
            size="md"
            onPress={() => void Linking.openURL(`mailto:${supportEmail}`)}
            testID="legal-email"
          />
        ) : null}
        {webUrl ? (
          <Button
            label={t('legal.openWeb')}
            variant="secondary"
            size="md"
            onPress={() => void WebBrowser.openBrowserAsync(webUrl)}
            testID="legal-web"
          />
        ) : null}
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
  title: { flex: 1 },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.xl,
    paddingBottom: spacing.huge,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  section: { gap: spacing.sm },
});
