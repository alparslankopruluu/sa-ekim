/**
 * Save-to-library and share for a finished preview image. Downloads remote results to the
 * cache first (cache files are excluded from device backup). Permission-safe: a denied
 * library permission is a normal outcome, reported as `ExportError('permission')`.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import i18n from '@/lib/i18n';
import { breadcrumb } from '@/services/crash';

export type ExportFailure = 'permission' | 'unsupported' | 'failed';

export class ExportError extends Error {
  readonly reason: ExportFailure;

  constructor(reason: ExportFailure) {
    super(reason);
    this.name = 'ExportError';
    this.reason = reason;
  }
}

export function isExportableImage(uri: string | null | undefined): uri is string {
  return !!uri && (uri.startsWith('https://') || uri.startsWith('file://'));
}

function extensionOf(uri: string): 'jpg' | 'png' | 'webp' {
  const path = uri.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.png')) return 'png';
  if (path.endsWith('.webp')) return 'webp';
  return 'jpg';
}

async function toLocalFile(uri: string, previewId: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, `kok-preview-${previewId}.${extensionOf(uri)}`);
  if (target.exists) return target.uri;
  const downloaded = await File.downloadFileAsync(uri, target);
  return downloaded.uri;
}

export async function savePreviewImage(uri: string, previewId: string): Promise<void> {
  if (Platform.OS === 'web' || !isExportableImage(uri)) throw new ExportError('unsupported');
  try {
    // Loaded lazily: the module needs a native binding at import time and would crash web.
    const MediaLibrary = await import('expo-media-library');
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) throw new ExportError('permission');
    const local = await toLocalFile(uri, previewId);
    await MediaLibrary.saveToLibraryAsync(local);
    breadcrumb('preview_saved');
  } catch (error) {
    throw error instanceof ExportError ? error : new ExportError('failed');
  }
}

export async function sharePreviewImage(uri: string, previewId: string): Promise<void> {
  if (!isExportableImage(uri) || !(await Sharing.isAvailableAsync())) throw new ExportError('unsupported');
  try {
    const local = await toLocalFile(uri, previewId);
    const png = extensionOf(uri) === 'png';
    await Sharing.shareAsync(local, {
      mimeType: png ? 'image/png' : 'image/jpeg',
      UTI: png ? 'public.png' : 'public.jpeg',
      dialogTitle: i18n.t('preview.result.shareTitle'),
    });
    breadcrumb('preview_shared');
  } catch {
    throw new ExportError('failed');
  }
}
