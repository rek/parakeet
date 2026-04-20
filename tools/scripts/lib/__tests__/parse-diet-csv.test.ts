import { describe, expect, it } from 'vitest';

import {
  parseFoodCsv,
  parseLifestyleCsv,
  parseQuotedCsv,
  parseSupplementCsv,
} from '../parse-diet-csv';

describe('parseFoodCsv', () => {
  it('parses basic 4-column rows', () => {
    const csv = [
      'category,food,status,notes',
      'protein,eggs,yes,',
      'protein,tofu,caution,phytoestrogen',
      'grain,white bread,no,high GI',
    ].join('\n');
    expect(parseFoodCsv(csv)).toEqual([
      { category: 'protein', food: 'eggs', status: 'yes', notes: '' },
      { category: 'protein', food: 'tofu', status: 'caution', notes: 'phytoestrogen' },
      { category: 'grain', food: 'white bread', status: 'no', notes: 'high GI' },
    ]);
  });

  it('joins commas back into the notes column', () => {
    const csv = [
      'category,food,status,notes',
      'dairy,cheese,yes,hard aged only, buffalo preferred, A2',
    ].join('\n');
    expect(parseFoodCsv(csv)).toEqual([
      {
        category: 'dairy',
        food: 'cheese',
        status: 'yes',
        notes: 'hard aged only, buffalo preferred, A2',
      },
    ]);
  });

  it('lowercases and validates the status column', () => {
    const csv = ['category,food,status,notes', 'protein,eggs,YES,'].join('\n');
    expect(parseFoodCsv(csv)[0].status).toBe('yes');
  });

  it('rejects invalid status values', () => {
    const csv = [
      'category,food,status,notes',
      'protein,eggs,maybe,',
    ].join('\n');
    expect(() => parseFoodCsv(csv)).toThrow(/invalid status/);
  });

  it('rejects unexpected header', () => {
    const csv = ['foo,bar,baz', 'a,b,c'].join('\n');
    expect(() => parseFoodCsv(csv)).toThrow(/Unexpected food CSV header/);
  });

  it('skips blank lines', () => {
    const csv = [
      'category,food,status,notes',
      '',
      'protein,eggs,yes,',
      '',
      '',
      'grain,oats,caution,GF only',
      '',
    ].join('\n');
    expect(parseFoodCsv(csv)).toHaveLength(2);
  });

  it('handles windows line endings', () => {
    const csv = 'category,food,status,notes\r\nprotein,eggs,yes,\r\n';
    expect(parseFoodCsv(csv)).toEqual([
      { category: 'protein', food: 'eggs', status: 'yes', notes: '' },
    ]);
  });
});

describe('parseQuotedCsv', () => {
  it('preserves commas inside double-quoted fields', () => {
    const rows = parseQuotedCsv('a,"b,c",d\n');
    expect(rows).toEqual([['a', 'b,c', 'd']]);
  });

  it('supports embedded double quotes via ""', () => {
    const rows = parseQuotedCsv('a,"she said ""hi""",b\n');
    expect(rows).toEqual([['a', 'she said "hi"', 'b']]);
  });

  it('parses multiple rows', () => {
    const rows = parseQuotedCsv('a,b,c\n1,2,3\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles a trailing row without newline', () => {
    const rows = parseQuotedCsv('a,b\nc,d');
    expect(rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('parseSupplementCsv', () => {
  const header =
    'slug,name,tier,dose,rationale,evidence_grade,food_equivalent,nepal_sourcing,notes,sort_order';

  it('parses a well-formed row', () => {
    const csv = [
      header,
      'vitamin_d3,Vitamin D3,core,2000-5000 IU,"Near-universal deficiency, bone support",B,Oily fish + sun,local,Pair with K2,10',
    ].join('\n');
    expect(parseSupplementCsv(csv)).toEqual([
      {
        slug: 'vitamin_d3',
        name: 'Vitamin D3',
        tier: 'core',
        dose: '2000-5000 IU',
        rationale: 'Near-universal deficiency, bone support',
        evidence_grade: 'B',
        food_equivalent: 'Oily fish + sun',
        nepal_sourcing: 'local',
        notes: 'Pair with K2',
        sort_order: 10,
      },
    ]);
  });

  it('rejects invalid tier', () => {
    const csv = [header, 'x,X,premium,,,,,,,10'].join('\n');
    expect(() => parseSupplementCsv(csv)).toThrow(/invalid tier/);
  });

  it('nulls out empty optional columns', () => {
    const csv = [header, 'slug_a,Name,optional,,,,,,,0'].join('\n');
    expect(parseSupplementCsv(csv)[0]).toMatchObject({
      dose: null,
      rationale: null,
      evidence_grade: null,
      food_equivalent: null,
      nepal_sourcing: null,
      notes: null,
      sort_order: 0,
    });
  });

  it('normalises evidence grade to uppercase and falls back to null', () => {
    const csv = [
      header,
      'a,A,core,,,b,,,,1',
      'b,B,core,,,Z,,,,2',
      'c,C,core,,,,,,,3',
    ].join('\n');
    const rows = parseSupplementCsv(csv);
    expect(rows[0].evidence_grade).toBe('B');
    expect(rows[1].evidence_grade).toBeNull();
    expect(rows[2].evidence_grade).toBeNull();
  });

  it('rejects header mismatch', () => {
    const csv = ['slug,name,tier', 'x,X,core'].join('\n');
    expect(() => parseSupplementCsv(csv)).toThrow(/Unexpected supplement header/);
  });
});

describe('parseLifestyleCsv', () => {
  const header = 'slug,name,category,frequency,description,rationale,sort_order';

  it('parses a well-formed row', () => {
    const csv = [
      header,
      'walking,Walking,movement,daily,30-60 min at conversational pace,"Calf pump, lymphatic return",50',
    ].join('\n');
    expect(parseLifestyleCsv(csv)).toEqual([
      {
        slug: 'walking',
        name: 'Walking',
        category: 'movement',
        frequency: 'daily',
        description: '30-60 min at conversational pace',
        rationale: 'Calf pump, lymphatic return',
        sort_order: 50,
      },
    ]);
  });

  it('rejects invalid category', () => {
    const csv = [header, 'x,X,mental,daily,,,10'].join('\n');
    expect(() => parseLifestyleCsv(csv)).toThrow(/invalid lifestyle category/);
  });

  it('rejects invalid frequency', () => {
    const csv = [header, 'x,X,sleep,monthly,,,10'].join('\n');
    expect(() => parseLifestyleCsv(csv)).toThrow(/invalid lifestyle frequency/);
  });

  it('accepts all documented categories and frequencies', () => {
    const cats = [
      'compression',
      'manual_therapy',
      'movement',
      'stress',
      'sleep',
      'other',
    ];
    const freqs = ['daily', 'weekly', 'as_needed'];
    const rows = cats.map(
      (c, i) => `s${i},N${i},${c},${freqs[i % freqs.length]},,,${i}`,
    );
    const csv = [header, ...rows].join('\n');
    expect(parseLifestyleCsv(csv)).toHaveLength(cats.length);
  });
});
