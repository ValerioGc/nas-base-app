import { expect, it } from 'vitest';
import { formatBytes, share } from '../../../services/format';

it('formats byte sizes and percentages with the selected locale', () => {
  expect(formatBytes(1, 'en')).toBe('1 B');
  expect(formatBytes(1536, 'en')).toBe('1.5 KB');
  expect(formatBytes(1536, 'it')).toBe('1,5 KB');
  expect(formatBytes(5 * 1024 ** 5, 'en')).toBe('5,120.0 TB');
  expect(share(1, 2)).toBe(50);
  expect(share(3, 2)).toBe(100);
  expect(share(1, 0)).toBe(0);
});
