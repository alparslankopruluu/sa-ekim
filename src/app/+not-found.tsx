import { Ionicons } from '@expo/vector-icons';
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
      <Ionicons name="leaf-outline" size={48} color={colors.sage} style={styles.icon} />
      <AppText variant="title1" align="center" accessibilityRole="header">
        {t('ui.notFound.title')}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {t('ui.notFound.body')}
      </AppText>
      <Button label={t('ui.notFound.cta')} onPress={() => router.replace('/')} style={styles.button} testID="not-found-home" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: layout.screenPadding, gap: spacing.md },
  icon: { alignSelf: 'center' },
  button: { marginTop: spacing.lg },
});
