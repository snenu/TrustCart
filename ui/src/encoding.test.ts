import { describe, expect, it } from 'vitest';
import { dateToEpoch, encodeCategory, encodeText, formatEpochDate, hexToBytes, warrantyExpiry } from '../../api/src/encoding';

describe('TrustCart encoding helpers', () => {
  it('round-trips bounded hex and date values', () => {
    const value = 'ab'.repeat(32);
    expect(Array.from(hexToBytes(value))).toHaveLength(32);
    expect(formatEpochDate(dateToEpoch('2026-09-16'))).toBe('2026-09-16');
  });

  it('pads protocol text to the contract field width', () => {
    expect(encodeText('TrustCart')).toHaveLength(32);
    expect(encodeCategory('Audio')).toHaveLength(16);
  });

  it('calculates the same month window used by Compact', () => {
    expect(warrantyExpiry(1_789_000_000n, 24n)).toBe(1_789_000_000n + 24n * 2_592_000n);
  });

  it('rejects malformed values before they reach a transaction', () => {
    expect(() => hexToBytes('not-hex')).toThrow();
    expect(() => dateToEpoch('2026-02-31')).toThrow();
    expect(() => encodeText('x'.repeat(33))).toThrow();
  });
});
