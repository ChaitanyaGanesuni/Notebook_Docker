import { create } from 'zustand';

/** Short messages from background estimation, shown once on the Today screen. */
export const useEstimateNotices = create<{ notices: string[]; push: (m: string) => void; dismiss: () => void }>((set) => ({
  notices: [],
  push: (m) => set((s) => ({ notices: [...s.notices, m].slice(-3) })),
  dismiss: () => set({ notices: [] }),
}));
