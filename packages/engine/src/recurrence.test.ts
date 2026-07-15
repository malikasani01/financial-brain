import { describe, expect, it } from 'vitest';
import { expandOccurrences } from './recurrence.js';

const START = '2026-07-15';

describe('expandOccurrences', () => {
  it('ONE_TIME: emits the anchor only if inside the window', () => {
    expect(expandOccurrences('2026-07-20', 'ONE_TIME', START, 90)).toEqual(['2026-07-20']);
    expect(expandOccurrences('2026-07-01', 'ONE_TIME', START, 90)).toEqual([]); // before window
    expect(expandOccurrences('2027-01-01', 'ONE_TIME', START, 90)).toEqual([]); // after window
  });

  it('CUSTOM: treated as a single occurrence at the anchor', () => {
    expect(expandOccurrences('2026-07-20', 'CUSTOM', START, 90)).toEqual(['2026-07-20']);
  });

  it('WEEKLY: fast-forwards a past anchor and steps by 7', () => {
    const out = expandOccurrences('2026-07-01', 'WEEKLY', START, 22);
    expect(out).toEqual(['2026-07-15', '2026-07-22', '2026-07-29', '2026-08-05']);
  });

  it('BIWEEKLY: steps by 14', () => {
    const out = expandOccurrences('2026-07-15', 'BIWEEKLY', START, 30);
    expect(out).toEqual(['2026-07-15', '2026-07-29', '2026-08-12']);
  });

  it('MONTHLY: preserves end-of-month day with clamping', () => {
    const out = expandOccurrences('2026-01-31', 'MONTHLY', '2026-01-01', 90);
    expect(out).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('QUARTERLY and ANNUAL step by 3 and 12 months', () => {
    expect(expandOccurrences('2026-01-15', 'QUARTERLY', '2026-01-01', 200)).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
    ]);
    expect(expandOccurrences('2026-03-01', 'ANNUAL', '2026-01-01', 430)).toEqual([
      '2026-03-01',
      '2027-03-01',
    ]);
  });

  it('MONTHLY: fast-forwards when the anchor precedes the window', () => {
    const out = expandOccurrences('2026-01-15', 'MONTHLY', '2026-03-01', 92);
    expect(out).toEqual(['2026-03-15', '2026-04-15', '2026-05-15']);
  });

  it('SEMIMONTHLY: twice per month', () => {
    const out = expandOccurrences('2026-07-01', 'SEMIMONTHLY', '2026-07-01', 62);
    expect(out).toContain('2026-07-01');
    expect(out).toContain('2026-07-16');
    expect(out).toContain('2026-08-01');
    // ascending & de-duplicated
    expect([...out].sort()).toEqual(out);
  });
});
