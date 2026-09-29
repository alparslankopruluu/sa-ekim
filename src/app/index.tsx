import { Redirect } from 'expo-router';

import { useSession } from '@/stores/session';

/** Entry: first launch goes to onboarding, everyone else to the Create tab. */
export default function Index() {
  const onboardingCompleted = useSession((s) => s.onboardingCompleted);
  return <Redirect href={onboardingCompleted ? '/(tabs)' : '/onboarding'} />;
}
