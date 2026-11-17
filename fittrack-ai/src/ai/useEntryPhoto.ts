import { useQuery } from '@tanstack/react-query';
import { useData } from '../data/DataProvider';
import type { MealEntryRow } from '../data/tables';
import { localPhotoKey } from './estimateQueue';
import { signedPhotoUrl } from './functions';

/** The entry's photo: the copy on this phone if there is one, otherwise a short-lived signed link. */
export function useEntryPhoto(entry: MealEntryRow): string | null {
  const { store } = useData();
  const q = useQuery({
    queryKey: ['local', 'photo', entry.id, entry.photo_path],
    enabled: !!store,
    staleTime: 50 * 60_000,
    networkMode: 'always',
    queryFn: async () => {
      const local = await store!.getMeta(localPhotoKey(entry.id));
      if (local) return local;
      return entry.photo_path ? signedPhotoUrl(entry.photo_path) : null;
    },
  });
  return q.data ?? null;
}
