/**
 * Coach guardrails enforced in code, after the model answers (brief section 10).
 * The prompt asks for the same things; this is the backstop when it does not comply.
 */

export const MIN_KCAL = 1400;

export type GuardrailFlag = 'low_kcal' | 'rapid_loss' | 'see_doctor';

const SYMPTOMS = /\b(pain|painful|ache|aching|acidity|heartburn|reflux|gastritis|dizz\w*|faint\w*|nause\w*|vomit\w*|blood|bleed\w*|chest|bloat\w*|constipat\w*|diarrh\w*|injur\w*|swelling|numb\w*|palpitation\w*|breathless\w*|period|missed period)\b/i;
const RAPID_LOSS = /\b(crash diet\w*|water fast\w*|juice cleanse|detox|laxative\w*|diuretic\w*|starv\w*|fat burner\w*|sauna suit|skip(?:ping)? (?:meals|breakfast|dinner|lunch)|(?:24|36|48|72)[- ]hour fast\w*|very low[- ]calorie)\b/i;
const INTAKE_VERB = /\b(eat|eating|aim|target|intake|consume|consuming|limit|cut|stick|keep|go|drop|reduce|lower|budget)\b/i;
const KCAL_NUMBER = /\b(\d{1,2},?\d{3}|\d{3})\s*(?:-|to|–)?\s*(?:\d{1,2},?\d{3}|\d{3})?\s*(kcal|calories|cal)\b/gi;

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/);
}

/** Calorie figures below the floor that the reply presents as something to eat. */
export function lowIntakeSuggestions(reply: string): number[] {
  const found: number[] = [];
  for (const s of sentences(reply)) {
    if (!INTAKE_VERB.test(s)) continue;
    for (const m of s.matchAll(KCAL_NUMBER)) {
      const n = Number(m[1]!.replace(',', ''));
      // Ignore small numbers (a 120 kcal snack) and anything framed as a deficit or a gap.
      const at = m.index ?? 0;
      const around = s.slice(Math.max(0, at - 30), at + m[0].length + 30).toLowerCase();
      if (n >= 800 && n < MIN_KCAL && !/(deficit|under|over|left|remaining|burn|gap|surplus|difference|short)/.test(around)) found.push(n);
    }
  }
  return found;
}

export function enforceGuardrails(question: string, reply: string, kcalTarget: number): { text: string; flags: GuardrailFlag[] } {
  const flags: GuardrailFlag[] = [];
  const notes: string[] = [];
  if (lowIntakeSuggestions(reply).length > 0) {
    flags.push('low_kcal');
    notes.push(`FitTrack never recommends eating under ${MIN_KCAL.toLocaleString('en-IN')} kcal a day. Your target is ${kcalTarget.toLocaleString('en-IN')} kcal.`);
  }
  if (RAPID_LOSS.test(reply) || RAPID_LOSS.test(question)) {
    flags.push('rapid_loss');
    notes.push('Avoid rapid-loss tactics such as crash diets, long fasts, skipping meals or detox products. A steady deficit keeps muscle and is easier to hold.');
  }
  if (SYMPTOMS.test(question) && !/\b(doctor|physician|gp|medical professional)\b/i.test(reply)) {
    flags.push('see_doctor');
    notes.push('If this continues or gets worse, see a doctor.');
  }
  return { text: notes.length ? `${reply.trim()}\n\n${notes.join(' ')}` : reply.trim(), flags };
}
