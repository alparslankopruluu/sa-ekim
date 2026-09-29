/* jest.mock factories below are hoisted above these imports by babel-jest. */
import { Platform } from 'react-native';

import {
  fitLongEdge,
  isInsideJourneyDir,
  MAX_LONG_EDGE,
  rebaseJourneyUri,
  removeJourneyFile,
  saveJourneyPhoto,
  wipeAllJourneyFiles,
} from '../journeyFiles';

/* In-memory doubles for the native file system and image manipulator. */
const mockFs = new Map<string, string>();
const mockDirs = new Set<string>();

jest.mock('expo-file-system', () => {
  const join = (...parts: (string | { uri: string })[]) =>
    parts
      .map((p) => (typeof p === 'string' ? p : p.uri))
      .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
      .join('/');
  class MockFile {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(...parts);
    }
    get exists() {
      return mockFs.has(this.uri);
    }
    async move(destination: { uri: string }) {
      const data = mockFs.get(this.uri) ?? '';
      mockFs.delete(this.uri);
      mockFs.set(destination.uri, data);
      this.uri = destination.uri;
    }
    delete() {
      mockFs.delete(this.uri);
    }
  }
  class MockDirectory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(...parts).replace(/\/$/, '') + '/';
    }
    get exists() {
      return mockDirs.has(this.uri);
    }
    create() {
      mockDirs.add(this.uri);
    }
    list() {
      return [...mockFs.keys()].filter((k) => k.startsWith(this.uri)).map((k) => new MockFile(k));
    }
    delete() {
      for (const key of [...mockFs.keys()]) if (key.startsWith(this.uri)) mockFs.delete(key);
      mockDirs.delete(this.uri);
    }
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { document: new MockDirectory('file:///app/Documents'), cache: new MockDirectory('file:///app/Caches') },
  };
});

let mockSourceSize = { width: 4000, height: 3000 };
const mockResizeCalls: { width?: number; height?: number }[] = [];
let mockSaved = 0;

jest.mock('expo-image-manipulator', () => {
  const makeRef = (width: number, height: number) => ({
    width,
    height,
    saveAsync: async () => {
      mockSaved += 1;
      const uri = `file:///app/Caches/manip-${mockSaved}.jpg`;
      mockFs.set(uri, 'jpeg');
      return { uri, width, height };
    },
  });
  return {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: {
      manipulate: (source: unknown) => {
        let size = typeof source === 'string' ? mockSourceSize : { width: (source as { width: number }).width, height: (source as { height: number }).height };
        const ctx = {
          resize: (target: { width?: number; height?: number }) => {
            mockResizeCalls.push(target);
            if (target.width) size = { width: target.width, height: Math.round((size.height * target.width) / size.width) };
            if (target.height) size = { height: target.height, width: Math.round((size.width * target.height) / size.height) };
            return ctx;
          },
          renderAsync: async () => makeRef(size.width, size.height),
        };
        return ctx;
      },
    },
  };
});


beforeEach(() => {
  mockFs.clear();
  mockDirs.clear();
  mockResizeCalls.length = 0;
  mockSaved = 0;
  mockSourceSize = { width: 4000, height: 3000 };
});

describe('fitLongEdge', () => {
  it('returns null when the image is already small enough', () => {
    expect(fitLongEdge(2048, 1536, MAX_LONG_EDGE)).toBeNull();
    expect(fitLongEdge(1000, 1000, MAX_LONG_EDGE)).toBeNull();
  });

  it('scales the long edge to the limit', () => {
    expect(fitLongEdge(4000, 3000, 2048)).toEqual({ width: 2048 });
    expect(fitLongEdge(3000, 4000, 2048)).toEqual({ height: 2048 });
  });
});

describe('isInsideJourneyDir / rebaseJourneyUri', () => {
  it('only accepts files under the journey directory', () => {
    expect(isInsideJourneyDir('file:///app/Documents/journey/a.jpg', 'file:///app/Documents/journey/')).toBe(true);
    expect(isInsideJourneyDir('file:///app/Documents/other/a.jpg', 'file:///app/Documents/journey/')).toBe(false);
    expect(isInsideJourneyDir('file:///app/Documents/journey/../secret.jpg', 'file:///app/Documents/journey/')).toBe(false);
    expect(isInsideJourneyDir('content://media/1', 'file:///app/Documents/journey/')).toBe(false);
  });

  it('moves a stored uri onto the current container (iOS container ids change on restore)', () => {
    expect(rebaseJourneyUri('file:///old/UUID/Documents/journey/abc.jpg', 'file:///new/UUID/Documents/journey/')).toBe(
      'file:///new/UUID/Documents/journey/abc.jpg',
    );
    expect(rebaseJourneyUri('file:///app/Caches/x.jpg', 'file:///app/Documents/journey/')).toBe('file:///app/Caches/x.jpg');
  });
});

describe('saveJourneyPhoto', () => {
  it('stores a re-encoded JPEG under documentDirectory/journey/<id>.jpg', async () => {
    const saved = await saveJourneyPhoto('file:///app/Caches/camera.jpg');
    expect(saved.uri).toBe(`file:///app/Documents/journey/${saved.id}.jpg`);
    expect(mockFs.has(saved.uri)).toBe(true);
    expect(mockDirs.has('file:///app/Documents/journey/')).toBe(true);
  });

  it('downsizes photos above 2048 px on the long edge and leaves small ones alone', async () => {
    await saveJourneyPhoto('file:///app/Caches/big.jpg');
    expect(mockResizeCalls).toEqual([{ width: 2048 }]);

    mockResizeCalls.length = 0;
    mockSourceSize = { width: 1200, height: 1600 };
    await saveJourneyPhoto('file:///app/Caches/small.jpg');
    expect(mockResizeCalls).toEqual([]);
  });

  it('gives every photo a unique id', async () => {
    const a = await saveJourneyPhoto('file:///app/Caches/1.jpg');
    const b = await saveJourneyPhoto('file:///app/Caches/2.jpg');
    expect(a.id).not.toBe(b.id);
    expect(a.uri).not.toBe(b.uri);
  });

  it('falls back to the given uri on web', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      const saved = await saveJourneyPhoto('blob:http://localhost/photo');
      expect(saved.uri).toBe('blob:http://localhost/photo');
      expect(saved.id.length).toBeGreaterThan(8);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
});

describe('removeJourneyFile / wipeAllJourneyFiles', () => {
  it('deletes a journey file and reports it', async () => {
    const saved = await saveJourneyPhoto('file:///app/Caches/camera.jpg');
    expect(await removeJourneyFile(saved.uri)).toBe(true);
    expect(mockFs.has(saved.uri)).toBe(false);
  });

  it('never deletes a file outside the journey directory', async () => {
    mockFs.set('file:///app/Caches/keep.jpg', 'x');
    expect(await removeJourneyFile('file:///app/Caches/keep.jpg')).toBe(false);
    expect(mockFs.has('file:///app/Caches/keep.jpg')).toBe(true);
  });

  it('wipes every journey photo and returns how many were removed', async () => {
    await saveJourneyPhoto('file:///app/Caches/1.jpg');
    await saveJourneyPhoto('file:///app/Caches/2.jpg');
    mockFs.set('file:///app/Caches/keep.jpg', 'x');
    expect(await wipeAllJourneyFiles()).toBe(2);
    expect([...mockFs.keys()].filter((k) => k.includes('/journey/'))).toEqual([]);
    expect(mockFs.has('file:///app/Caches/keep.jpg')).toBe(true);
  });

  it('is a no-op when there is nothing to wipe', async () => {
    expect(await wipeAllJourneyFiles()).toBe(0);
  });
});
