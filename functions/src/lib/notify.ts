/**
 * Best-effort FCM "preview ready" push to the owner's registered devices: a transactional message
 * about a preview the user started (device `topics` only govern offers). Copy is plain and never a
 * medical claim.
 */
import { db, messaging } from './admin.js';
import { errorName } from './errors.js';
import { log } from './log.js';
import { docPaths } from './paths.js';

/** Mirrors the app's `notifications.previewReady` strings (src/translations); English is the fallback. */
const PREVIEW_READY_COPY: Record<string, { title: string; body: string }> = {
  ar: { title: 'المعاينة جاهزة', body: 'اضغط لعرضها.' },
  de: { title: 'Deine Vorschau ist fertig', body: 'Tippe, um sie zu sehen.' },
  en: { title: 'Your preview is ready', body: 'Tap to see it.' },
  es: { title: 'Tu vista previa está lista', body: 'Toca para verla.' },
  fr: { title: 'Ton aperçu est prêt', body: 'Touche pour le voir.' },
  ja: { title: 'プレビューができました', body: 'タップして見てみましょう。' },
  ko: { title: '미리보기가 준비됐어요', body: '탭해서 확인해 보세요.' },
  pt: { title: 'Sua prévia está pronta', body: 'Toque para ver.' },
  ru: { title: 'Предпросмотр готов', body: 'Нажми, чтобы посмотреть.' },
  tr: { title: 'Önizlemen hazır', body: 'Görmek için dokun.' },
  zh: { title: '你的预览好了', body: '点击查看。' },
};

export function previewReadyCopy(locale: unknown): { title: string; body: string } {
  const tag = typeof locale === 'string' ? locale : 'en';
  const fallback = PREVIEW_READY_COPY.en as { title: string; body: string };
  return PREVIEW_READY_COPY[tag] ?? PREVIEW_READY_COPY[tag.split('-')[0] ?? 'en'] ?? fallback;
}

const STALE_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export async function notifyPreviewReady(uid: string, previewId: string): Promise<void> {
  try {
    const devices = await db().collection(docPaths.devices(uid)).limit(20).get();
    const targets = devices.docs
      .map((doc) => ({
        ref: doc.ref,
        token: doc.get('token') as unknown,
        locale: doc.get('locale') as unknown,
      }))
      .filter((d): d is typeof d & { token: string } => typeof d.token === 'string' && d.token.length > 0 && d.token.length <= 4096);
    if (targets.length === 0) return;

    // One message per device so each gets the system notification in its own language.
    const response = await messaging().sendEach(
      targets.map((t) => ({
        token: t.token,
        // The app routes on `type` + `previewId`.
        data: { type: 'preview_ready', previewId },
        notification: previewReadyCopy(t.locale),
        apns: { payload: { aps: { sound: 'default' } } },
        android: { priority: 'high' as const },
      })),
    );

    const stale = response.responses
      .map((r, i) => (r.error && STALE_TOKEN_ERRORS.has(r.error.code) ? targets[i]?.ref : undefined))
      .filter((ref): ref is NonNullable<typeof ref> => ref !== undefined);
    await Promise.all(stale.map((ref) => ref.delete()));
    log.info('preview.notified', { uid, previewId, count: response.successCount });
  } catch (error) {
    log.warn('preview.notify_failed', { uid, previewId, errorName: errorName(error) });
  }
}
