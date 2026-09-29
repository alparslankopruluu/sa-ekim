import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsentCard } from '@/components/ConsentCard';
import { CloseButton } from '@/components/ui';
import { colors, layout, spacing } from '@/theme/tokens';

/** Standalone AI-processing consent (used when a flow needs it outside onboarding). */
export default function ConsentScreen() {
  const params = useLocalSearchParams<{ next?: string }>();
  const done = () => {
    if (router.canGoBack()) router.back();
    if (params.next === 'create') router.push('/create');
  };
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <CloseButton onPress={() => router.back()} />
      </View>
      <View style={styles.body}>
        <ConsentCard onAccepted={done} onDeclined={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgElevated, paddingHorizontal: layout.screenPadding },
  top: { alignItems: 'flex-end', paddingVertical: spacing.sm },
  body: { flex: 1, justifyContent: 'center' },
});
