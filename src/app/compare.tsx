/**
 * Compare (Pro, spec §4): two journey photos as a wipe or side by side, each with its week
 * label. Default pair: first vs latest photo of the same angle; `/compare?a=&b=` preselects.
 * Free users see the screen with the later photo blurred and a paywall CTA. The screen only
 * shows photos and labels — it never draws a conclusion.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BeforeAfterWipe } from '@/components/BeforeAfterWipe';
import { Button } from '@/components/Button';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { CloseButton, EmptyState } from '@/components/ui';
import { angleMismatch, resolvePair } from '@/features/compare/compareLogic';
import { PhotoStrip } from '@/features/compare/PhotoStrip';
import { formatTakenAt, useWeekLabel } from '@/features/compare/useWeekLabel';
import { openPaywall } from '@/features/journey/access';
import { useEntitlement } from '@/lib/entitlements';
import { currentLocaleTag } from '@/lib/i18n';
import { track } from '@/services/analytics';
import { resolveJourneyUri } from '@/services/journeyFiles';
import { shareComparison } from '@/services/report';
import { type JourneyPhoto, useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type Mode = 'wipe' | 'side';

export default function CompareScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const photos = useJourney((s) => s.photos);
  const procedureDate = useJourney((s) => s.procedureDate);
  const goal = useSession((s) => s.goal);
  const { canUse, loaded } = useEntitlement();
  const gate = canUse('compare');
  const locked = !gate.allowed;
  const weekLabel = useWeekLabel(procedureDate);
  const locale = currentLocaleTag();
  const { width, height } = useWindowDimensions();

  const initial = useMemo(() => resolvePair(photos, params, goal), [photos, params, goal]);
  const [picked, setPicked] = useState<{ a: string; b: string } | null>(null);
  const [mode, setMode] = useState<Mode>('wipe');
  const [sharing, setSharing] = useState(false);
  const opened = useRef(false);

  const pair = useMemo(() => {
    if (!picked) return initial;
    const a = photos.find((p) => p.id === picked.a);
    const b = photos.find((p) => p.id === picked.b);
    return a && b ? { a, b } : initial;
  }, [picked, photos, initial]);

  useEffect(() => {
    if (!loaded || opened.current || !pair) return;
    opened.current = true;
    track('compare_open', { mode: 'wipe', locked });
  }, [loaded, pair, locked]);

  if (!pair) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <AppText variant="title1" accessibilityRole="header" style={styles.flex}>
            {t('compare.title')}
          </AppText>
          <CloseButton onPress={() => router.back()} />
        </View>
        <EmptyState
          emoji="📷"
          title={t('compare.empty.title')}
          body={t('compare.empty.body')}
          action={{
            label: t('compare.empty.action'),
            onPress: () => router.replace({ pathname: '/capture', params: { mode: 'journey' } }),
          }}
        />
      </SafeAreaView>
    );
  }

  const beforeLabel = weekLabel(pair.a.takenAt);
  const afterLabel = weekLabel(pair.b.takenAt);
  const angleName = (p: JourneyPhoto) => t(`capture.angle.${p.angle}`);
  const itemA11y = (p: JourneyPhoto) =>
    t('compare.picker.item', { angle: angleName(p), label: weekLabel(p.takenAt), date: formatTakenAt(p.takenAt, locale) });
  const contentWidth = Math.min(width - layout.screenPadding * 2, layout.maxContentWidth);
  const frameHeight = Math.min(contentWidth * (4 / 3), height * 0.52);
  const halfWidth = (contentWidth - spacing.sm) / 2;

  const choose = (slot: 'a' | 'b', id: string) => {
    const next = { a: pair.a.id, b: pair.b.id, [slot]: id };
    if (next.a === next.b) return;
    const a = photos.find((p) => p.id === next.a);
    const b = photos.find((p) => p.id === next.b);
    // Keep the older photo on the "before" side.
    if (a && b && a.takenAt > b.takenAt) setPicked({ a: b.id, b: a.id });
    else setPicked(next);
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    track('compare_open', { mode: next === 'wipe' ? 'wipe' : 'side_by_side', locked });
  };

  const share = async () => {
    setSharing(true);
    await shareComparison(pair.a, pair.b);
    setSharing(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <AppText variant="title1" accessibilityRole="header" style={styles.flex}>
          {t('compare.title')}
        </AppText>
        <CloseButton onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SegmentedTabs
          tabs={[
            { id: 'wipe', label: t('compare.mode.wipe') },
            { id: 'side', label: t('compare.mode.side') },
          ]}
          value={mode}
          onChange={changeMode}
        />

        {mode === 'wipe' ? (
          <BeforeAfterWipe
            beforeUri={resolveJourneyUri(pair.a.uri)}
            afterUri={resolveJourneyUri(pair.b.uri)}
            beforeLabel={beforeLabel}
            afterLabel={afterLabel}
            height={frameHeight}
            mark={t('compare.mark')}
            lockedAfter={locked}
            accessibilityLabel={t('compare.wipeA11y', { before: beforeLabel, after: afterLabel })}
          />
        ) : (
          <View style={styles.side}>
            {[pair.a, pair.b].map((photo, index) => {
              const label = index === 0 ? beforeLabel : afterLabel;
              return (
                <View key={photo.id} style={[styles.sideFrame, { width: halfWidth, height: halfWidth * (4 / 3) }]}>
                  <Image
                    source={{ uri: resolveJourneyUri(photo.uri) }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    blurRadius={locked && index === 1 ? 40 : 0}
                    accessible
                    accessibilityLabel={t('compare.sideA11y', { label, angle: angleName(photo) })}
                  />
                  <View style={styles.tag} pointerEvents="none">
                    <AppText variant="micro" color="text">
                      {label}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {angleMismatch(pair.a, pair.b) ? (
          <AppText variant="caption" color="warning">
            {t('compare.mismatch')}
          </AppText>
        ) : null}

        {locked ? (
          <View style={styles.lockedCard}>
            <AppText variant="headline">{t('compare.locked.title')}</AppText>
            <AppText variant="body" color="textSecondary">
              {t('compare.locked.body')}
            </AppText>
            <Button
              label={t('compare.locked.cta')}
              shine
              onPress={() => openPaywall(gate.paywallSource ?? 'locked_compare', 'compare')}
              testID="compare-unlock"
            />
          </View>
        ) : (
          <>
            <PhotoStrip
              title={t('compare.picker.before')}
              photos={photos}
              selectedId={pair.a.id}
              onSelect={(id) => choose('a', id)}
              labelFor={(p) => weekLabel(p.takenAt)}
              a11yFor={itemA11y}
              testID="compare-strip-a"
            />
            <PhotoStrip
              title={t('compare.picker.after')}
              photos={photos}
              selectedId={pair.b.id}
              onSelect={(id) => choose('b', id)}
              labelFor={(p) => weekLabel(p.takenAt)}
              a11yFor={itemA11y}
              testID="compare-strip-b"
            />
            <Button
              label={sharing ? t('compare.share.preparing') : t('compare.share.action')}
              icon="share-outline"
              variant="secondary"
              loading={sharing}
              onPress={() => void share()}
              testID="compare-share"
            />
          </>
        )}

        <AppText variant="caption" color="textTertiary">
          {t('compare.report.disclaimer')}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  // Physical order (before on the left) in every language, like the wipe.
  side: { flexDirection: 'row', direction: 'ltr', gap: spacing.sm },
  sideFrame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  tag: {
    position: 'absolute',
    top: spacing.sm,
    start: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  lockedCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
});
