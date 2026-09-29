/**
 * Preview picker: region → style → density → quality → photo → Create.
 *
 * Route params (all optional):
 *   entry    'onboarding' | 'preview_tab' | 'home_card' | 'journey' | 'deeplink' (analytics; `onboarding`
 *            also marks the draft as the free onboarding preview)
 *   goal     Goal — region tab to open (default: the goal picked in onboarding)
 *   keep     '1' keeps the current draft (photo, style) instead of starting fresh
 *   quality  'high' — preselect High (used by the result screen's HD upsell; needs keep=1)
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { previewCost } from '@shared/pricing';
import { GOALS, type Goal, getStyle, isGoal, stylesForGoal } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { CreditPill } from '@/components/CreditPill';
import { OptionCard } from '@/components/OptionCard';
import { StageBackground } from '@/components/StageBackground';
import { Card, CloseButton, ErrorState, ListRow } from '@/components/ui';
import { formatDate } from '@/features/preview/format';
import { PhotoSection } from '@/features/preview/PhotoSection';
import { StyleCard } from '@/features/preview/StyleCard';
import { beginAttempt } from '@/features/preview/submitStore';
import { useLibraryPhoto } from '@/features/preview/useLibraryPhoto';
import { useEntitlement } from '@/lib/entitlements';
import {
  creditsAction,
  ctaState,
  defaultGoal,
  defaultStyleFor,
  initialSelection,
  latestPhotoForAngle,
  quotePreview,
  selectionForGoalChange,
  selectionForStyle,
  validateDraft,
} from '@/lib/previewFlow';
import { type PreviewEntry, track, trackScreen } from '@/services/analytics';
import { startSession } from '@/services/session';
import { useAccount } from '@/stores/account';
import { useJourney } from '@/stores/journey';
import { usePreviewDraft } from '@/stores/previewDraft';
import { CONSENT_VERSION, useSession } from '@/stores/session';
import { colors, layout, palettes, spacing } from '@/theme/tokens';

const ENTRIES: readonly PreviewEntry[] = ['onboarding', 'preview_tab', 'home_card', 'journey', 'deeplink'];

function parseEntry(value: string | undefined): PreviewEntry {
  return ENTRIES.find((entry) => entry === value) ?? 'deeplink';
}

type Params = {
  entry?: string;
  goal?: string;
  keep?: string;
  quality?: string;
};

/** Prepares the in-memory draft once, before the first paint. */
function bootstrapDraft(params: Params, sessionGoal: Goal | null): void {
  const store = usePreviewDraft.getState();
  const requested = isGoal(params.goal) ? params.goal : null;
  if (params.keep === '1') {
    const goal = requested ?? store.goal ?? defaultGoal(sessionGoal);
    const style = store.styleId ? getStyle(store.styleId) : undefined;
    if (store.goal !== goal || !style || style.goal !== goal) {
      usePreviewDraft.setState({ ...initialSelection(goal) });
    }
    if (params.quality === 'high') usePreviewDraft.getState().setQuality('high');
    return;
  }
  const goal = requested ?? defaultGoal(sessionGoal);
  store.start({ goal, onboarding: parseEntry(params.entry) === 'onboarding' });
  const selection = initialSelection(goal);
  usePreviewDraft.getState().setStyle(selection.styleId, selection.density);
}

