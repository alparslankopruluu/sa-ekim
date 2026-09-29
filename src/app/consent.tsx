import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsentCard } from '@/components/ConsentCard';
import { CloseButton } from '@/components/ui';
import { colors, layout, spacing } from '@/theme/tokens';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

/**
 * Standalone AI-processing consent, opened by the preview flow when consent is missing.
 * Accepting records it (server + device) and returns to the caller, which re-checks
 * `hasConsent()`; declining just returns.
 */
export default function ConsentScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <CloseButton onPress={leave} />
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <ConsentCard onAccepted={leave} onDeclined={leave} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgElevated, paddingHorizontal: layout.screenPadding },
  top: { alignItems: 'flex-end', paddingVertical: spacing.sm },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingBottom: spacing.xl,
  },
});
