/**
 * Meal estimation: the prompt, and server-side validation of whatever the model
 * returns before anything reaches the app (brief section 6).
 */

export type Confidence = 'low' | 'medium' | 'high';

export interface EstimateItem {
  name: string;
  qty: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
}

export interface MealEstimate {
  name: string;
  items: EstimateItem[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  sugar_g: number | null;
  sodium_mg: number | null;
  junk: boolean;
  confidence: Confidence;
  assumption: string;
}

export type EstimateResult =
  | { ok: true; estimate: MealEstimate }
  | { ok: false; kind: 'no_food'; message: string }
  | { ok: false; kind: 'invalid'; message: string };

export const RANGES = {
  kcal: [0, 5000], protein_g: [0, 300], carbs_g: [0, 1000], fat_g: [0, 500], fibre_g: [0, 200],
  sugar_g: [0, 1000], sodium_mg: [0, 50000],
} as const;

export const CONFIDENCE_LABEL: Record<Confidence, string> = { low: 'Rough estimate', medium: 'Fair estimate', high: 'Good estimate' };

export const MAX_TEXT_LENGTH = 1000;
export const MAX_ITEMS = 20;

export const ESTIMATE_SYSTEM = `MEAL_ESTIMATOR
You estimate calories and macronutrients for one meal from a photo, a short text, or both.

The eater is an adult in Pune, India, eating home food, office canteen food and restaurant or delivery food.
Rules:
- When a quantity is not stated or visible, assume one typical Indian serving.
- Assume restaurant and canteen dishes use generous oil.
- Quantities typed in the text override what the photo suggests.
- junk is true for deep-fried food, fast food such as pizza or burgers, sweets and sugary drinks.
- These are estimates. Never claim to know exact quantities from an image. Say what you assumed.
- confidence: "high" only when the dish and portion are both clear; "low" when either is a guess.
- If there is no food or drink in the input, reply with {"error": "<one short sentence>"} and nothing else.

Reply with one JSON object only, no prose, in exactly this shape:
{"name": "short label, at most 6 words",
 "items": [{"name": "poha", "qty": "1 plate", "kcal": 270, "protein_g": 5, "carbs_g": 45, "fat_g": 8, "fibre_g": 3}],
 "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fibre_g": 0,
 "sugar_g": null, "sodium_mg": null,
 "junk": false,
 "confidence": "low | medium | high",
 "assumption": "one sentence on the main portion assumption"}
Top-level totals must equal the sum of the items. Use numbers, not strings.`;

export function estimateUserText(text: string, hasPhoto: boolean): string {
  const t = text.trim();
  if (hasPhoto && t) return `Photo attached. The eater's note (overrides the photo on quantities): "${t}"`;
  if (hasPhoto) return 'Photo attached. No note.';
  return `No photo. The eater typed: "${t}"`;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return Number(v);
  return null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function inRange(key: keyof typeof RANGES, v: unknown): number | string {
  const n = toNumber(v);
  const [min, max] = RANGES[key];
  if (n === null) return `${key} is not a number`;
  if (n < min || n > max) return `${key} ${n} is outside ${min} to ${max}`;
  return round1(n);
}

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** At most `n` words. */
function words(s: string, n: number): string {
  return s.split(' ').filter(Boolean).slice(0, n).join(' ');
}

/**
 * Checks types and ranges and normalises the model's answer. When items are
 * present the totals are recomputed from them, so the breakdown always adds up
 * to the numbers shown.
 */
export function validateEstimate(raw: unknown): EstimateResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, kind: 'invalid', message: 'Response is not a JSON object' };
  const r = raw as Record<string, unknown>;
  if (typeof r.error === 'string' && r.error.trim()) return { ok: false, kind: 'no_food', message: cleanText(r.error, 200) };

  const errors: string[] = [];
  const name = words(cleanText(r.name, 80), 6);
  if (!name) errors.push('name is missing');

  if (r.items !== undefined && !Array.isArray(r.items)) errors.push('items is not a list');
  const rawItems = Array.isArray(r.items) ? r.items.slice(0, MAX_ITEMS) : [];
  const items: EstimateItem[] = [];
  rawItems.forEach((it, i) => {
    if (typeof it !== 'object' || it === null) { errors.push(`item ${i + 1} is not an object`); return; }
    const o = it as Record<string, unknown>;
    const itemName = cleanText(o.name, 60);
    if (!itemName) { errors.push(`item ${i + 1} has no name`); return; }
    const nums = (['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'] as const).map((k) => [k, o[k] == null && k === 'fibre_g' ? 0 : inRange(k, o[k])] as const);
    const bad = nums.filter(([, v]) => typeof v === 'string');
    if (bad.length) { errors.push(`item ${i + 1}: ${bad.map(([, v]) => v).join(', ')}`); return; }
    const n = Object.fromEntries(nums) as Record<'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fibre_g', number>;
    items.push({ name: itemName, qty: cleanText(o.qty, 40), ...n });
  });

  const totals = {} as Record<'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fibre_g', number>;
  for (const k of ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'] as const) {
    if (items.length > 0) {
      totals[k] = round1(items.reduce((s, it) => s + it[k], 0));
      const [, max] = RANGES[k];
      if (totals[k] > max) errors.push(`total ${k} ${totals[k]} is above ${max}`);
    } else {
      const v = r[k] == null && k === 'fibre_g' ? 0 : inRange(k, r[k]);
      if (typeof v === 'string') errors.push(v); else totals[k] = v;
    }
  }

  const optional = (k: 'sugar_g' | 'sodium_mg'): number | null => {
    if (r[k] == null) return null;
    const v = inRange(k, r[k]);
    if (typeof v === 'string') { errors.push(v); return null; }
    return v;
  };
  const sugar_g = optional('sugar_g');
  const sodium_mg = optional('sodium_mg');

  if (typeof r.junk !== 'boolean') errors.push('junk is not true or false');
  const confidence = typeof r.confidence === 'string' ? r.confidence.trim().toLowerCase() : '';
  if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') errors.push('confidence is not low, medium or high');

  if (errors.length) return { ok: false, kind: 'invalid', message: errors.slice(0, 5).join('; ') };
  return {
    ok: true,
    estimate: {
      name, items, ...totals, sugar_g, sodium_mg,
      junk: r.junk as boolean,
      confidence: confidence as Confidence,
      assumption: cleanText(r.assumption, 300) || 'Typical serving assumed.',
    },
  };
}
