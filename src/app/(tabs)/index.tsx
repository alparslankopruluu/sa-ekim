import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { rankSongs, rankTemplates } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CreditPill } from '@/components/CreditPill';
import { EqualizerBars } from '@/components/EqualizerBars';
import { PressableScale } from '@/components/PressableScale';
import { SongRow } from '@/components/SongRow';
import { StageBackground } from '@/components/StageBackground';
import { StickerPhoto } from '@/components/StickerPhoto';
import { Badge, DemoModeBanner, SectionHeader } from '@/components/ui';
import { SAMPLE_PHOTOS } from '@/features/demo/samples';
import { GiftHomeCard } from '@/features/gift/GiftHomeCard';
import { TemplateCard } from '@/features/home/TemplateCard';
import { useSongPreview } from '@/hooks/useSongPreview';
import { type CreateEntry, track, trackScreen } from '@/services/analytics';
import { useAccount, useRecentRenders } from '@/stores/account';
import { useDraft } from '@/stores/draft';
import { useSession } from '@/stores/session';
import { colors, glows, gradients, layout, radius, spacing } from '@/theme/tokens';

function startCreate(entry: CreateEntry, options: { templateId?: string; songId?: string } = {}) {
  useDraft.getState().start(entry, options);
  track('create_start', { entry, template: options.templateId ?? 'none' });
  router.push('/create');
}

function Hero() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const cardSize = Math.min(118, width * 0.28);
  return (
    <Animated.View entering={FadeInUp.springify().damping(18)}>
      <PressableScale
        onPress={() => startCreate('home_hero')}
        pressedScale={0.98}
        accessibilityLabel={`${t('home.heroTitle')}. ${t('home.heroSubtitle')}`}
        style={styles.hero}
        testID="home-hero"
      >
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.heroText}>
          <AppText variant="title1" style={styles.heroTitle}>
            {t('home.heroTitle')}
          </AppText>
          <AppText variant="callout" style={styles.heroSubtitle}>
            {t('home.heroSubtitle')}
          </AppText>
          <View style={styles.heroCta}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <AppText variant="headline" color="primary">
              {t('home.heroCta')}
            </AppText>
          </View>
        </View>
        <View style={[styles.heroArt, { width: cardSize + 24 }]}>
          <StickerPhoto uri={SAMPLE_PHOTOS.rex} palette="lime" size={cardSize} tilt={8} style={styles.heroBack} />
          <StickerPhoto uri={SAMPLE_PHOTOS.nova} palette="magenta" size={cardSize} tilt={-6} />
          <View style={styles.heroEq}>
            <EqualizerBars bars={5} height={18} color="text" />
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const goal = useSession((s) => s.goal);
  const genres = useSession((s) => s.genres);
  const isPro = useAccount((s) => s.entitlement.isPro);
  const recent = useRecentRenders();
  const preview = useSongPreview();
  const templates = useMemo(() => rankTemplates(goal), [goal]);
  const songs = useMemo(() => rankSongs(goal, genres).slice(0, 5), [goal, genres]);

  useEffect(() => {
    trackScreen('home');
  }, []);

  return (
    <View style={styles.root}>
      <StageBackground animated={false} intensity="soft" />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <AppText variant="title1" accessibilityRole="header">
            {t('brand.name')}
          </AppText>
          <View style={styles.headerRight}>
            {!isPro ? (
              <Button
                label={t('home.goPro')}
                size="sm"
                variant="gold"
                onPress={() => router.push({ pathname: '/paywall', params: { source: 'home_banner' } })}
                testID="go-pro"
              />
            ) : (
              <Badge label={t('common.pro')} />
            )}
            <CreditPill onPress={() => router.push({ pathname: '/credits', params: { source: 'home' } })} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <DemoModeBanner />
          <Hero />
          <GiftHomeCard />

          <View>
            <SectionHeader title={t('home.templates')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templates}>
              {templates.map((template, index) => (
                <Animated.View key={template.id} entering={FadeInDown.delay(index * 40)}>
                  <TemplateCard
                    template={template}
                    onPress={() => {
                      track('template_tap', { template: template.id });
                      startCreate('template', { templateId: template.id });
                    }}
                  />
                </Animated.View>
              ))}
            </ScrollView>
          </View>

          <View>
            <SectionHeader title={t('home.songs')} />
            <View style={styles.songs}>
              {songs.map((song) => (
                <SongRow
                  key={song.id}
                  song={song}
                  playing={preview.playingId === song.id}
                  onTogglePlay={() => preview.toggle(song.id)}
                  onSelect={() => {
                    preview.stop();
                    startCreate('song', { songId: song.id });
                  }}
                  actionLabel={t('home.heroCta')}
                />
              ))}
            </View>
          </View>

          {recent.length > 0 ? (
            <View>
              <SectionHeader
                title={t('home.recent')}
                action={{ label: t('home.seeAll'), onPress: () => router.push('/(tabs)/library') }}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templates}>
                {recent.map((render) => (
                  <PressableScale
                    key={render.id}
                    onPress={() => router.push({ pathname: '/create/result', params: { renderId: render.id } })}
                    accessibilityLabel={t('create.result.title')}
                    style={styles.recent}
                  >
                    <LinearGradient
                      colors={gradients.hero}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="play-circle" size={36} color={colors.text} />
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={{ height: layout.tabBarClearance }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scroll: { paddingHorizontal: layout.screenPadding, gap: spacing.xxl, paddingTop: spacing.sm },
  hero: {
    minHeight: 184,
    borderRadius: radius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    padding: spacing.xl,
    boxShadow: glows.primary,
  },
  heroText: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  heroTitle: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 8 },
  heroSubtitle: { color: colors.text, opacity: 0.92 },
  heroCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  heroArt: { alignItems: 'center', justifyContent: 'center' },
  heroBack: { position: 'absolute', top: -6, right: -18 },
  heroEq: { position: 'absolute', bottom: -4, left: 0 },
  templates: { gap: spacing.md, paddingRight: spacing.lg },
  songs: { gap: spacing.sm },
  recent: {
    width: 96,
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
