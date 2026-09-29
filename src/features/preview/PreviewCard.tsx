import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { PreviewDoc } from '@shared/api';
import { getStyle } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { Badge } from '@/components/ui';
import { cardKind, isExpired } from '@/lib/previewFlow';
import { colors, gradients, minTouch, palettes, radius, spacing } from '@/theme/tokens';

import { formatDate } from './format';
import { useMediaUrl } from './useMediaUrl';

export interface PreviewCardProps {
  doc: PreviewDoc;
  width: number;
  now: number;
  onOpen: (doc: PreviewDoc) => void;
  onRetry: (doc: PreviewDoc) => void;
  onDelete: (doc: PreviewDoc) => void;
}

/** One saved preview: a result thumbnail, an in-flight progress card, or a failed/canceled card. */
export function PreviewCard({ doc, width, now, onOpen, onRetry, onDelete }: PreviewCardProps) {
  const { t } = useTranslation();
  const kind = cardKind(doc.status);
  const expired = isExpired(doc.expiresAt, now);
  const thumb = useMediaUrl(kind === 'ready' && !expired ? doc.resultPath : null);
  const [from, to] = palettes[getStyle(doc.styleId)?.palette ?? 'ink'];
  const height = width * 1.25;
  const name = t(`preview.styles.${doc.styleId}.name`);
  const goal = t(`preview.goals.${doc.goal}`);
  const percent = Math.round(Math.min(1, Math.max(0, doc.progress)) * 100);

  const statusText =
    kind === 'ready'
      ? expired
        ? t('preview.tab.expired')
        : t('preview.tab.availableUntil', { date: formatDate(doc.expiresAt) })
      : doc.status === 'processing'
        ? t('preview.tab.status.processing', { percent })
        : t(`preview.tab.status.${doc.status === 'succeeded' ? 'finalizing' : doc.status}`);
  const created = formatDate(doc.createdAt);
  const label = t('preview.tab.cardA11y', { style: `${goal}, ${name}`, status: statusText, date: created });

  if (kind === 'failed' || kind === 'canceled') {
    return (
      <View style={[styles.card, styles.plain, { width, height }]} accessible={false}>
        <Ionicons name={kind === 'canceled' ? 'close-circle-outline' : 'alert-circle-outline'} size={28} color={colors.warning} />
        <View style={styles.center}>
          <AppText variant="caption" numberOfLines={2} align="center">
            {`${goal} · ${name}`}
          </AppText>
          <AppText variant="micro" color="textSecondary" align="center" accessibilityLabel={statusText}>
            {statusText}
          </AppText>
        </View>
        <View style={styles.buttons}>
          <Button label={t('preview.tab.retry')} size="sm" variant="secondary" onPress={() => onRetry(doc)} testID={`preview-retry-${doc.id}`} />
          <Button label={t('preview.tab.delete')} size="sm" variant="ghost" onPress={() => onDelete(doc)} testID={`preview-delete-${doc.id}`} />
        </View>
      </View>
    );
  }

  const inflight = kind === 'inflight';
  return (
    <View style={{ width, height }}>
      <PressableScale
        onPress={() => onOpen(doc)}
        onLongPress={inflight ? undefined : () => onDelete(doc)}
        pressedScale={0.97}
        accessibilityLabel={label}
        accessibilityActions={inflight ? undefined : [{ name: 'delete', label: t('preview.tab.deleteA11y') }]}
        onAccessibilityAction={inflight ? undefined : () => onDelete(doc)}
        style={[styles.card, { width, height }]}
        testID={`preview-card-${doc.id}`}
      >
        <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {thumb.uri ? <Image source={{ uri: thumb.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <LinearGradient colors={gradients.fadeBottom} style={styles.fade} />
        <View style={styles.top}>
          <Badge label={t('preview.aiLabelShort')} tone="muted" />
        </View>
        <View style={styles.bottom}>
          {inflight ? (
            <View style={styles.bar} accessibilityElementsHidden>
              <View style={[styles.barFill, { width: `${Math.max(6, percent)}%` }]} />
            </View>
          ) : null}
          <AppText variant="caption" numberOfLines={2}>
            {`${goal} · ${name}`}
          </AppText>
          <AppText variant="micro" color="textSecondary" numberOfLines={1}>
            {statusText}
          </AppText>
        </View>
      </PressableScale>
      {!inflight ? (
        <PressableScale
          onPress={() => onDelete(doc)}
          accessibilityLabel={t('preview.tab.menu')}
          hitSlop={8}
          style={styles.menu}
          testID={`preview-menu-${doc.id}`}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'space-between' },
  plain: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  center: { alignItems: 'center', gap: spacing.xs },
  buttons: { alignSelf: 'stretch', gap: spacing.xs },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%' },
  top: { flexDirection: 'row', padding: spacing.sm, paddingEnd: minTouch },
  bottom: { padding: spacing.md, gap: spacing.xs },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  menu: {
    position: 'absolute',
    top: spacing.xs,
    end: spacing.xs,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
});
