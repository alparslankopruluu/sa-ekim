import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, layout, spacing } from '@/theme/tokens';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <AppText style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
        {'🎤'}
      </AppText>
      <AppText variant="title1" align="center">
        {t('notFound.title')}
      </AppText>
      <Button label={t('notFound.cta')} onPress={() => router.replace('/')} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: layout.screenPadding, gap: spacing.md },
  emoji: { fontSize: 56, lineHeight: 64, textAlign: 'center' },
  button: { marginTop: spacing.lg },
});
