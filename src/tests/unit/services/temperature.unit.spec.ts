import { expect, it } from 'vitest';
import { temperatureTone } from '../../../services/temperature';

it('judges a disk by limits much lower than those of a processor', () => {
  expect(temperatureTone(50, 'chip')).toBe('normal');
  expect(temperatureTone(50, 'disk')).toBe('warning');
  expect(temperatureTone(55, 'disk')).toBe('danger');
  expect(temperatureTone(44.9, 'disk')).toBe('normal');
});

it('gives an NVMe drive more room than a SATA disk', () => {
  expect(temperatureTone(50, 'nvme')).toBe('normal');
  expect(temperatureTone(60, 'nvme')).toBe('warning');
  expect(temperatureTone(70, 'nvme')).toBe('danger');
});

it('keeps the limits of processors and graphics cards', () => {
  expect(temperatureTone(69, 'chip')).toBe('normal');
  expect(temperatureTone(70, 'chip')).toBe('warning');
  expect(temperatureTone(85, 'chip')).toBe('danger');
});
