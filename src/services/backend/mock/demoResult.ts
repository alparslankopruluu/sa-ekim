/**
 * Mock-mode stand-in for the AI edit (native). It never claims to be a real preview: the
 * result is the user's own photo, gently zoomed and framed in the brand copper so the
 * before/after wipe visibly differs, and the UI marks it "demo" whenever `backend.mode`
 * is `mock`. Web has its own canvas variant in demoResult.web.ts.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const RESULT_WIDTH = 1024;
/** Fraction trimmed from each edge (a slight, deterministic zoom). */
const ZOOM_INSET = 0.04;
/** Copper frame thickness as a fraction of the shorter edge. */
const FRAME = 0.03;
const COPPER = '#B87333';

const cache = new Map<string, Promise<string>>();

async function render(sourceUri: string): Promise<string> {
  const resized = await ImageManipulator.manipulate(sourceUri).resize({ width: RESULT_WIDTH }).renderAsync();
  const width = resized.width;
  const height = resized.height;
  const insetX = Math.round(width * ZOOM_INSET);
  const insetY = Math.round(height * ZOOM_INSET);
  const frame = Math.round(Math.min(width, height) * FRAME);
  const innerWidth = width - insetX * 2;
  const innerHeight = height - insetY * 2;
  const framed = await ImageManipulator.manipulate(resized)
    .crop({ originX: insetX, originY: insetY, width: innerWidth, height: innerHeight })
    .extent({
      originX: -frame,
      originY: -frame,
      width: innerWidth + frame * 2,
      height: innerHeight + frame * 2,
      backgroundColor: COPPER,
    })
    .renderAsync();
  const saved = await framed.saveAsync({ format: SaveFormat.JPEG, compress: 0.86 });
  return saved.uri;
}

/** Returns a displayable URI that differs from the source; falls back to the source on any failure. */
export function makeDemoResult(sourceUri: string): Promise<string> {
  const cached = cache.get(sourceUri);
  if (cached) return cached;
  const promise = render(sourceUri).catch(() => sourceUri);
  cache.set(sourceUri, promise);
  return promise;
}
