import { CONFIDENCE_LABEL, estimateUserText, validateEstimate } from './estimate.ts';
import { parseModelJson } from './json.ts';
import { AiRequestError, AiUnavailableError, fakeProvider, fakeResponder, geminiProvider, providerFromEnv } from './provider.ts';

const good = {
  name: 'Poha with two boiled eggs, extra',
  items: [
    { name: 'poha', qty: '1 plate', kcal: 270, protein_g: 5, carbs_g: 45, fat_g: 8, fibre_g: 3 },
    { name: 'boiled eggs', qty: '2', kcal: '150', protein_g: 12.5, carbs_g: 1, fat_g: 10.5, fibre_g: 0 },
  ],
  kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sugar_g: null, sodium_mg: 640,
  junk: false, confidence: 'Medium', assumption: '  One   plate of poha.  ',
};

describe('validateEstimate', () => {
  it('accepts a well-formed answer, sums totals from items and trims the name to 6 words', () => {
    const r = validateEstimate(good);
    expect(r).toEqual({
      ok: true,
      estimate: expect.objectContaining({
        name: 'Poha with two boiled eggs, extra',
        kcal: 420, protein_g: 17.5, carbs_g: 46, fat_g: 18.5, fibre_g: 3,
        sugar_g: null, sodium_mg: 640, junk: false, confidence: 'medium', assumption: 'One plate of poha.',
      }),
    });
    expect(validateEstimate({ ...good, name: 'one two three four five six seven' })).toMatchObject({ estimate: { name: 'one two three four five six' } });
  });
  it('uses top-level totals when there are no items', () => {
    const r = validateEstimate({ name: 'Chai', items: [], kcal: 70, protein_g: 2, carbs_g: 9, fat_g: 2.5, fibre_g: 0, junk: false, confidence: 'high', assumption: 'Half sugar.' });
    expect(r).toMatchObject({ ok: true, estimate: { kcal: 70, protein_g: 2 } });
  });
  it('passes on the "no food" answer', () => {
    expect(validateEstimate({ error: 'There is no food in this photo.' })).toEqual({ ok: false, kind: 'no_food', message: 'There is no food in this photo.' });
  });
  it('rejects out-of-range numbers (kcal 0 to 5,000, protein 0 to 300)', () => {
    expect(validateEstimate({ ...good, items: [], kcal: 5001, protein_g: 10, carbs_g: 1, fat_g: 1 })).toMatchObject({ ok: false, kind: 'invalid', message: expect.stringContaining('kcal 5001') });
    expect(validateEstimate({ ...good, items: [], kcal: 500, protein_g: 301, carbs_g: 1, fat_g: 1 })).toMatchObject({ ok: false, message: expect.stringContaining('protein_g 301') });
    expect(validateEstimate({ ...good, items: [{ ...good.items[0], kcal: -5 }] })).toMatchObject({ ok: false, message: expect.stringContaining('item 1') });
    expect(validateEstimate({ ...good, items: Array(3).fill({ name: 'x', qty: '', kcal: 2000, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 }) })).toMatchObject({ ok: false, message: expect.stringContaining('total kcal 6000') });
  });
  it('rejects wrong types', () => {
    expect(validateEstimate(null)).toMatchObject({ ok: false, kind: 'invalid' });
    expect(validateEstimate([good])).toMatchObject({ ok: false, kind: 'invalid' });
    expect(validateEstimate({ ...good, junk: 'no' })).toMatchObject({ ok: false, message: expect.stringContaining('junk') });
    expect(validateEstimate({ ...good, confidence: 'certain' })).toMatchObject({ ok: false, message: expect.stringContaining('confidence') });
    expect(validateEstimate({ ...good, name: '' })).toMatchObject({ ok: false, message: expect.stringContaining('name') });
    expect(validateEstimate({ ...good, items: 'poha' })).toMatchObject({ ok: false, message: expect.stringContaining('items') });
    expect(validateEstimate({ ...good, items: [{ ...good.items[0], kcal: 'lots' }] })).toMatchObject({ ok: false });
  });
  it('labels confidence and never as exact', () => {
    expect(CONFIDENCE_LABEL).toEqual({ low: 'Rough estimate', medium: 'Fair estimate', high: 'Good estimate' });
  });
  it('lets typed quantities override the photo', () => {
    expect(estimateUserText('2 rotis', true)).toMatch(/overrides the photo/);
    expect(estimateUserText('', true)).toBe('Photo attached. No note.');
    expect(estimateUserText('poha', false)).toBe('No photo. The eater typed: "poha"');
  });
});

