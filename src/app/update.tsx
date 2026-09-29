import * as StoreReview from 'expo-store-review';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { StageBackground } from '@/components/StageBackground';
import { colors, layout, spacing } from '@/theme/tokens';

/** Forced-update gate (Remote Config `min_supported_build`). */
export default function UpdateScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <StageBackground animated={false} />
      <View style={styles.body}>
        <AppText variant="title1" align="center" accessibilityRole="header">
          {t('forceUpdate.title')}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {t('forceUpdate.body')}
        </AppText>
        <Button
          label={t('forceUpdate.cta')}
          onPress={() => {
            const url = StoreReview.storeUrl();
            if (url) void Linking.openURL(url);
          }}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, justifyContent: 'center', padding: layout.screenPadding, gap: spacing.md },
  button: { marginTop: spacing.lg },
});
