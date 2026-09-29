import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { STAGES, type Stage } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { OptionCard } from '@/components/OptionCard';
import { useSession } from '@/stores/session';
import { spacing } from '@/theme/tokens';

import { STAGE_ICON } from './meta';
import { useEntering } from './motion';
import { useAutoAdvance } from './useAutoAdvance';

function StageOption({ stage, index, selected, onChoose }: { stage: Stage; index: number; selected: boolean; onChoose: (s: Stage) => void }) {
  const { t } = useTranslation();
  const entering = useEntering('down', 80 + index * 60);
  return (
    <Animated.View entering={entering}>
      <OptionCard
        testID={`stage-${stage}`}
        icon={STAGE_ICON[stage]}
        title={t(`onboarding.stage.${stage}.title`)}
        subtitle={t(`onboarding.stage.${stage}.subtitle`)}
        selected={selected}
        onPress={() => onChoose(stage)}
      />
    </Animated.View>
  );
}

export function StageStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const stage = useSession((s) => s.stage);
  const setStage = useSession((s) => s.setStage);
  const header = useEntering('up');
  const advance = useAutoAdvance(onNext);

  const choose = (value: Stage) => {
    setStage(value);
    advance();
  };

  return (
    <View style={styles.container}>
      <Animated.View entering={header} style={styles.header}>
        <AppText variant="title1" accessibilityRole="header">
          {t('onboarding.stage.title')}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {t('onboarding.stage.subtitle')}
        </AppText>
      </Animated.View>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        accessibilityRole="radiogroup"
        contentInsetAdjustmentBehavior="never"
      >
        {STAGES.map((value, index) => (
          <StageOption key={value} stage={value} index={index} selected={stage === value} onChoose={choose} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
});
