/**
 * The only persisted state: what the user has looked at and how they scored.
 *
 * No backend, no account, no sync. Everything the app knows lives on the device
 * in one small JSON blob, which is what makes it work on a plane and keeps the
 * privacy policy to a paragraph.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type QuizResult = { correct: number; total: number };

type ProgressState = {
  visited: Record<string, true>;
  best: Record<string, QuizResult>;
  markVisited: (id: string) => void;
  recordQuiz: (id: string, result: QuizResult) => void;
  reset: () => void;
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      visited: {},
      best: {},

      markVisited: (id) => {
        if (get().visited[id]) return;
        set((state) => ({ visited: { ...state.visited, [id]: true } }));
      },

      recordQuiz: (id, result) => {
        const previous = get().best[id];
        // Only an improvement counts, so a quick retry cannot lower a good score.
        if (previous && previous.correct / previous.total >= result.correct / result.total) return;
        set((state) => ({ best: { ...state.best, [id]: result } }));
      },

      reset: () => set({ visited: {}, best: {} }),
    }),
    {
      name: 'cutaway.progress.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ visited: state.visited, best: state.best }),
    },
  ),
);
