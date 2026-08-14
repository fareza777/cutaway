/**
 * Saved parts.
 *
 * Keyed by object and part together, because part ids are only unique within
 * an object — there is a "compressor" in both the fridge and the air
 * conditioner, and they are not the same thing.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FavouriteKey = `${string}:${string}`;

export const favouriteKey = (objectId: string, partId: string): FavouriteKey => `${objectId}:${partId}`;

type FavouritesState = {
  /** Insertion-ordered: the list reads newest last, like a notebook. */
  saved: FavouriteKey[];
  toggle: (objectId: string, partId: string) => void;
  has: (objectId: string, partId: string) => boolean;
  clear: () => void;
};

export const useFavourites = create<FavouritesState>()(
  persist(
    (set, get) => ({
      saved: [],
      toggle: (objectId, partId) => {
        const key = favouriteKey(objectId, partId);
        const saved = get().saved;
        set({ saved: saved.includes(key) ? saved.filter((item) => item !== key) : [...saved, key] });
      },
      has: (objectId, partId) => get().saved.includes(favouriteKey(objectId, partId)),
      clear: () => set({ saved: [] }),
    }),
    {
      name: 'cutaway.favourites.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ saved: state.saved }),
    },
  ),
);

/** Subscribes to just one part's saved state, so a star does not re-render the sheet. */
export function useIsFavourite(objectId: string, partId: string | null) {
  return useFavourites((state) => (partId ? state.saved.includes(favouriteKey(objectId, partId)) : false));
}
