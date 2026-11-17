import { enforceGuardrails } from '../coach/guardrails.ts';
import { reportSystem } from '../coach/prompts.ts';
import { parseModelJson } from '../ai/json.ts';
import { addDays, diffDays, isLocalDate } from '../domain/dates.ts';
import { buildReportData, narrativeText, reportFacts, reportPeriod, validateNarrative, type ReportKind } from '../reports.ts';
import { aiFailure, fail, isResult, loadHistory, type Handler } from './common.ts';

export const MAX_DAYS_BACK = 120;

/**
 * POST { kind: "daily" | "weekly", date?: "YYYY-MM-DD", force?: boolean }
 * A daily report covers `date`; a weekly report covers the 7 days ending on `date`.
 * Stored reports are returned as they are unless `force` is set, so opening the
 * screen never regenerates one.
 */
export const generateReport: Handler = async (body, { db, ai, now }) => {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const kind = b.kind === 'daily' || b.kind === 'weekly' ? (b.kind as ReportKind) : null;
  if (!kind) return fail(400, 'bad_request', 'kind must be "daily" or "weekly".');

  if (b.date !== undefined && !isLocalDate(b.date)) return fail(400, 'bad_request', 'date must be YYYY-MM-DD.');
  const asked = b.date as string | undefined;
  // Enough history for the period and the 7-day weight average before it.
  const history = await loadHistory(db, now, 21, () => (asked ? addDays(asked, -20) : null));
  if (isResult(history)) return history;
  const date = asked ?? history.today;
  if (date > history.today) return fail(400, 'bad_request', 'That date has not happened yet.');
  if (diffDays(date, history.today) > MAX_DAYS_BACK) return fail(400, 'bad_request', `Reports go back ${MAX_DAYS_BACK} days.`);
  const { start, end } = reportPeriod(kind, date);

  const existing = await db.getReport(kind, start);
  if (existing && b.force !== true) return { status: 200, body: { report: existing, cached: true } };

  const data = buildReportData(history, kind, date);
  let narrative = null;
  let problem = '';
  for (let attempt = 0; attempt < 2 && !narrative; attempt++) {
    let raw: string;
    try {
      raw = await ai.generate({ system: reportSystem(kind, reportFacts(data)), turns: [{ role: 'user', parts: [{ text: `Write the ${kind} report.` }] }], json: true, temperature: 0.4, maxOutputTokens: 1000 });
    } catch (e) {
      return aiFailure(e);
    }
    narrative = validateNarrative(parseModelJson(raw));
    if (!narrative) problem = 'the report text was not in the expected shape';
  }
  if (!narrative) return fail(502, 'invalid_ai_response', `Could not write the report: ${problem}.`, { retryable: true });

  const checked = enforceGuardrails('', narrativeText(narrative), history.targets.kcal_target);
  const report = await db.upsertReport({
    kind, period_start: start, period_end: end,
    content: { data, narrative, guardrails: checked.flags },
    body: checked.text, model: ai.id,
  });
  return { status: 200, body: { report, cached: false } };
};