export default function PreviewPickerScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Params>();
  const sessionGoal = useSession((s) => s.goal);
  const hasConsent = useSession((s) => s.consentVersion >= CONSENT_VERSION);
  const { isPro } = useEntitlement();
  const wallet = useAccount((s) => s.wallet);
  const walletLoaded = useAccount((s) => s.walletLoaded);
  const backendState = useAccount((s) => s.backendState);
  const journeyPhotos = useJourney((s) => s.photos);
  const pickLibrary = useLibraryPhoto();

  const draftGoal = usePreviewDraft((s) => s.goal);
  const styleId = usePreviewDraft((s) => s.styleId);
  const density = usePreviewDraft((s) => s.density);
  const quality = usePreviewDraft((s) => s.quality);
  const photo = usePreviewDraft((s) => s.photo);
  const useFreeHigh = usePreviewDraft((s) => s.useFreeHigh);
  const onboarding = usePreviewDraft((s) => s.onboarding);

  const booted = useRef(false);
  useLayoutEffect(() => {
    if (booted.current) return;
    booted.current = true;
    bootstrapDraft(params, sessionGoal);
    // Runs once per mount by design; route params never change while the picker is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    trackScreen('preview_picker');
    track('preview_start', {
      entry: parseEntry(params.entry),
      goal: usePreviewDraft.getState().goal ?? defaultGoal(sessionGoal),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goal: Goal = draftGoal ?? defaultGoal(sessionGoal);
  const style = (styleId ? getStyle(styleId) : undefined) ?? defaultStyleFor(goal);
  const goalStyles = useMemo(() => stylesForGoal(goal), [goal]);

  const draft = { goal: draftGoal, styleId, density, quality, photo, useFreeHigh, onboarding };
  const pricing = {
    onboardingEntry: onboarding,
    previewUsed: wallet.previewUsed,
    balance: wallet.balance,
    freeHighTokens: wallet.freeHighTokens,
  };
  const quote = quotePreview(quality, useFreeHigh, pricing);
  const standardQuote = quotePreview('standard', false, pricing);
  const { issues } = validateDraft(draft);
  const cta = ctaState({ issues, hasConsent, quote, balance: wallet.balance });

  // A photo that arrives from the capture screen is a camera photo: count it once.
  const trackedUri = useRef<string | null>(null);
  useEffect(() => {
    if (photo?.source === 'camera' && photo.localUri !== trackedUri.current) {
      trackedUri.current = photo.localUri;
      track('photo_selected', { source: 'camera' });
    }
  }, [photo]);

  const journeyPhoto = latestPhotoForAngle(journeyPhotos, style.bestAngle);

  const selectGoal = (next: Goal) => {
    if (next === goal) return;
    usePreviewDraft.setState({ ...selectionForGoalChange(next) });
  };

  const selectStyle = (id: typeof style.id) => {
    const next = selectionForStyle(id, density);
    usePreviewDraft.getState().setStyle(next.styleId, next.density);
    track('style_selected', { style: next.styleId, density: next.density });
  };

  const selectDensity = (next: typeof density) => {
    usePreviewDraft.getState().setDensity(next);
    track('style_selected', { style: style.id, density: next });
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/previews'));

  const onCta = () => {
    switch (cta) {
      case 'needs_consent':
        router.push('/consent');
        return;
      case 'needs_credits': {
        const action = creditsAction({ isPro, balance: wallet.balance });
        if (action.kind === 'paywall') router.push({ pathname: '/paywall', params: { source: action.source } });
        else router.push({ pathname: '/credits', params: { source: 'preview' } });
        return;
      }
      case 'free':
      case 'paid':
        track('generate_tap', { quality, credits: quote.credits, onboarding: quote.sendOnboarding });
        beginAttempt();
        router.push('/preview/rendering');
        return;
      default:
        return;
    }
  };

  const ctaLabel =
    cta === 'needs_credits'
      ? t('preview.cta.getCredits')
      : cta === 'needs_consent'
        ? t('preview.cta.continue')
        : cta === 'needs_photo'
          ? t('preview.cta.addPhoto')
          : cta === 'needs_style'
            ? t('preview.cta.chooseStyle')
            : cta === 'free'
              ? t('preview.cta.createFree')
              : t('preview.cta.create');

  const priceText =
    quote.kind === 'free'
      ? t('preview.price.free')
      : quote.kind === 'free_token'
        ? t('preview.price.freeHigh')
        : t('preview.price.credits', { count: quote.credits });

  const walletFailed = !walletLoaded && backendState === 'error';
  const helper =
    cta === 'needs_credits'
      ? t('preview.price.short', { count: wallet.balance, cost: quote.credits })
      : cta === 'needs_consent'
        ? t('preview.helper.needsConsent')
        : quote.kind === 'free'
          ? t('preview.price.freeNote')
          : null;

  return (
    <View style={sheet.root}>
      <StageBackground animated={false} intensity="soft" accents={[colors.primary, colors.accent]} />
      <SafeAreaView style={sheet.safe} edges={['top', 'bottom']}>
        <View style={sheet.topBar}>
          <CloseButton onPress={close} testID="preview-close" />
          <AppText variant="headline" accessibilityRole="header">
            {t('preview.title')}
          </AppText>
          <CreditPill onPress={() => router.push({ pathname: '/credits', params: { source: 'preview' } })} />
        </View>

        <ScrollView contentContainerStyle={sheet.scroll} showsVerticalScrollIndicator={false}>
          <AppText variant="body" color="textSecondary">
            {t('preview.subtitle')}
          </AppText>

          {walletFailed ? <ErrorState message={t('preview.helper.walletError')} onRetry={() => void startSession()} /> : null}

          <View style={sheet.section}>
            <AppText variant="micro" color="textTertiary" accessibilityRole="header">
              {t('preview.goals.label')}
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sheet.chips}>
              {GOALS.map((g) => (
                <Chip
                  key={g}
                  label={t(`preview.goals.${g}`)}
                  selected={g === goal}
                  gradient={palettes.copper}
                  onPress={() => selectGoal(g)}
                  testID={`goal-${g}`}
                />
              ))}
            </ScrollView>
          </View>

          <View style={sheet.section} accessibilityRole="radiogroup">
            <AppText variant="micro" color="textTertiary" accessibilityRole="header">
              {t('preview.styles.label')}
            </AppText>
            {goalStyles.map((item) => (
              <StyleCard key={item.id} style={item} selected={item.id === style.id} onPress={() => selectStyle(item.id)} />
            ))}
          </View>

          {style.densities.length > 1 ? (
            <View style={sheet.section}>
              <AppText variant="micro" color="textTertiary" accessibilityRole="header">
                {t('preview.density.label')}
              </AppText>
              <View style={sheet.chipRow}>
                {style.densities.map((d) => (
                  <Chip
                    key={d}
                    label={t(`preview.density.${d}`)}
                    selected={d === density}
                    gradient={palettes.copper}
                    onPress={() => selectDensity(d)}
                    testID={`density-${d}`}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={sheet.section} accessibilityRole="radiogroup">
            <AppText variant="micro" color="textTertiary" accessibilityRole="header">
              {t('preview.quality.label')}
            </AppText>
            <OptionCard
              title={t('preview.quality.standard.title')}
              subtitle={t('preview.quality.standard.description')}
              badge={
                standardQuote.kind === 'free'
                  ? t('preview.price.free')
                  : t('preview.price.credits', { count: standardQuote.credits })
              }
              selected={quality === 'standard'}
              gradient={palettes.copper}
              onPress={() => usePreviewDraft.getState().setQuality('standard')}
              testID="quality-standard"
            />
            <OptionCard
              title={t('preview.quality.high.title')}
              subtitle={t('preview.quality.high.description')}
              badge={t('preview.price.credits', { count: previewCost('high') })}
              selected={quality === 'high'}
              gradient={palettes.gold}
              onPress={() => usePreviewDraft.getState().setQuality('high')}
              testID="quality-high"
            />
            {quality === 'high' && wallet.freeHighTokens > 0 ? (
              <Card>
                <ListRow
                  icon="gift-outline"
                  label={t('preview.price.useFreeHigh')}
                  toggle={{ value: useFreeHigh, onChange: (value) => usePreviewDraft.getState().setUseFreeHigh(value) }}
                  testID="preview-free-high"
                />
                <AppText variant="caption" color="textSecondary" style={sheet.cardHint}>
                  {t('preview.price.useFreeHighHint', { count: wallet.freeHighTokens })}
                </AppText>
              </Card>
            ) : null}
          </View>

          <View style={sheet.section}>
            <AppText variant="micro" color="textTertiary" accessibilityRole="header">
              {t('preview.photo.label')}
            </AppText>
            <PhotoSection
              photo={photo}
              journey={
                journeyPhoto
                  ? { uri: journeyPhoto.uri, angle: journeyPhoto.angle, dateLabel: formatDate(journeyPhoto.takenAt) }
                  : null
              }
              onTake={() =>
                router.push({ pathname: '/capture', params: { mode: 'preview', angle: style.bestAngle } })
              }
              onLibrary={() => void pickLibrary()}
              onJourney={() => {
                if (!journeyPhoto) return;
                usePreviewDraft.getState().setPhoto({ localUri: journeyPhoto.uri, storagePath: null, source: 'journey' });
                track('photo_selected', { source: 'journey' });
              }}
              onRemove={() => usePreviewDraft.getState().setPhoto(null)}
            />
          </View>
        </ScrollView>

        <View style={sheet.footer}>
          <View style={sheet.priceRow} accessibilityLiveRegion="polite">
            <AppText variant="callout" color="textSecondary">
              {t('preview.price.label')}
            </AppText>
            <AppText variant="headline" testID="preview-price">
              {priceText}
            </AppText>
          </View>
          {helper ? (
            <AppText variant="caption" color={cta === 'needs_credits' ? 'warning' : 'textSecondary'}>
              {helper}
            </AppText>
          ) : null}
          <View style={sheet.aiRow} accessible accessibilityLabel={`${t('preview.aiLabel')}. ${t('preview.aiLabelDetail')}`}>
            <AppText variant="caption" color="accent" testID="preview-ai-label">
              {t('preview.aiLabel')}
            </AppText>
          </View>
          <Button
            label={ctaLabel}
            onPress={onCta}
            disabled={cta === 'needs_photo' || cta === 'needs_style'}
            loading={!walletLoaded && !walletFailed}
            shine={cta === 'free' || cta === 'paid'}
            testID="preview-create"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const sheet = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: layout.screenPadding,
  },
  scroll: {
    gap: spacing.xl,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth + layout.screenPadding * 2,
    alignSelf: 'center',
  },
  section: { gap: spacing.sm },
  chips: { gap: spacing.sm, paddingEnd: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardHint: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stroke,
    backgroundColor: colors.bgElevated,
    width: '100%',
    maxWidth: layout.maxContentWidth + layout.screenPadding * 2,
    alignSelf: 'center',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiRow: { paddingVertical: spacing.xxs },
});
