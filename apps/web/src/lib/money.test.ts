import { describe, expect, it } from 'vitest';
import {
  centsToDollars,
  centsToWholeDollars,
  dollarsToCents,
  dollarsToCentsOrNull,
  textOrNull,
} from './money';

describe('dollarsToCents', () => {
  it('parses plain and formatted dollar strings to integer cents', () => {
    expect(dollarsToCents('40')).toBe(4000);
    expect(dollarsToCents('9.99')).toBe(999);
    expect(dollarsToCents('$1,234.56')).toBe(123456);
    expect(dollarsToCents('  $2,847  ')).toBe(284700);
    expect(dollarsToCents('1.5')).toBe(150);
  });
  it('handles empty / partial / null as zero', () => {
    expect(dollarsToCents('')).toBe(0);
    expect(dollarsToCents('$')).toBe(0);
    expect(dollarsToCents('.')).toBe(0);
    expect(dollarsToCents('-')).toBe(0);
    expect(dollarsToCents(null)).toBe(0);
  });
  it('supports negatives and always returns an integer', () => {
    expect(dollarsToCents('-12.34')).toBe(-1234);
    expect(Number.isInteger(dollarsToCents('19.999'))).toBe(true); // rounds
    expect(dollarsToCents('19.999')).toBe(2000);
  });
});

describe('dollarsToCentsOrNull', () => {
  it('keeps empty input as null (optional amounts)', () => {
    expect(dollarsToCentsOrNull('')).toBeNull();
    expect(dollarsToCentsOrNull('   ')).toBeNull();
    expect(dollarsToCentsOrNull(null)).toBeNull();
    expect(dollarsToCentsOrNull('50')).toBe(5000);
    expect(dollarsToCentsOrNull('0')).toBe(0);
  });
});

describe('textOrNull', () => {
  it('trims and nulls empty strings', () => {
    expect(textOrNull('  hi ')).toBe('hi');
    expect(textOrNull('')).toBeNull();
    expect(textOrNull('   ')).toBeNull();
    expect(textOrNull(null)).toBeNull();
  });
});

describe('formatters', () => {
  it('centsToDollars shows two decimals with sign', () => {
    expect(centsToDollars(4000)).toBe('$40.00');
    expect(centsToDollars(123456)).toBe('$1,234.56');
    expect(centsToDollars(-500)).toBe('-$5.00');
    expect(centsToDollars(0)).toBe('$0.00');
  });
  it('centsToWholeDollars rounds to whole dollars', () => {
    expect(centsToWholeDollars(36358)).toBe('$364');
    expect(centsToWholeDollars(195800)).toBe('$1,958');
    expect(centsToWholeDollars(-4040)).toBe('-$40');
  });
});
