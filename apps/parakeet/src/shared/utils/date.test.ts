import { formatDate, formatTime, localDateIso } from './date';

describe('date', () => {
  it('returns YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 2, 5); // March 5 2026 local midnight
    expect(localDateIso(d)).toBe('2026-03-05');
  });

  it('pads month and day with leading zeros', () => {
    expect(localDateIso(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(localDateIso(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('handles end of year correctly', () => {
    expect(localDateIso(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('null/undefined → em dash', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats a date string', () => {
    expect(formatDate('2026-03-05')).toBe('5 Mar 2026');
  });

  it('formats a Date object', () => {
    expect(formatDate(new Date('2026-01-15T12:00:00Z'))).toBe('15 Jan 2026');
  });

  it('invalid string → em dash', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
});

describe('formatTime', () => {
  it('null/undefined → empty string', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
  });

  it('formats HH:MM in local time', () => {
    const d = new Date(2026, 2, 7, 9, 5); // 09:05 local
    expect(formatTime(d)).toBe('09:05');
  });

  it('formats a Date object with double-digit hour and minute', () => {
    const d = new Date(2026, 2, 7, 14, 30);
    expect(formatTime(d)).toBe('14:30');
  });

  it('invalid string → empty string', () => {
    expect(formatTime('not-a-date')).toBe('');
  });
});
