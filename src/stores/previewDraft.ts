/**
 * The in-progress preview (photo → style → density → quality). Kept in memory only:
 * a selfie is sensitive and is not persisted by this store.
 */
import { create } from 'zustand';

import type { Density, Goal, Quality, RegionHint, StyleId } from '@shared/catalog';

export interface PhotoDraft {
  localUri: string;
  /** Set once uploaded (or put into mock storage). */
  storagePath: string | null;
  source: 'camera' | 'library' | 'sample' | 'journey';
  /** Mask hint derived from the capture guide; absent for library photos. */
  regionHint?: RegionHint;
}

interface PreviewDraftState {
  goal: Goal | null;
  styleId: StyleId | null;
  density: Density;
  quality: Quality;
  photo: PhotoDraft | null;
  useFreeHigh: boolean;
  /** `true` for the free, watermarked preview at the end of onboarding. */
  onboarding: boolean;

  start(input: { goal: Goal; onboarding?: boolean }): void;
  setStyle(styleId: StyleId, density: Density): void;
  setDensity(density: Density): void;
  setQuality(quality: Quality): void;
  setPhoto(photo: PhotoDraft | null): void;
  setPhotoStoragePath(path: string): void;
  setUseFreeHigh(value: boolean): void;
  reset(): void;
}

const EMPTY = {
  goal: null as Goal | null,
  styleId: null as StyleId | null,
  density: 'natural' as Density,
  quality: 'standard' as Quality,
  photo: null as PhotoDraft | null,
  useFreeHigh: false,
  onboarding: false,
};

export const usePreviewDraft = create<PreviewDraftState>()((set, get) => ({
  ...EMPTY,
  start: ({ goal, onboarding = false }) => set({ ...EMPTY, goal, onboarding }),
  setStyle: (styleId, density) => set({ styleId, density }),
  setDensity: (density) => set({ density }),
  setQuality: (quality) => set({ quality, useFreeHigh: quality === 'high' ? get().useFreeHigh : false }),
  setPhoto: (photo) => set({ photo }),
  setPhotoStoragePath: (path) => {
    const photo = get().photo;
    if (photo) set({ photo: { ...photo, storagePath: path } });
  },
  setUseFreeHigh: (useFreeHigh) => set({ useFreeHigh }),
  reset: () => set({ ...EMPTY }),
}));
