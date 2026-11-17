import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickResult = { ok: true; uri: string } | { ok: false; reason: 'cancelled' | 'denied' | 'error'; message?: string };

/** Longest side sent for estimation. Big enough to recognise food, small enough to upload on a weak signal. */
export const MAX_SIDE = 1024;

export async function pickPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  try {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1, allowsEditing: false, exif: false };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return { ok: false, reason: 'cancelled' };
    const a = result.assets[0];
    const resize = a.width >= a.height ? { width: Math.min(MAX_SIDE, a.width) } : { height: Math.min(MAX_SIDE, a.height) };
    const out = await manipulateAsync(a.uri, [{ resize }], { compress: 0.7, format: SaveFormat.JPEG });
    return { ok: true, uri: out.uri };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

function photoDir(): Directory {
  const dir = new Directory(Paths.document, 'meal-photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Copies a picked photo into app storage so it survives until it is uploaded, even with no signal. */
export async function keepPhoto(entryId: string, uri: string): Promise<string> {
  const dest = new File(photoDir(), `${entryId}.jpg`);
  if (dest.exists) dest.delete();
  await new File(uri).copy(dest);
  return dest.uri;
}

export async function photoBytes(localUri: string): Promise<Uint8Array | null> {
  const f = new File(localUri);
  return f.exists ? f.bytes() : null;
}
