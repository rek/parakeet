import { describe, expect, it } from 'vitest';
import { buildLiftChartData } from './chart-builders';

describe('buildLiftChartData', () => {
  it('returns null for empty entries', () => {
    expect(buildLiftChartData([], '#ffffff')).toBeNull();
  });

  it('returns chart data with 1 label and 1 data point for a single entry', () => {
    const entries = [{ date: '2026-01-15', value: 100 }];
    const result = buildLiftChartData(entries, '#a3e635');
    expect(result).not.toBeNull();
    expect(result!.labels).toHaveLength(1);
    // index 0: 0 % 1 === 0, so label is shown
    expect(result!.labels[0]).toBe('1/15');
    expect(result!.datasets[0].data).toEqual([100]);
  });

  it('shows label at index 0 and blanks the rest when length <= 6', () => {
    // 3 entries → labelStep = ceil(3/6) = 1 → every index shown
    const entries = [
      { date: '2026-01-01', value: 90 },
      { date: '2026-01-08', value: 95 },
      { date: '2026-01-15', value: 100 },
    ];
    const result = buildLiftChartData(entries, '#ff0000');
    expect(result!.labels).toEqual(['1/1', '1/8', '1/15']);
  });

  it('skips labels based on labelStep for larger datasets', () => {
    // 12 entries → labelStep = ceil(12/6) = 2 → show at 0, 2, 4, 6, 8, 10; blank at 1, 3, 5, ...
    const entries = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      value: 100 + i,
    }));
    const result = buildLiftChartData(entries, '#00ff00');
    expect(result!.labels[0]).toBe('1/1');
    expect(result!.labels[1]).toBe('');   // 1 % 2 !== 0
    expect(result!.labels[2]).toBe('1/3');
    expect(result!.labels[3]).toBe('');
    expect(result!.labels).toHaveLength(12);
  });

  it('dataset data values are rounded to 1 decimal place', () => {
    const entries = [{ date: '2026-03-01', value: 100.456 }];
    const result = buildLiftChartData(entries, '#000000');
    expect(result!.datasets[0].data[0]).toBe(100.5);
  });

  it('dataset strokeWidth is 2', () => {
    const entries = [{ date: '2026-01-01', value: 80 }];
    const result = buildLiftChartData(entries, '#aabbcc');
    expect(result!.datasets[0].strokeWidth).toBe(2);
  });

  it('color function appends hex opacity suffix to liftColor', () => {
    const entries = [{ date: '2026-01-01', value: 80 }];
    const result = buildLiftChartData(entries, '#a3e635');
    const colorFn = result!.datasets[0].color;
    // opacity=1 → Math.round(1*255)=255 → 'ff'
    expect(colorFn(1)).toBe('#a3e635ff');
    // opacity=0 → Math.round(0*255)=0 → '00'
    expect(colorFn(0)).toBe('#a3e63500');
  });

  it('color function defaults opacity to 1 when called with no argument', () => {
    const entries = [{ date: '2026-01-01', value: 80 }];
    const result = buildLiftChartData(entries, '#123456');
    expect(result!.datasets[0].color()).toBe('#123456ff');
  });

  it('color function pads single-digit hex values', () => {
    const entries = [{ date: '2026-01-01', value: 80 }];
    const result = buildLiftChartData(entries, '#000000');
    const colorFn = result!.datasets[0].color;
    // opacity=0.02 → Math.round(0.02*255)=5 → '05'
    expect(colorFn(0.02)).toBe('#00000005');
  });
});
