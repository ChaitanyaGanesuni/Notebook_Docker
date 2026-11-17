/**
 * Provider-agnostic AI interface. Edge Functions talk only to `AiProvider`;
 * which provider and model is decided by environment variables, so switching
 * needs no code change. The app never calls a provider directly.
 */

export type Part = { text: string } | { image: { mimeType: string; base64: string } };

export interface Turn {
  role: 'user' | 'assistant';
  parts: Part[];
}

export interface GenerateRequest {
  system: string;
  turns: Turn[];
  /** Ask the model for a JSON object. */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AiProvider {
  /** Provider and model, for storing alongside generated content. */
  readonly id: string;
  generate(req: GenerateRequest): Promise<string>;
}

/** Raised for failures the caller may retry later (network, rate limit, provider outage). */
export class AiUnavailableError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

/** Raised when the provider refuses the request or is misconfigured. Retrying will not help. */
export class AiRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AiRequestError';
  }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string>;
}>;

// ------------------------------------------------------------------ Gemini

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export function geminiProvider(opts: { apiKey: string; model: string; fetch: FetchLike; baseUrl?: string }): AiProvider {
  const base = opts.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  return {
    id: `gemini:${opts.model}`,
    async generate(req) {
      const body = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.turns.map((t) => ({
          role: t.role === 'assistant' ? 'model' : 'user',
          parts: t.parts.map((p) => ('text' in p ? { text: p.text } : { inlineData: { mimeType: p.image.mimeType, data: p.image.base64 } })),
        })),
        generationConfig: {
          temperature: req.temperature ?? 0.4,
          maxOutputTokens: req.maxOutputTokens ?? 2048,
          ...(req.json ? { responseMimeType: 'application/json' } : {}),
        },
      };
      let res;
      try {
        res = await opts.fetch(`${base}/models/${encodeURIComponent(opts.model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
          body: JSON.stringify(body),
        });
      } catch (e) {
        throw new AiUnavailableError(`AI provider unreachable: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        if (res.status === 429 || res.status >= 500) throw new AiUnavailableError(`AI provider busy (HTTP ${res.status})`, res.status);
        throw new AiRequestError(`AI provider rejected the request (HTTP ${res.status}): ${detail}`, res.status);
      }
      const data = (await res.json()) as GeminiResponse;
      if (data.promptFeedback?.blockReason) throw new AiRequestError(`AI provider blocked the request: ${data.promptFeedback.blockReason}`);
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
      if (!text) throw new AiUnavailableError(`AI provider returned no text (${data.candidates?.[0]?.finishReason ?? 'no candidates'})`);
      return text;
    },
  };
}

// -------------------------------------------------------------------- fake

/**
 * Deterministic stand-in for tests and local development without a key
 * (AI_PROVIDER=fake). Never use it for real estimates.
 */
export function fakeProvider(respond: (req: GenerateRequest) => string): AiProvider & { calls: GenerateRequest[] } {
  const calls: GenerateRequest[] = [];
  return {
    id: 'fake:test',
    calls,
    async generate(req) {
      calls.push(req);
      return respond(req);
    },
  };
}

// ------------------------------------------------------------- from env

export function providerFromEnv(env: (name: string) => string | undefined, fetchImpl: FetchLike): AiProvider {
  const provider = (env('AI_PROVIDER') ?? 'gemini').trim().toLowerCase();
  const model = env('AI_MODEL')?.trim();
  if (provider === 'gemini') {
    const apiKey = env('GEMINI_API_KEY')?.trim();
    if (!apiKey) throw new AiRequestError('GEMINI_API_KEY is not set for the Edge Functions.');
    if (!model) throw new AiRequestError('AI_MODEL is not set for the Edge Functions.');
    return geminiProvider({ apiKey, model, fetch: fetchImpl });
  }
  if (provider === 'fake') return fakeProvider(fakeResponder);
  throw new AiRequestError(`Unknown AI_PROVIDER "${provider}". Supported: gemini, fake.`);
}

/** The fake provider's canned answers: enough to exercise every screen end to end. */
export function fakeResponder(req: GenerateRequest): string {
  const userText = req.turns.flatMap((t) => t.parts).map((p) => ('text' in p ? p.text : '')).join(' ').toLowerCase();
  if (req.system.includes('MEAL_ESTIMATOR')) {
    if (userText.includes('no food')) return JSON.stringify({ error: 'No food is visible in the photo.' });
    return JSON.stringify({
      name: 'Poha with peanuts', confidence: 'medium', junk: false,
      assumption: 'Assumed one typical plate cooked with about a tablespoon of oil.',
      items: [{ name: 'poha', qty: '1 plate', kcal: 270, protein_g: 5, carbs_g: 45, fat_g: 8, fibre_g: 3 },
        { name: 'peanuts', qty: '1 tbsp', kcal: 55, protein_g: 2.5, carbs_g: 1.5, fat_g: 4.5, fibre_g: 0.8 }],
      kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sugar_g: null, sodium_mg: null,
    });
  }
  if (req.system.includes('REPORT_WRITER')) {
    return JSON.stringify({
      headline: 'A steady day with room for more protein.',
      went_well: ['You logged every main meal.'],
      improve: ['Protein was under target.'],
      suggestions: ['Add two boiled eggs to breakfast tomorrow.'],
      weight_comment: 'Too early to judge a trend: look at the 7-day average after a full week.',
    });
  }
  return 'From your logged data: keep protein at every meal and judge progress on the 7-day average.';
}
