import type { PreviewDoc } from '@shared/api';

import { resolveMediaUrl } from '@/services/generation';
import { usePreviewDraft } from '@/stores/previewDraft';

/**
 * Rebuilds the picker draft from an existing preview (retry of a failed one). The uploaded
 * selfie is reused via its storage path, so nothing is uploaded twice. The draft photo is
 * kept when it is already that same upload; otherwise the stored selfie is resolved for
 * display, and left empty (user picks again) if it is no longer available.
 */
export async function prefillDraftFromPreview(doc: PreviewDoc): Promise<void> {
  const previous = usePreviewDraft.getState().photo;
  const keep = previous && previous.storagePath === doc.photoPath ? previous : null;

  const store = usePreviewDraft.getState();
  store.start({ goal: doc.goal, onboarding: doc.onboarding });
  store.setStyle(doc.styleId, doc.density);
  store.setQuality(doc.quality);

  if (keep) {
    usePreviewDraft.getState().setPhoto(keep);
    return;
  }
  try {
    const uri = await resolveMediaUrl(doc.photoPath);
    if (uri) usePreviewDraft.getState().setPhoto({ localUri: uri, storagePath: doc.photoPath, source: 'library' });
  } catch {
    // The selfie expired (kept 30 days): the picker asks for a new photo.
  }
}
