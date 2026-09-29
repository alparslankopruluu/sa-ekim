/**
 * Mock-mode stand-in for the AI edit (web): a canvas pass that warms the photo with a
 * copper wash and frames it, so the wipe visibly differs. The UI labels it "demo" whenever
 * `backend.mode` is `mock`. Falls back to the source photo if the canvas is unavailable.
 */
const COPPER = '184, 115, 51';
const cache = new Map<string, Promise<string>>();

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image_load_failed'));
    image.src = uri;
  });
}

async function render(sourceUri: string): Promise<string> {
  const image = await loadImage(sourceUri);
  const scale = Math.min(1, 1024 / image.naturalWidth);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return sourceUri;
  context.drawImage(image, 0, 0, width, height);
  context.globalCompositeOperation = 'soft-light';
  context.fillStyle = `rgba(${COPPER}, 0.55)`;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  context.strokeStyle = `rgb(${COPPER})`;
  context.lineWidth = Math.round(Math.min(width, height) * 0.03);
  context.strokeRect(0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.86);
}

export function makeDemoResult(sourceUri: string): Promise<string> {
  const cached = cache.get(sourceUri);
  if (cached) return cached;
  const promise = render(sourceUri).catch(() => sourceUri);
  cache.set(sourceUri, promise);
  return promise;
}
