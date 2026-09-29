import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GOALS, type Goal } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { OptionCard } from '@/components/OptionCard';
import { useSession } from '@/stores/session';
import { palettes, spacing } from '@/theme/tokens';

import { GOAL_ICON, GOAL_PALETTE } from './meta';
import { useEntering } from './motion';
import { useAutoAdvance } from './useAutoAdvance';

function GoalOption({ goal, index, selected, onChoose }: { goal: Goal; index: number; selected: boolean; onChoose: (g: Goal) => void }) {
  const { t } = useTranslation();
  const entering = useEntering('down', 80 + index * 60);
  return (
    <Animated.View entering={entering}>
      <OptionCard
        testID={`goal-${goal}`}
        icon={GOAL_ICON[goal]}
        title={t(`onboarding.goal.${goal}.title`)}
        subtitle={t(`onboarding.goal.${goal}.subtitle`)}
        selected={selected}
        gradient={palettes[GOAL_PALETTE[goal]]}
        onPress={() => onChoose(goal)}
      />
    </Animated.View>
  );
}

export function GoalStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const goal = useSession((s) => s.goal);
  const setGoal = useSession((s) => s.setGoal);
  const header = useEntering('up');
  const advance = useAutoAdvance(onNext);

  const choose = (value: Goal) => {
    setGoal(value);
    advance();
  };

  return (
    <View style={styles.container}>
      <Animated.View entering={header} style={styles.header}>
        <AppText variant="title1" accessibilityRole="header">
          {t('onboarding.goal.title')}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {t('onboarding.goal.subtitle')}
        </AppText>
      </Animated.View>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        accessibilityRole="radiogroup"
        contentInsetAdjustmentBehavior="never"
      >
        {GOALS.map((value, index) => (
          <GoalOption key={value} goal={value} index={index} selected={goal === value} onChoose={choose} />
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
