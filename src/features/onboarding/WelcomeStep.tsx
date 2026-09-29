import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { BeforeAfterWipe } from '@/components/BeforeAfterWipe';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { colors, radius, spacing } from '@/theme/tokens';

import { DEMO_AFTER, DEMO_BEFORE } from './demoCards';
import { useEntering } from './motion';
import { StepScaffold } from './StepScaffold';

/** The pinned footer must leave room for the scrollable content at accessibility sizes. */
const LEGAL_SCALE_CAP = 1.3;
const DEMO_HEIGHT = 250;

function openDoc(doc: 'terms' | 'privacy') {
  router.push({ pathname: '/legal/[doc]', params: { doc } });
}

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const kicker = useEntering('down');
  const copy = useEntering('up', 120);
  const demo = useEntering('up', 240);
  const footer = useEntering('up', 360);

  return (
    <StepScaffold
      contentStyle={styles.content}
      footer={
        <Animated.View entering={footer} style={styles.footer}>
          <Button label={t('onboarding.welcome.cta')} onPress={onNext} shine testID="welcome-cta" />
          <View style={styles.legal}>
            <AppText variant="caption" color="textTertiary" align="center" maxFontSizeMultiplier={LEGAL_SCALE_CAP}>
              {t('onboarding.welcome.legalPrefix')}
            </AppText>
            <View style={styles.legalLinks}>
              <PressableScale
                onPress={() => openDoc('terms')}
                haptic="none"
                accessibilityRole="link"
                accessibilityLabel={t('onboarding.welcome.terms')}
                style={styles.link}
              >
                <AppText variant="caption" color="primary" maxFontSizeMultiplier={LEGAL_SCALE_CAP}>
                  {t('onboarding.welcome.terms')}
                </AppText>
              </PressableScale>
              <PressableScale
                onPress={() => openDoc('privacy')}
                haptic="none"
                accessibilityRole="link"
                accessibilityLabel={t('onboarding.welcome.privacy')}
                style={styles.link}
              >
                <AppText variant="caption" color="primary" maxFontSizeMultiplier={LEGAL_SCALE_CAP}>
                  {t('onboarding.welcome.privacy')}
                </AppText>
              </PressableScale>
            </View>
          </View>
        </Animated.View>
      }
    >
      <Animated.View entering={kicker} style={styles.kicker}>
        <AppText variant="micro" color="accent">
          {t('onboarding.welcome.kicker')}
        </AppText>
      </Animated.View>

      <Animated.View entering={copy} style={styles.copy}>
        <AppText variant="display" align="center" accessibilityRole="header">
          {t('onboarding.welcome.title')}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {t('onboarding.welcome.subtitle')}
        </AppText>
      </Animated.View>

      <Animated.View entering={demo} style={styles.demo}>
        <BeforeAfterWipe
          beforeUri={DEMO_BEFORE}
          afterUri={DEMO_AFTER}
          beforeLabel={t('onboarding.welcome.demoBefore')}
          afterLabel={t('onboarding.welcome.demoAfter')}
          accessibilityLabel={t('onboarding.welcome.demoLabel')}
          height={DEMO_HEIGHT}
          initial={0.5}
        />
        <AppText variant="caption" color="textTertiary" align="center">
          {t('onboarding.welcome.demoCaption')}
        </AppText>
      </Animated.View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between', gap: spacing.lg },
  kicker: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.strokeStrong,
    backgroundColor: colors.surface,
  },
  copy: { gap: spacing.md, paddingHorizontal: spacing.sm },
  demo: { gap: spacing.sm },
  footer: { gap: spacing.sm },
  legal: { alignItems: 'center' },
  legalLinks: { flexDirection: 'row', gap: spacing.lg },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
});
