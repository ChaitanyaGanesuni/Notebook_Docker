import { DEFAULT_PROFILE, DEFAULT_PROGRAMME, DEFAULT_TARGETS } from '../../domain/defaults';
import { fromForm, toForm } from './formModel';

describe('setup form', () => {
  it('pre-fills the brief\'s values and round-trips them unchanged', () => {
    const form = toForm(null, null, null);
    expect(form).toMatchObject({ display_name: 'Chaitanya', age: '25', height_cm: '168', water_l: '3', weight_kg: '73.0', weight_date: '2026-11-12', start_date: '2026-11-17', checkpoint_date: '2027-01-01' });
    const { values, errors } = fromForm(form, true);
    expect(errors).toEqual({});
    expect(values.profile).toEqual(DEFAULT_PROFILE);
    expect(values.targets).toEqual(DEFAULT_TARGETS);
    expect(values.programme).toEqual(DEFAULT_PROGRAMME);
    expect(values.startingWeight).toEqual({ date: '2026-11-12', weight_kg: 73.0 });
  });

  it('accepts rows as the database returns them (HH:MM:SS times, numeric strings)', () => {
    const form = toForm({ wake_time: '07:00:00', bed_time: '23:30:00', height_cm: '168.0' as unknown as number }, { bedtime_target: '23:30:00', sleep_min_h: '7.0' as unknown as number }, null, null);
    expect(form).toMatchObject({ wake_time: '07:00', bed_time: '23:30', height_cm: '168', bedtime_target: '23:30', sleep_min_h: '7', weight_kg: '' });
    expect(fromForm(form, false).errors).toEqual({});
    expect(fromForm(form, false).values.startingWeight).toBeNull();
  });

  it('reports errors against the field the user typed in', () => {
    const form = { ...toForm(null, null, null), age: 'twenty', water_l: '30', kcal_target: '2050.5', weight_kg: '', weight_date: '12/11/2026', checkpoint_date: '' };
    const { errors, values } = fromForm(form, true);
    expect(Object.keys(errors).sort()).toEqual(['age', 'kcal_target', 'water_l', 'weight_date', 'weight_kg']);
    expect(values.programme.checkpoint_date).toBeNull();
  });
});
