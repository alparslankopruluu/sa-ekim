/** Best-effort FCM "render ready" push to the owner's registered devices. */
import { db, messaging } from './admin.js';
import { errorName } from './errors.js';
import { log } from './log.js';
import { docPaths } from './paths.js';

/** Same copy as the app's `notifications.renderReady` strings (src/translations). */
const RENDER_READY_COPY: Record<string, { title: string; body: string }> = {
  ar: { title: 'الفيديو الخاص بك جاهز 🎤', body: 'اضغط لمشاهدة العرض.' },
  de: {
    title: 'Dein Video ist fertig 🎤',
    body: 'Tippe, um den Auftritt anzusehen.',
  },
  en: {
    title: 'Your video is ready 🎤',
    body: 'Tap to watch the performance.',
  },
  es: { title: 'Tu video está listo 🎤', body: 'Toca para ver la actuación.' },
  ja: {
    title: '動画が完成しました 🎤',
    body: 'タップしてパフォーマンスを見よう。',
  },
  ko: { title: '영상이 완성됐어요 🎤', body: '탭해서 무대를 감상하세요.' },
  'pt-BR': {
    title: 'Seu vídeo está pronto 🎤',
    body: 'Toque para assistir à apresentação.',
  },
  ru: {
    title: 'Твоё видео готово 🎤',
    body: 'Нажми, чтобы посмотреть выступление.',
  },
  tr: { title: 'Videon hazır 🎤', body: 'Performansı izlemek için dokun.' },
  'zh-Hans': { title: '你的视频做好了 🎤', body: '点击观看这场演出。' },
  'es-ES': {
    title: 'Tu vídeo está listo 🎤',
    body: 'Toca para ver la actuación.',
  },
};

function renderReadyCopy(locale: unknown): { title: string; body: string } {
  const tag = typeof locale === 'string' ? locale : 'en';
  return RENDER_READY_COPY[tag] ?? RENDER_READY_COPY[tag.split('-')[0] ?? 'en'] ?? RENDER_READY_COPY.en!;
}

const STALE_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export async function notifyRenderReady(uid: string, renderId: string): Promise<void> {
  try {
    const devices = await db().collection(docPaths.devices(uid)).limit(20).get();
    const targets = devices.docs
      .map((doc) => ({
        ref: doc.ref,
        token: doc.get('token') as unknown,
        locale: doc.get('locale') as unknown,
      }))
      .filter(
        (d): d is { ref: typeof d.ref; token: string; locale: unknown } =>
          typeof d.token === 'string' && d.token.length > 0,
      )
      .filter((d) => d.token.length <= 4096);
    if (targets.length === 0) return;

    // One message per device so each gets the system notification in its own language.
    const response = await messaging().sendEach(
      targets.map((t) => ({
        token: t.token,
        // The app routes on `type` + `renderId`.
        data: { type: 'render_ready', renderId },
        notification: renderReadyCopy(t.locale),
        apns: { payload: { aps: { sound: 'default' } } },
        android: { priority: 'high' as const },
      })),
    );

    const stale = response.responses
      .map((r, i) => (r.error && STALE_TOKEN_ERRORS.has(r.error.code) ? targets[i]?.ref : undefined))
      .filter((ref): ref is NonNullable<typeof ref> => ref !== undefined);
    await Promise.all(stale.map((ref) => ref.delete()));
    log.info('render.notified', {
      uid,
      renderId,
      count: response.successCount,
    });
  } catch (error) {
    log.warn('render.notify_failed', {
      uid,
      renderId,
      errorName: errorName(error),
    });
  }
}