describe('parseModelJson', () => {
  it('reads plain, fenced and wrapped JSON', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Here you go: {"a":1} hope that helps')).toEqual({ a: 1 });
    expect(parseModelJson('not json')).toBeUndefined();
  });
});

describe('Gemini adapter', () => {
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
  it('sends system, turns, image and JSON mode, and reads the reply', async () => {
    const seen: { url: string; init: { headers: Record<string, string>; body: string } }[] = [];
    const p = geminiProvider({
      apiKey: 'k', model: 'some-model',
      fetch: async (url, init) => { seen.push({ url, init }); return ok({ candidates: [{ content: { parts: [{ text: '{"x":' }, { text: '1}' }] } }] }); },
    });
    const out = await p.generate({
      system: 'SYS', json: true,
      turns: [{ role: 'user', parts: [{ text: 'hi' }, { image: { mimeType: 'image/jpeg', base64: 'AAA' } }] }, { role: 'assistant', parts: [{ text: 'yo' }] }],
    });
    expect(out).toBe('{"x":1}');
    expect(p.id).toBe('gemini:some-model');
    expect(seen[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/some-model:generateContent');
    expect(seen[0]!.init.headers['x-goog-api-key']).toBe('k');
    const body = JSON.parse(seen[0]!.init.body);
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAA' } }] },
      { role: 'model', parts: [{ text: 'yo' }] },
    ]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });
  it('separates retryable from permanent failures', async () => {
    const status = (s: number) => geminiProvider({ apiKey: 'k', model: 'm', fetch: async () => ({ ok: false, status: s, json: async () => ({}), text: async () => 'nope' }) });
    await expect(status(429).generate({ system: '', turns: [] })).rejects.toBeInstanceOf(AiUnavailableError);
    await expect(status(503).generate({ system: '', turns: [] })).rejects.toBeInstanceOf(AiUnavailableError);
    await expect(status(400).generate({ system: '', turns: [] })).rejects.toBeInstanceOf(AiRequestError);
    const down = geminiProvider({ apiKey: 'k', model: 'm', fetch: async () => { throw new Error('ECONNRESET'); } });
    await expect(down.generate({ system: '', turns: [] })).rejects.toBeInstanceOf(AiUnavailableError);
    const blocked = geminiProvider({ apiKey: 'k', model: 'm', fetch: async () => ok({ promptFeedback: { blockReason: 'SAFETY' } }) });
    await expect(blocked.generate({ system: '', turns: [] })).rejects.toBeInstanceOf(AiRequestError);
  });
});

describe('provider from environment', () => {
  const env = (vars: Record<string, string>) => (k: string) => vars[k];
  const noFetch = async () => { throw new Error('unused'); };
  it('defaults to Gemini and needs a key and a model', () => {
    expect(() => providerFromEnv(env({}), noFetch)).toThrow('GEMINI_API_KEY');
    expect(() => providerFromEnv(env({ GEMINI_API_KEY: 'k' }), noFetch)).toThrow('AI_MODEL');
    expect(providerFromEnv(env({ GEMINI_API_KEY: 'k', AI_MODEL: 'm1' }), noFetch).id).toBe('gemini:m1');
  });
  it('switches provider without code changes, and rejects unknown ones', () => {
    expect(providerFromEnv(env({ AI_PROVIDER: 'fake' }), noFetch).id).toBe('fake:test');
    expect(() => providerFromEnv(env({ AI_PROVIDER: 'other' }), noFetch)).toThrow('Unknown AI_PROVIDER');
  });
  it('fake provider answers the estimator with a valid estimate', async () => {
    const p = fakeProvider(fakeResponder);
    const text = await p.generate({ system: 'MEAL_ESTIMATOR ...', turns: [{ role: 'user', parts: [{ text: 'poha' }] }] });
    expect(validateEstimate(parseModelJson(text))).toMatchObject({ ok: true, estimate: { kcal: 325 } });
    expect(p.calls).toHaveLength(1);
  });
});
