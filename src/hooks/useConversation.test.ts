import { describe, expect, it } from 'vitest';
import { parseExpiration } from './expiration';

describe('parseExpiration', () => {
  it('treats Convai timezone-less ISO timestamps as UTC', () => {
    expect(parseExpiration('2026-08-25T11:49:02.658434')).toBe(
      Date.parse('2026-08-25T11:49:02.658434Z'),
    );
  });

  it('preserves explicit timezone offsets', () => {
    expect(parseExpiration('2026-08-25T11:49:02.658434+05:30')).toBe(
      Date.parse('2026-08-25T11:49:02.658434+05:30'),
    );
  });

  it('supports Unix seconds and milliseconds', () => {
    expect(parseExpiration('1787658542')).toBe(1787658542000);
    expect(parseExpiration('1787658542658')).toBe(1787658542658);
  });

  it('returns null for invalid values', () => {
    expect(parseExpiration('not-a-timestamp')).toBeNull();
  });
});
