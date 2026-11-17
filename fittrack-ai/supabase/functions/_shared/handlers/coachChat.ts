import { enforceGuardrails } from '../coach/guardrails.ts';
import { coachSystem } from '../coach/prompts.ts';
import type { Turn } from '../ai/provider.ts';
import { coachContext } from '../summaries.ts';
import { aiFailure, fail, isResult, loadHistory, type Handler } from './common.ts';

export const MAX_MESSAGE_LENGTH = 2000;
export const DAILY_MESSAGE_LIMIT = 60;
const HISTORY_DAYS = 35;

/**
 * POST { message: string }
 * 200 { messages: [userRow, assistantRow] }: both are stored in coach_messages.
 */
export const coachChat: Handler = async (body, { db, ai, now }) => {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (!message) return fail(400, 'bad_request', 'Type a question.');
  if (message.length > MAX_MESSAGE_LENGTH) return fail(400, 'bad_request', `Keep questions under ${MAX_MESSAGE_LENGTH} characters.`);

  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  if ((await db.countUserMessagesSince(since)) >= DAILY_MESSAGE_LIMIT) {
    return fail(429, 'rate_limited', `You have asked ${DAILY_MESSAGE_LIMIT} questions in the last 24 hours. Try again later.`);
  }

  const history = await loadHistory(db, now, HISTORY_DAYS);
  if (isResult(history)) return history;
  const recent = (await db.recentCoachMessages(10)).sort((a, b2) => a.created_at.localeCompare(b2.created_at));
  const turns: Turn[] = [
    ...recent.map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  let reply: string;
  try {
    reply = await ai.generate({ system: coachSystem(coachContext(history), history.profile.sex), turns, temperature: 0.5, maxOutputTokens: 800 });
  } catch (e) {
    return aiFailure(e);
  }
  const checked = enforceGuardrails(message, reply, history.targets.kcal_target);
  const rows = await db.insertCoachMessages([
    { role: 'user', content: message, meta: {}, created_at: now.toISOString() },
    {
      role: 'assistant', content: checked.text, meta: { model: ai.id, guardrails: checked.flags, data_through: history.today },
      created_at: new Date(Math.max(Date.now(), now.getTime() + 1)).toISOString(),
    },
  ]);
  return { status: 200, body: { messages: rows } };
};
