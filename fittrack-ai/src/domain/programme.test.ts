import { DEFAULT_PROGRAMME } from './defaults';
import { daysUntil, programmeEndDate, programmeProgress } from './programme';

const p = { startDate: DEFAULT_PROGRAMME.start_date, weeks: DEFAULT_PROGRAMME.weeks };

describe('programme', () => {
  it('ends on 8 February 2027', () => {
    expect(programmeEndDate(p)).toBe('2027-02-08');
  });
  it('is week 1, day 1 on the start date', () => {
    expect(programmeProgress(p, '2026-11-17')).toEqual({ status: 'active', week: 1, day: 1, totalWeeks: 12, totalDays: 84 });
  });
  it('rolls to week 2 on day 8', () => {
    expect(programmeProgress(p, '2026-11-23')).toMatchObject({ week: 1, day: 7 });
    expect(programmeProgress(p, '2026-11-24')).toMatchObject({ week: 2, day: 8 });
  });
  it('is week 12, day 84 on the last day', () => {
    expect(programmeProgress(p, '2027-02-08')).toMatchObject({ status: 'active', week: 12, day: 84 });
  });
  it('reports upcoming and finished', () => {
    expect(programmeProgress(p, '2026-11-12')).toMatchObject({ status: 'upcoming', daysToStart: 5 });
    expect(programmeProgress(p, '2027-02-09')).toMatchObject({ status: 'finished', daysSinceEnd: 1 });
  });
  it('counts down to the 1 January checkpoint', () => {
    expect(daysUntil('2027-01-01', '2026-11-17')).toBe(45);
    expect(daysUntil('2027-01-01', '2027-01-01')).toBe(0);
    expect(daysUntil('2027-01-01', '2027-01-02')).toBe(-1);
  });
});
