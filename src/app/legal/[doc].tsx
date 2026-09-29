import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CloseButton } from '@/components/ui';
import { appExtra } from '@/services/backend/mode';
import { colors, layout, spacing } from '@/theme/tokens';

type Doc = 'privacy' | 'terms' | 'ai';
const LAST_UPDATED = '2026-09-26';

interface Section {
  heading: string;
  body: string;
}

/** In-app legal pages (always available offline); opens the web version when configured. */
export default function LegalScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ doc?: string }>();
  const doc: Doc = params.doc === 'terms' || params.doc === 'ai' ? params.doc : 'privacy';
  const sections = t(`legal.${doc}.sections`, { returnObjects: true }) as unknown as Section[];
  const webUrl = doc === 'privacy' ? appExtra.legal?.privacyUrl : doc === 'terms' ? appExtra.legal?.termsUrl : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <AppText variant="title2" accessibilityRole="header" style={styles.title}>
          {t(`legal.${doc}.title`)}
        </AppText>
        <CloseButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppText variant="caption" color="textTertiary">
          {t('legal.updated', { date: LAST_UPDATED })}
        </AppText>
        {Array.isArray(sections)
          ? sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <AppText variant="headline" accessibilityRole="header">
                  {section.heading}
                </AppText>
                <AppText variant="body" color="textSecondary">
                  {section.body}
                </AppText>
              </View>
            ))
          : null}
        {webUrl ? (
          <Button label={t('legal.openWeb')} variant="secondary" size="md" onPress={() => void WebBrowser.openBrowserAsync(webUrl)} />
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
  scroll: { paddingHorizontal: layout.screenPadding, gap: spacing.xl, paddingBottom: spacing.huge },
  section: { gap: spacing.sm },
});
