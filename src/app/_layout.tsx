import '@/lib/i18n';
// Restores a saved in-app language choice on cold start (Settings → Language).
import '@/features/settings/language';

import * as Application from 'expo-application';
import { useFonts } from 'expo-font';
import { DarkTheme, router, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ToastHost } from '@/components/Toast';
import { startTrace } from '@/services/analytics';
import { recordNonFatal } from '@/services/crash';
import { onNotificationTap } from '@/services/notifications';
import { remoteNumber } from '@/services/remoteConfig';
import { startSession } from '@/services/session';
import { useSession } from '@/stores/session';
import { colors, spacing } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const launchTrace = startTrace('app_start_to_onboarding');

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    border: colors.stroke,
    notification: colors.primary,
  },
};

export default function RootLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const [fontsLoaded, fontError] = useFonts({
    'DMSerifDisplay-Regular': require('../../assets/fonts/DMSerifDisplay-Regular.ttf'),
    'DMSerifDisplay-Italic': require('../../assets/fonts/DMSerifDisplay-Italic.ttf'),
  });
  const ready = hydrated && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    launchTrace.stop();
    // Heavy init after the first frame (docs/checklists/performance.md).
    const frame = requestAnimationFrame(() => {
      void startSession().then(() => {
        const minBuild = remoteNumber('min_supported_build');
        const build = Number(Application.nativeBuildVersion ?? '0');
        if (build > 0 && minBuild > build) router.replace('/update');
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(
    () =>
      onNotificationTap((tap) => {
        switch (tap.type) {
          case 'preview_ready':
            router.push({ pathname: '/preview/result', params: { previewId: tap.previewId } });
            break;
          case 'offer':
            router.push({ pathname: '/paywall', params: { source: 'notification' } });
            break;
          case 'gift_expiring':
            router.push({ pathname: '/gift', params: { source: 'notification' } });
            break;
          case 'phase':
            router.push({ pathname: '/guide/[phase]', params: { phase: tap.phase } });
            break;
          case 'photo_due':
            router.push('/capture');
            break;
          case 'shed':
            router.push('/shed');
            break;
          default:
            router.push('/(tabs)');
        }
      }),
    [],
  );

  if (!ready) return <View style={styles.root} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="preview" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }} />
            <Stack.Screen name="compare" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="shed" options={{ presentation: 'modal' }} />
            <Stack.Screen name="journey-setup" options={{ presentation: 'modal' }} />
            <Stack.Screen name="photo/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="guide/[phase]" />
            <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="gift" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="credits" options={{ presentation: 'modal' }} />
            <Stack.Screen name="consent" options={{ presentation: 'modal' }} />
            <Stack.Screen name="report" options={{ presentation: 'modal' }} />
            <Stack.Screen name="legal/[doc]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="developer" options={{ presentation: 'modal' }} />
            <Stack.Screen name="update" options={{ gestureEnabled: false, animation: 'fade' }} />
          </Stack>
          <ToastHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  useEffect(() => {
    recordNonFatal(error, 'route_error_boundary');
  }, [error]);
  return (
    <View style={[styles.root, styles.center]}>
      <AppText variant="title1" align="center">
        {t('errorBoundary.title')}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {t('errorBoundary.body')}
      </AppText>
      <Button label={t('errorBoundary.retry')} onPress={() => void retry()} style={styles.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  retry: { alignSelf: 'stretch', marginTop: spacing.lg },
});
