/**
 * Provider submission shared by `createPreview` (first attempt) and `finalizePreview` (the single
 * quality-gate retry): upload the prepared image (+ mask) to fal, then queue the edit with a
 * per-preview HMAC webhook URL.
 */
import type { Density, Goal, Quality, StyleId } from '../shared/catalog.js';
import type { EditInputs } from './image-pipeline.js';
import type { ImageModel } from './image-model.js';
import { falWebhookBaseUrl } from './endpoints.js';
import { buildFalWebhookUrl, createPreviewToken } from './preview-token.js';
import { buildEditPayload, type ImageProvider } from './provider.js';
import { buildEditPrompt } from './prompts.js';

export async function submitEditJob(input: {
  provider: ImageProvider;
  model: ImageModel;
  uid: string;
  previewId: string;
  tokenSalt: string;
  inputs: EditInputs;
  goal: Goal;
  styleId: StyleId;
  density: Density;
  quality: Quality;
}): Promise<{ requestId: string; cancelUrl: string | null }> {
  const { inputs, provider } = input;
  const imageExt = inputs.imageContentType === 'image/png' ? 'png' : 'jpg';
  const imageUrl = await provider.uploadImage(inputs.imageBytes, `image.${imageExt}`, inputs.imageContentType);
  const maskUrl = inputs.maskBytes ? await provider.uploadImage(inputs.maskBytes, 'mask.png', 'image/png') : null;
  const payload = buildEditPayload({
    prompt: buildEditPrompt({ goal: input.goal, styleId: input.styleId, density: input.density }),
    imageUrl,
    quality: input.quality,
    imageSize: inputs.imageSize,
    outputFormat: inputs.outputFormat,
    maskUrl,
  });
  const token = createPreviewToken(input.tokenSalt, input.uid, input.previewId);
  return provider.submitEdit({
    queueURL: input.model.queueURL,
    payload,
    webhookUrl: buildFalWebhookUrl(falWebhookBaseUrl(), input.uid, input.previewId, token),
  });
}
