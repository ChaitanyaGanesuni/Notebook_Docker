/** Where the Supabase session is kept on the phone: a SQLite-backed key-value store. */
import Storage from 'expo-sqlite/kv-store';

export const sessionStorage = {
  getItem: (key: string) => Storage.getItem(key),
  setItem: (key: string, value: string) => Storage.setItem(key, value),
  removeItem: (key: string) => Storage.removeItem(key),
};
