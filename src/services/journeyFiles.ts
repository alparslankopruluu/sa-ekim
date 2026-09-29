/**
 * Journey photo files. Photos live at `Paths.document/journey/<id>.jpg`: the document
 * directory is included in the iOS device backup and Android Auto Backup, and is never
 * uploaded by journey code (spec §4). Every photo is re-encoded as JPEG with the long edge
 * capped at 2048 px; the re-encode also drops EXIF and GPS metadata.
 *
 * Web has no durable file system for this: the given uri is used as is.
 */
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { useJourney } from '@/stores/journey';

export const MAX_LONG_EDGE = 2048;
export const JPEG_QUALITY = 0.9;

export interface SavedJourneyPhoto {
  id: string;
  /** `file://…/journey/<id>.jpg` on native; the input uri on web. */
  uri: string;
}

export class JourneyFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JourneyFileError';
  }
}

/** Resize argument that brings the long edge down to `max`, or null when it already fits. */
export function fitLongEdge(width: number, height: number, max: number): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

/** `true` for a plain file directly inside the journey directory (no `..`, no nesting). */
export function isInsideJourneyDir(uri: string, dirUri: string): boolean {
  if (!uri.startsWith(dirUri)) return false;
  const rest = uri.slice(dirUri.length);
  return rest.length > 0 && !rest.includes('/') && !rest.includes('..');
}

/**
 * Moves a stored journey uri onto the current container path. iOS may change the app
 * container id after a restore onto a new device, which would leave absolute `file://`
 * uris in the persisted store pointing nowhere; the file name is the stable part.
 */
export function rebaseJourneyUri(uri: string, currentDirUri: string): string {
  const marker = '/journey/';
  const index = uri.lastIndexOf(marker);
  if (index < 0 || uri.startsWith('http') || uri.startsWith('blob:') || uri.startsWith('data:')) return uri;
  const name = uri.slice(index + marker.length);
  if (!name || name.includes('/') || name.includes('..')) return uri;
  return `${currentDirUri}${name}`;
}

function journeyDir(): Directory {
  return new Directory(Paths.document, 'journey');
}

function ensureJourneyDir(): Directory {
  const dir = journeyDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** The uri of a stored journey photo on the current container (stale absolute paths are fixed). */
export function resolveJourneyUri(uri: string): string {
  if (Platform.OS === 'web') return uri;
  return rebaseJourneyUri(uri, journeyDir().uri);
}

/** Re-encodes `sourceUri` as a JPEG within the size cap and returns the cache uri of the result. */
async function reencode(sourceUri: string): Promise<string> {
  const first = await ImageManipulator.manipulate(sourceUri).renderAsync();
  const fit = fitLongEdge(first.width, first.height, MAX_LONG_EDGE);
  const image = fit ? await ImageManipulator.manipulate(first).resize(fit).renderAsync() : first;
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return saved.uri;
}

/**
 * Stores a captured or picked photo for the journey and returns its id and final uri.
 * Throws `JourneyFileError` when the photo cannot be re-encoded or written: a photo is never
 * stored un-stripped as a silent fallback.
 */
export async function saveJourneyPhoto(tempUri: string): Promise<SavedJourneyPhoto> {
  const id = Crypto.randomUUID();
  if (Platform.OS === 'web') return { id, uri: tempUri };
  try {
    const encoded = await reencode(tempUri);
    const dir = ensureJourneyDir();
    const target = new File(dir, `${id}.jpg`);
    const targetUri = target.uri;
    await new File(encoded).move(target);
    return { id, uri: targetUri };
  } catch (error) {
    throw new JourneyFileError(error instanceof Error ? error.message : 'journey_save_failed');
  }
}

/** Deletes one journey photo file. Returns `false` (and touches nothing) for any other uri. */
export async function removeJourneyFile(uri: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const dir = journeyDir();
  const resolved = rebaseJourneyUri(uri, dir.uri);
  if (!isInsideJourneyDir(resolved, dir.uri)) return false;
  try {
    const file = new File(resolved);
    if (!file.exists) return false;
    file.delete();
    return true;
  } catch {
    return false;
  }
}

/** Deletes the whole journey directory ("Delete all my data"). Returns how many photos it held. */
export async function wipeAllJourneyFiles(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const dir = journeyDir();
  if (!dir.exists) return 0;
  const count = dir.list().filter((entry) => entry instanceof File).length;
  dir.delete();
  return count;
}

/**
 * Rewrites persisted photo uris whose container path is stale. Cheap and idempotent; call it
 * once after the journey store has hydrated (session start).
 */
export function rebaseJourneyPhotoUris(): number {
  if (Platform.OS === 'web') return 0;
  const { photos, addPhoto } = useJourney.getState();
  let changed = 0;
  for (const photo of photos) {
    const uri = resolveJourneyUri(photo.uri);
    if (uri !== photo.uri) {
      addPhoto({ ...photo, uri });
      changed += 1;
    }
  }
  return changed;
}
