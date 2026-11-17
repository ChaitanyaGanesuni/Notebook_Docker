import { addDays, diffDays, formatLocalDate, isLocalDate, localDateOf, startOfWeek, weekDates, weekdayIndex } from './dates';

describe('localDateOf (Asia/Kolkata midnight boundary)', () => {
  it('keeps the previous date one second before IST midnight', () => {
    // 23:59:59 IST on 17 Nov = 18:29:59 UTC on 17 Nov
    expect(localDateOf(new Date('2026-11-17T18:29:59Z'))).toBe('2026-11-17');
  });
  it('rolls to the next date exactly at IST midnight', () => {
    // 00:00:00 IST on 18 Nov = 18:30:00 UTC on 17 Nov
    expect(localDateOf(new Date('2026-11-17T18:30:00Z'))).toBe('2026-11-18');
  });
  it('differs from the UTC date in the early IST morning', () => {
    // 02:00 IST on 1 Jan 2027 is still 31 Dec 2026 in UTC
    const instant = new Date('2026-12-31T20:30:00Z');
    expect(localDateOf(instant)).toBe('2027-01-01');
    expect(localDateOf(instant, 'UTC')).toBe('2026-12-31');
  });
  it('respects another timezone', () => {
    expect(localDateOf(new Date('2026-11-17T03:00:00Z'), 'America/Los_Angeles')).toBe('2026-11-16');
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('diffs days', () => {
    expect(diffDays('2026-11-17', '2027-02-08')).toBe(83);
    expect(diffDays('2026-11-17', '2026-11-12')).toBe(-5);
  });
  it('knows weekdays (17 Nov 2026 is a Tuesday)', () => {
    expect(weekdayIndex('2026-11-17')).toBe(1);
    expect(weekdayIndex('2026-11-16')).toBe(0);
    expect(weekdayIndex('2026-11-22')).toBe(6);
    expect(weekdayIndex('1969-12-31')).toBe(2);
  });
  it('builds Monday-to-Sunday weeks', () => {
    expect(startOfWeek('2026-11-17')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(weekDates('2026-11-17')).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ]);
  });
  it('validates and formats', () => {
    expect(isLocalDate('2026-11-17')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('17-11-2026')).toBe(false);
    expect(isLocalDate(20261117)).toBe(false);
    expect(formatLocalDate('2026-11-17')).toBe('Tue 17 Nov 2026');
  });
});
