import { ESTIMATE_SYSTEM, estimateUserText, MAX_TEXT_LENGTH, validateEstimate } from '../ai/estimate.ts';
import { parseModelJson } from '../ai/json.ts';
import type { Part } from '../ai/provider.ts';
import { aiFailure, fail, type Handler } from './common.ts';

/** Base64 of a ~1.5 MB JPEG. The app resizes photos to about 1024 px, well under this. */
export const MAX_PHOTO_BASE64 = 2_000_000;

/**
 * POST { text?: string, photo_path?: string }
 * 200 { estimate } | 422 { error: "no_food" } | 4xx/5xx { error, message, retryable? }
 * Writes nothing: the app saves the estimate through its offline queue, keeping
 * the original AI estimate next to any numbers the user types.
 */
export const estimateMeal: Handler = async (body, { db, ai }) => {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  const photoPath = typeof b.photo_path === 'string' && b.photo_path.trim() ? b.photo_path.trim() : null;
  if (!text && !photoPath) return fail(400, 'bad_request', 'Send a photo, a description, or both.');
  if (text.length > MAX_TEXT_LENGTH) return fail(400, 'bad_request', `Keep the description under ${MAX_TEXT_LENGTH} characters.`);
  if (photoPath && (!photoPath.startsWith(`${db.userId}/`) || photoPath.includes('..'))) return fail(403, 'forbidden', 'That photo is not yours.');

  const parts: Part[] = [{ text: estimateUserText(text, photoPath !== null) }];
  if (photoPath) {
    const photo = await db.downloadPhoto(photoPath);
    if (!photo) return fail(404, 'photo_not_found', 'The photo has not finished uploading.', { retryable: true });
    if (photo.base64.length > MAX_PHOTO_BASE64) return fail(413, 'photo_too_large', 'The photo is too large.');
    parts.push({ image: photo });
  }

  // One retry when the model's answer does not parse or validate.
  let lastProblem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await ai.generate({ system: ESTIMATE_SYSTEM, turns: [{ role: 'user', parts }], json: true, temperature: 0.2, maxOutputTokens: 1500 });
    } catch (e) {
      return aiFailure(e);
    }
    const result = validateEstimate(parseModelJson(raw));
    if (result.ok) return { status: 200, body: { estimate: result.estimate, model: ai.id } };
    if (result.kind === 'no_food') return fail(422, 'no_food', result.message);
    lastProblem = result.message;
  }
  return fail(502, 'invalid_ai_response', `The AI answer did not pass validation (${lastProblem}).`, { retryable: true });
};
