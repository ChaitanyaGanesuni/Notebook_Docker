import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { PickResult } from './photos';

export type { PickResult };
export const MAX_SIDE = 1024;

/** Web build (smoke tests only): the browser's file picker; photos are held in memory until uploaded. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  try {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return { ok: false, reason: 'cancelled' };
    const a = result.assets[0];
    const resize = a.width >= a.height ? { width: Math.min(MAX_SIDE, a.width || MAX_SIDE) } : { height: Math.min(MAX_SIDE, a.height || MAX_SIDE) };
    const out = await manipulateAsync(a.uri, [{ resize }], { compress: 0.7, format: SaveFormat.JPEG });
    return { ok: true, uri: out.uri };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

export async function keepPhoto(_entryId: string, uri: string): Promise<string> {
  return uri;
}

export async function photoBytes(localUri: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await (await fetch(localUri)).arrayBuffer());
  } catch {
    return null;
  }
}
