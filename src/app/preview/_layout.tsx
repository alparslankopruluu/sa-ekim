import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/** The preview flow (style → rendering → result) is one modal stack. */
export default function PreviewLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
