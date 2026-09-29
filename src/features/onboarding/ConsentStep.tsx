import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { ConsentBody, useConsentAccept } from '@/components/ConsentCard';
import { spacing } from '@/theme/tokens';

import { useEntering } from './motion';
import { StepScaffold } from './StepScaffold';

/**
 * AI-processing disclosure before the selfie leaves the phone. The body scrolls; accept and
 * decline stay pinned. Declining is a real choice: the flow continues without a preview.
 */
export function ConsentStep({ onAccepted, onDeclined }: { onAccepted: () => void; onDeclined: () => void }) {
  const { t } = useTranslation();
  const { accept, busy } = useConsentAccept(onAccepted);
  const body = useEntering('up');

  return (
    <StepScaffold
      contentStyle={styles.content}
      footer={
        <>
          <Button label={t('consent.accept')} onPress={() => void accept()} loading={busy} shine testID="consent-accept" />
          <Button label={t('consent.decline')} onPress={onDeclined} variant="ghost" size="md" disabled={busy} testID="consent-decline" />
        </>
      }
    >
      <Animated.View entering={body} style={styles.body}>
        <View>
          <ConsentBody />
        </View>
      </Animated.View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md },
  body: { gap: spacing.md },
});
