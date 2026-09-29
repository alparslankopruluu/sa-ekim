import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { IsoDate } from '@shared/timeline';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { currentLocaleTag } from '@/lib/i18n';
import { formatIsoDate, type PrpSessionLike } from '@/lib/phaseView';
import { colors, minTouch, radius, spacing } from '@/theme/tokens';

import { DateWheelPicker } from './DateWheelPicker';
import { Tag } from './Tag';

export interface SessionsListProps {
  /** Sessions in date order. */
  sessions: readonly PrpSessionLike[];
  today: IsoDate;
  editingId: string | null;
  canRemove: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string | null) => void;
  onDateChange: (id: string, date: IsoDate) => void;
  onPhoto: (id: string) => void;
  onRemove: (id: string) => void;
}

/** PRP / mesotherapy sessions: done toggles, editable dates, a photo prompt before each one. */
export function SessionsList({
  sessions,
  today,
  editingId,
  canRemove,
  onToggle,
  onEdit,
  onDateChange,
  onPhoto,
  onRemove,
}: SessionsListProps) {
  const { t } = useTranslation();
  const locale = currentLocaleTag();
  const todayYear = Number(today.slice(0, 4));

  return (
    <View style={styles.list}>
      {sessions.map((session, index) => {
        const date = formatIsoDate(session.date, locale, 'long');
        const due = !session.done && session.date <= today;
        const editing = editingId === session.id;
        const number = index + 1;
        const status = session.done ? t('journey.prp.done') : due ? t('journey.prp.due') : t('journey.prp.planned');
        return (
          <View key={session.id} style={styles.card} testID={`session-${session.id}`}>
            <View style={styles.row}>
              <PressableScale
                onPress={() => onToggle(session.id)}
                haptic="selection"
                accessibilityRole="checkbox"
                accessibilityLabel={t('journey.prp.markDoneLabel', { number, date })}
                accessibilityState={{ checked: session.done }}
                style={styles.check}
                testID={`session-toggle-${session.id}`}
              >
                <Ionicons
                  name={session.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={28}
                  color={session.done ? colors.sage : colors.textTertiary}
                />
              </PressableScale>
              <View style={styles.info}>
                <AppText variant="headline">{t('journey.prp.session', { number })}</AppText>
                <AppText variant="callout" color="textSecondary">
                  {date}
                </AppText>
              </View>
              <Tag label={status} tone={session.done ? 'sage' : due ? 'gold' : 'neutral'} />
            </View>
            <View style={styles.actions}>
              <Button
                label={editing ? t('common.done') : t('journey.prp.changeDate')}
                icon={editing ? 'checkmark' : 'calendar-outline'}
                variant="ghost"
                size="sm"
                onPress={() => onEdit(editing ? null : session.id)}
              />
              {!session.done ? (
                <Button label={t('journey.prp.photoBefore')} icon="camera-outline" variant="ghost" size="sm" onPress={() => onPhoto(session.id)} />
              ) : null}
              {canRemove ? (
                <Button label={t('journey.prp.remove')} icon="trash-outline" variant="ghost" size="sm" onPress={() => onRemove(session.id)} />
              ) : null}
            </View>
            {editing ? (
              <DateWheelPicker
                value={session.date}
                onChange={(next) => onDateChange(session.id, next)}
                anchorYear={todayYear}
                yearsBack={1}
                yearsForward={2}
                fadeColor={colors.surface}
                labels={{ day: t('journey.setup.day'), month: t('journey.setup.month'), year: t('journey.setup.year') }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  check: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
