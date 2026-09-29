import * as StoreReview from 'expo-store-review';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { StageBackground } from '@/components/StageBackground';
import { colors, layout, spacing } from '@/theme/tokens';

/** Forced-update gate (Remote Config `min_supported_build`). Journey data stays on the device. */
export default function UpdateScreen() {
  const { t } = useTranslation();
  const url = StoreReview.storeUrl();
  return (
    <View style={styles.root}>
      <StageBackground animated={false} />
      <View style={styles.body}>
        <AppText variant="title1" align="center" accessibilityRole="header">
          {t('ui.update.title')}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {t('ui.update.body')}
        </AppText>
        {url ? (
          <Button
            label={t('ui.update.cta')}
            onPress={() => void Linking.openURL(url)}
            shine
            style={styles.button}
            testID="update-cta"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    justifyContent: 'center',
    padding: layout.screenPadding,
    gap: spacing.md,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  button: { marginTop: spacing.lg },
});
