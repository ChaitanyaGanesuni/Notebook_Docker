import { MemoryStore } from './memoryStore';
import type { LocalStore } from './store';

/** Web build (smoke tests only): in-memory, so data is reloaded from the server after a refresh. */
export async function createLocalStore(): Promise<LocalStore> {
  const store = new MemoryStore();
  await store.init();
  return store;
}
