/**
 * Clinic progress report (Pro) and the compare sheet: builds escaped HTML with downscaled
 * base64 photos, renders a PDF with expo-print, opens the share sheet, then deletes the
 * temporary files. Nothing is uploaded. The PDF states facts only and always carries the
 * "not a medical document" disclaimer.
 */
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { toIsoDate } from '@shared/timeline';

import { showToast } from '@/components/Toast';
import { weekLabelFor } from '@/features/compare/compareLogic';
import { formatTakenAt } from '@/features/compare/useWeekLabel';
import { pickReportPhotos, shedWeekRows } from '@/features/report/reportData';
import { buildCompareHtml, buildReportHtml, type ReportModel, type ReportPhoto } from '@/features/report/reportHtml';
import { canUse } from '@/lib/entitlements';
import i18n, { currentLanguage, currentLocaleTag } from '@/lib/i18n';
import { isRtl } from '@/lib/locales';
import { formatIsoDate } from '@/lib/phaseView';
import { useAccount } from '@/stores/account';
import { type JourneyPhoto, useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';

import { track } from './analytics';
import { recordNonFatal } from './crash';
import { resolveJourneyUri } from './journeyFiles';

/** Long edge of an embedded photo: sharp on A4, small enough to keep the PDF light. */
const EMBED_EDGE = 900;
const EMBED_QUALITY = 0.78;

export type ExportResult = 'shared' | 'locked' | 'empty' | 'unsupported' | 'failed';

function deleteQuietly(uri: string | null | undefined): void {
  if (!uri || !uri.startsWith('file://')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best effort.
  }
}

/** Downscaled JPEG as a data URI (temporary file removed). Null when the photo can't be read. */
async function toDataUri(uri: string): Promise<string | null> {
  try {
    const first = await ImageManipulator.manipulate(resolveJourneyUri(uri)).renderAsync();
    const resize = first.width >= first.height ? { width: EMBED_EDGE } : { height: EMBED_EDGE };
    const image =
      Math.max(first.width, first.height) > EMBED_EDGE
        ? await ImageManipulator.manipulate(first).resize(resize).renderAsync()
        : first;
    const saved = await image.saveAsync({ base64: true, compress: EMBED_QUALITY, format: SaveFormat.JPEG });
    deleteQuietly(saved.uri);
    return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
  } catch (error) {
    recordNonFatal(error, 'report_embed_photo');
    return null;
  }
}

function weekText(takenAt: number): string {
  const label = weekLabelFor(takenAt, useJourney.getState().procedureDate);
  if (label.kind === 'before') return i18n.t('report.clinic.before');
  if (label.kind === 'week') return i18n.t('report.clinic.week', { n: label.week });
  return '';
}

async function reportPhoto(photo: JourneyPhoto, locale: string): Promise<ReportPhoto | null> {
  const dataUri = await toDataUri(photo.uri);
  if (!dataUri) return null;
  return { dataUri, label: weekText(photo.takenAt), dateText: formatTakenAt(photo.takenAt, locale) };
}

async function renderAndShare(html: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  try {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } finally {
    deleteQuietly(uri);
  }
}

async function canShare(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return Sharing.isAvailableAsync().catch(() => false);
}

/** Builds the report model from the stores (exported for tests and previews). */
export async function buildClinicReportModel(now: Date = new Date()): Promise<{ model: ReportModel; photos: number }> {
  const { photos, shed, procedureDate, clinicName } = useJourney.getState();
  const locale = currentLocaleTag();
  const t = i18n.t.bind(i18n);

  const sections: ReportModel['sections'] = [];
  let embedded = 0;
  for (const pick of pickReportPhotos(photos)) {
    const items: ReportPhoto[] = [];
    for (const photo of pick.last ? [pick.first, pick.last] : [pick.first]) {
      const item = await reportPhoto(photo, locale);
      if (item) items.push(item);
    }
    if (items.length === 0) continue;
    embedded += items.length;
    sections.push({ title: t(`capture.angle.${pick.angle}`), photos: items });
  }

  const shedRows = shedWeekRows(shed, procedureDate).map((row) => ({
    weekLabel: row.week === null ? t('report.clinic.overall') : t('report.clinic.weekRow', { n: row.week }),
    days: String(row.days),
    average: String(row.average),
    max: String(row.max),
  }));

  const model: ReportModel = {
    lang: currentLanguage(),
    dir: isRtl(currentLanguage()) ? 'rtl' : 'ltr',
    brand: t('report.clinic.brand'),
    title: t('report.clinic.title'),
    clinicLine: clinicName ? t('report.clinic.clinicLine', { name: clinicName }) : null,
    operationLine: procedureDate
      ? t('report.clinic.operationLine', { date: formatIsoDate(procedureDate, locale, 'long') })
      : null,
    generatedLine: t('report.clinic.generatedLine', { date: formatIsoDate(toIsoDate(now), locale, 'long') }),
    photosHeading: t('report.clinic.photosHeading'),
    noPhotosText: t('report.clinic.noPhotos'),
    sections,
    shedHeading: t('report.clinic.shedHeading'),
    shedColumns: {
      week: t('report.clinic.col.week'),
      days: t('report.clinic.col.days'),
      average: t('report.clinic.col.average'),
      max: t('report.clinic.col.max'),
    },
    shedRows,
    shedEmptyText: t('report.clinic.shedEmpty'),
    disclaimer: t('report.clinic.disclaimer'),
  };
  return { model, photos: embedded };
}

/**
 * Pro: exports the clinic progress record as a PDF and opens the share sheet. Free users are
 * sent to the paywall (`locked_report`). Shows its own toasts; resolves with what happened.
 */
export async function exportClinicReport(): Promise<ExportResult> {
  const gate = canUse('report', { isPro: useAccount.getState().entitlement.isPro });
  if (!gate.allowed) {
    track('feature_locked', { feature: 'report' });
    router.push({ pathname: '/paywall', params: { source: gate.paywallSource ?? 'locked_report' } });
    return 'locked';
  }
  const { photos, shed } = useJourney.getState();
  if (photos.length === 0 && shed.length === 0) {
    showToast(i18n.t('report.clinic.empty'), 'info');
    return 'empty';
  }
  if (!(await canShare())) {
    showToast(i18n.t('report.clinic.unsupported'), 'error');
    return 'unsupported';
  }
  try {
    const { model, photos: embedded } = await buildClinicReportModel();
    await renderAndShare(buildReportHtml(model), i18n.t('report.clinic.dialog'));
    track('report_exported', { photos: embedded });
    return 'shared';
  } catch (error) {
    recordNonFatal(error, 'report_export');
    showToast(i18n.t('report.clinic.failed'), 'error');
    return 'failed';
  }
}

/**
 * Compare as an image: rasterizes the on-screen ShareCard (both photos, week labels, the Kök
 * mark and the disclaimer) with react-native-view-shot and opens the share sheet. Falls back to
 * the one-page PDF below on web or when capture fails. Callers gate it behind `canUse('compare')`.
 */
export async function shareComparisonImage(
  card: View | null,
  a: JourneyPhoto,
  b: JourneyPhoto,
): Promise<ExportResult> {
  if (Platform.OS === 'web' || !card) return shareComparison(a, b);
  if (!(await canShare())) {
    showToast(i18n.t('compare.share.unavailable'), 'error');
    return 'unsupported';
  }
  let uri: string;
  try {
    uri = await captureRef(card, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
  } catch (error) {
    recordNonFatal(error, 'compare_capture');
    return shareComparison(a, b);
  }
  try {
    await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: i18n.t('compare.share.dialog') });
    useSession.getState().recordShare();
    return 'shared';
  } catch (error) {
    recordNonFatal(error, 'compare_share_image');
    showToast(i18n.t('compare.share.error'), 'error');
    return 'failed';
  } finally {
    try {
      new File(uri).delete();
    } catch {
      // temporary file; the OS cleans the cache anyway
    }
  }
}

