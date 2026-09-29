import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme/tokens';

interface StepScaffoldProps {
  children: ReactNode;
  /** Pinned below the scrollable content (primary CTA, skip link). */
  footer: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Onboarding step layout: content scrolls, the footer stays pinned. At default text sizes the
 * content fills the screen like a static layout; at the largest Dynamic Type sizes it scrolls
 * instead of pushing the CTA off-screen.
 */
export function StepScaffold({ children, footer, contentStyle }: StepScaffoldProps) {
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        // The parent SafeAreaView already applies the insets; iOS must not add them again.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingBottom: spacing.lg },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.md },
  footer: { gap: spacing.xs, paddingTop: spacing.sm },
});
