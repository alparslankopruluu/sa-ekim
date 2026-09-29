import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ANGLES_BY_GOAL, type Angle } from '@shared/catalog';
import { FREE_LIMITS } from '@shared/pricing';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { PressableScale } from '@/components/PressableScale';
import { EmptyState } from '@/components/ui';
import { currentLocaleTag } from '@/lib/i18n';
import { addDays, formatIsoDate, groupPhotosByWeek, type PhotoGroup, type PhotoLike } from '@/lib/phaseView';
import { colors, gradients, layout, minTouch, radius, spacing } from '@/theme/tokens';

import { useJourneyAccess, useStartCapture } from './access';
import type { JourneyView } from './useJourneyView';

const GAP = spacing.sm;
const COLUMNS = 3;
const MAX_SELECT = 2;

function Thumb({
  photo,
  size,
  selected,
  selecting,
  label,
  onPress,
}: {
  photo: PhotoLike;
  size: number;
  selected: boolean;
  selecting: boolean;
  label: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.97}
      haptic={selecting ? 'selection' : 'tap'}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={selecting ? { checked: selected } : undefined}
      style={[styles.thumb, { width: size, height: size }, selected && styles.thumbSelected]}
      testID={`photo-${photo.id}`}
    >
      {failed ? (
        <View style={styles.thumbMissing}>
          <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
          <AppText variant="micro" color="textTertiary" align="center">
            {t('journey.photos.missing')}
          </AppText>
        </View>
      ) : (
        <Image
          source={{ uri: photo.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={photo.id}
          transition={120}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      )}
      <View style={styles.angleBadge}>
        <AppText variant="micro" style={styles.angleText}>
          {t(`journey.angles.${photo.angle}`)}
        </AppText>
      </View>
      {selecting ? (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? <Ionicons name="checkmark" size={16} color={colors.textOnAccent} /> : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

/** Photos tab: grid grouped by week with angle filters, a free-tier counter and two-photo compare. */
export function PhotosTab({ view }: { view: JourneyView }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const access = useJourneyAccess();
  const startCapture = useStartCapture();
  const locale = currentLocaleTag();
  const [angle, setAngle] = useState<Angle | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const contentWidth = Math.min(width, layout.maxContentWidth) - layout.screenPadding * 2;
  const size = Math.floor((contentWidth - GAP * (COLUMNS - 1)) / COLUMNS);
  const angles = ANGLES_BY_GOAL[view.goal];
  const primary = angle ?? angles[0] ?? 'front';
  const groups = useMemo(
    () => groupPhotosByWeek(view.photos, view.procedureDate, angle),
    [view.photos, view.procedureDate, angle],
  );
  const total = view.photos.length;
  const atLimit = access.loaded && !access.isPro && total >= FREE_LIMITS.journeyPhotos;

  const labelFor = useCallback(
    (group: PhotoGroup): string => {
      if (group.kind === 'before') return t('journey.photos.before');
      if (group.kind === 'week' && group.week && view.procedureDate) {
        return t('journey.photos.week', {
          week: group.week,
          date: formatIsoDate(addDays(view.procedureDate, (group.week - 1) * 7), locale),
        });
      }
      if (group.kind === 'undated' && group.month) {
        const [y, m] = group.month.split('-').map(Number) as [number, number];
        return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        });
      }
      return t('journey.photos.all');
    },
    [locale, t, view.procedureDate],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-MAX_SELECT),
    );
  }, []);

  const exitSelect = useCallback(() => {
    setSelecting(false);
    setSelected([]);
  }, []);

  const openCompare = useCallback(() => {
    const [first, second] = selected
      .map((id) => view.photos.find((p) => p.id === id))
      .filter((p): p is PhotoLike => !!p)
      .sort((a, b) => a.takenAt - b.takenAt);
    if (!first || !second) return;
    exitSelect();
    router.push({ pathname: '/compare', params: { a: first.id, b: second.id } });
  }, [exitSelect, selected, view.photos]);

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.counter}>
          <AppText variant="headline">{t('journey.photos.count', { count: total })}</AppText>
          {access.loaded && !access.isPro ? (
            <AppText variant="caption" color={atLimit ? 'accent' : 'textTertiary'}>
              {atLimit
                ? t('journey.photos.limitReached', { limit: FREE_LIMITS.journeyPhotos })
                : t('journey.photos.freeCounter', { count: total, limit: FREE_LIMITS.journeyPhotos })}
            </AppText>
          ) : null}
        </View>
        <Button
          label={t('journey.photos.add')}
          icon={atLimit ? 'lock-closed' : 'camera'}
          size="sm"
          onPress={() => startCapture(primary)}
          testID="add-photo"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={t('journey.photos.allAngles')}
          selected={angle === null}
          onPress={() => setAngle(null)}
          gradient={gradients.cta}
          style={styles.chip}
        />
        {angles.map((a) => (
          <Chip
            key={a}
            label={t(`journey.angles.${a}`)}
            selected={angle === a}
            onPress={() => setAngle(a)}
            gradient={gradients.cta}
            style={styles.chip}
          />
        ))}
      </ScrollView>
      {total >= 2 ? (
        <View style={styles.compareRow}>
          <AppText variant="caption" color="textSecondary" style={styles.compareHint}>
            {selecting ? t('journey.photos.selectHint') : t('journey.photos.compareHint')}
          </AppText>
          <Button
            label={selecting ? t('common.cancel') : t('journey.photos.compare')}
            icon={selecting ? 'close' : 'git-compare-outline'}
            variant="secondary"
            size="sm"
            onPress={() => (selecting ? exitSelect() : setSelecting(true))}
            testID="compare-toggle"
          />
        </View>
      ) : null}
    </View>
  );

  if (total === 0) {
    return (
      <View style={styles.flex}>
        <EmptyState
          emoji={'📷'}
          title={t('journey.photos.emptyTitle')}
          body={t('journey.photos.emptyBody')}
          action={{ label: t('journey.photos.emptyCta'), onPress: () => startCapture(primary) }}
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlashList
        data={groups}
        keyExtractor={(group) => group.key}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <AppText variant="body" color="textSecondary" align="center" style={styles.emptyFilter}>
            {t('journey.photos.emptyFilter')}
          </AppText>
        }
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingBottom: layout.tabBarClearance + spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: group }) => (
          <View style={styles.group}>
            <View style={styles.groupHead}>
              <AppText variant="headline" accessibilityRole="header">
                {labelFor(group)}
              </AppText>
              <AppText variant="caption" color="textTertiary">
                {t('journey.photos.groupCount', { count: group.photos.length })}
              </AppText>
            </View>
            <View style={styles.grid}>
              {group.photos.map((photo) => (
                <Thumb
                  key={photo.id}
                  photo={photo}
                  size={size}
                  selecting={selecting}
                  selected={selected.includes(photo.id)}
                  label={t('journey.photos.thumbLabel', {
                    angle: t(`journey.angles.${photo.angle}`),
                    group: labelFor(group),
                  })}
                  onPress={() =>
                    selecting
                      ? toggleSelect(photo.id)
                      : router.push({ pathname: '/photo/[id]', params: { id: photo.id } })
                  }
                />
              ))}
            </View>
          </View>
        )}
      />
      {selecting ? (
        <View style={styles.selectBar}>
          <AppText variant="callout" color="textSecondary" style={styles.selectText}>
            {t('journey.photos.selected', { count: selected.length, max: MAX_SELECT })}
          </AppText>
          <Button
            label={t('journey.photos.compareCta')}
            icon="git-compare-outline"
            size="md"
            disabled={selected.length < MAX_SELECT}
            onPress={openCompare}
            testID="compare-open"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: spacing.md, paddingBottom: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  counter: { flex: 1, gap: 2 },
  chips: { gap: spacing.sm, paddingVertical: spacing.xxs },
  chip: { minHeight: minTouch - 6, paddingHorizontal: spacing.md },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  compareHint: { flex: 1 },
  group: { gap: spacing.sm, marginBottom: spacing.xl },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  thumb: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  thumbSelected: { borderColor: colors.primary },
  thumbMissing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.xs },
  angleBadge: {
    position: 'absolute',
    start: spacing.xs,
    bottom: spacing.xs,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  angleText: { color: colors.text },
  check: {
    position: 'absolute',
    top: spacing.xs,
    end: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.scrim,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  emptyFilter: { paddingVertical: spacing.huge },
  selectBar: {
    position: 'absolute',
    start: layout.screenPadding,
    end: layout.screenPadding,
    bottom: layout.tabBarClearance - spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  selectText: { flex: 1 },
});
