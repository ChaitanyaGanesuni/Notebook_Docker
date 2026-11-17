import { DEFAULT_PROFILE, DEFAULT_PROGRAMME, DEFAULT_TARGETS, trackDefaultsForSex } from './defaults';
import {
  hasErrors, parseNumber, validateEmail, validatePassword, validateProfile, validateProgramme, validateTargets, validateWeight,
} from './validation';

describe('validation', () => {
  it('accepts the pre-filled defaults', () => {
    expect(validateProfile(DEFAULT_PROFILE)).toEqual({});
    expect(validateTargets(DEFAULT_TARGETS)).toEqual({});
    expect(validateProgramme(DEFAULT_PROGRAMME)).toEqual({});
    expect(validateWeight(73.0)).toBeUndefined();
  });
  it('rejects minors and bad measurements', () => {
    expect(validateProfile({ ...DEFAULT_PROFILE, age: 17 }).age).toBeDefined();
    expect(validateProfile({ ...DEFAULT_PROFILE, height_cm: 16.8 }).height_cm).toBeDefined();
    expect(validateProfile({ ...DEFAULT_PROFILE, display_name: '  ' }).display_name).toBeDefined();
    expect(validateProfile({ ...DEFAULT_PROFILE, timezone: 'Mars/Olympus' }).timezone).toBeDefined();
    expect(validateProfile({ ...DEFAULT_PROFILE, bed_time: '11:30 pm' }).bed_time).toBeDefined();
    expect(validateWeight(730)).toBeDefined();
    expect(validateWeight(NaN)).toBeDefined();
  });
  it('never allows a calorie target under 1,400', () => {
    const e = validateTargets({ ...DEFAULT_TARGETS, kcal_target: 1200, kcal_min: 1100 });
    expect(e.kcal_target).toBeDefined();
    expect(e.kcal_min).toBeDefined();
  });
  it('requires targets inside their ranges', () => {
    expect(validateTargets({ ...DEFAULT_TARGETS, kcal_target: 2200 }).kcal_target).toBeDefined();
    expect(validateTargets({ ...DEFAULT_TARGETS, protein_target_g: 150 }).protein_target_g).toBeDefined();
    expect(validateTargets({ ...DEFAULT_TARGETS, fat_max_g: 40 }).fat_max_g).toBeDefined();
  });
  it('validates the programme', () => {
    expect(validateProgramme({ ...DEFAULT_PROGRAMME, start_date: '2026-13-01' }).start_date).toBeDefined();
    expect(validateProgramme({ ...DEFAULT_PROGRAMME, checkpoint_date: '2026-11-01' }).checkpoint_date).toBeDefined();
    expect(validateProgramme({ ...DEFAULT_PROGRAMME, checkpoint_date: null })).toEqual({});
    expect(hasErrors(validateProgramme({ ...DEFAULT_PROGRAMME, weeks: 0 }))).toBe(true);
  });
  it('parses typed numbers strictly', () => {
    expect(parseNumber('73.0')).toBe(73);
    expect(parseNumber(' 72,5 ')).toBe(72.5);
    expect(parseNumber('73kg')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
  });
  it('validates credentials', () => {
    expect(validateEmail('a@b.co')).toBeUndefined();
    expect(validateEmail('nope')).toBeDefined();
    expect(validatePassword('short')).toBeDefined();
    expect(validatePassword('long enough')).toBeUndefined();
  });
  it('defaults the track from sex without locking it', () => {
    expect(trackDefaultsForSex('female')).toEqual({ default_track: 'women', demo_presenter: 'female' });
    expect(trackDefaultsForSex('male')).toEqual({ default_track: 'men', demo_presenter: 'male' });
  });
});
