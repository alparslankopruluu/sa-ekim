/**
 * Export helpers: download a finished render to the cache, save it to the photo
 * library, or open the share sheet. Cache files are auto-excluded from iCloud
 * backup (security checklist, data storage).
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import i18n from '@/lib/i18n';

import { BackendError } from './backend/types';
import { breadcrumb } from './crash';

const exportDir = () => new Directory(Paths.cache, 'exports');

export function isExportableVideo(uri: string | null | undefined): uri is string {
  return !!uri && (uri.startsWith('https://') || uri.startsWith('file://'));
}

async function toLocalFile(uri: string, renderId: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  const dir = exportDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, `belto-${renderId}.mp4`);
  if (target.exists) return target.uri;
  const downloaded = await File.downloadFileAsync(uri, target);
  return downloaded.uri;
}

export async function saveVideo(uri: string, renderId: string): Promise<void> {
  if (Platform.OS === 'web') throw new BackendError('not_found');
  // Loaded lazily: the module requires a native-only binding at import time and
  // would crash every web route (Expo Router evaluates all routes in dev).
  const MediaLibrary = await import('expo-media-library');
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) throw new BackendError('unauthenticated');
  const local = await toLocalFile(uri, renderId);
  await MediaLibrary.saveToLibraryAsync(local);
  breadcrumb('video_saved');
}

export async function shareVideo(uri: string, renderId: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new BackendError('not_found');
  const local = await toLocalFile(uri, renderId);
  await Sharing.shareAsync(local, {
    mimeType: 'video/mp4',
    UTI: 'public.mpeg-4',
    dialogTitle: i18n.t('create.result.shareMessage'),
  });
  breadcrumb('video_shared');
}