/**
 * Compare sheet as a one-page PDF (web and capture fallback): the two photos side by side with
 * their week labels and the Kök mark.
 */
export async function shareComparison(a: JourneyPhoto, b: JourneyPhoto): Promise<ExportResult> {
  if (!(await canShare())) {
    showToast(i18n.t('compare.share.unavailable'), 'error');
    return 'unsupported';
  }
  try {
    const locale = currentLocaleTag();
    const t = i18n.t.bind(i18n);
    const [first, second] = await Promise.all([reportPhoto(a, locale), reportPhoto(b, locale)]);
    if (!first || !second) throw new Error('compare_embed_failed');
    const label = (p: ReportPhoto) => p.label || t('compare.label.none');
    const html = buildCompareHtml({
      lang: currentLanguage(),
      dir: isRtl(currentLanguage()) ? 'rtl' : 'ltr',
      brand: t('compare.mark'),
      title: t('compare.report.title'),
      subtitle: t('compare.report.heading', { before: label(first), after: label(second) }),
      before: { ...first, label: label(first) },
      after: { ...second, label: label(second) },
      disclaimer: t('compare.report.disclaimer'),
    });
    await renderAndShare(html, t('compare.share.dialog'));
    useSession.getState().recordShare();
    return 'shared';
  } catch (error) {
    recordNonFatal(error, 'compare_share');
    showToast(i18n.t('compare.share.error'), 'error');
    return 'failed';
  }
}
