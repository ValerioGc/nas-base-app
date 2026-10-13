import { expect, it } from 'vitest';
import { minuteOf, offAt, offRanges, powerWeekdays } from '../../../services/powerSchedule';
import type { PowerRule } from '../../../types/launcher';

const rule = (day: PowerRule['day'], time: string, action: PowerRule['action']): PowerRule => ({
  day,
  time,
  action,
});

it('reads the minutes of an HH:MM time and refuses anything else', () => {
  expect(minuteOf('00:00')).toBe(0);
  expect(minuteOf('23:59')).toBe(1439);
  expect(minuteOf('24:00')).toBeNull();
  expect(minuteOf('7:00')).toBeNull();
  expect(powerWeekdays.weekends).toEqual([6, 7]);
});

it('finds no off time when the schedule is off, missing or never shuts down', () => {
  const empty = Array.from({ length: 7 }, () => []);
  const nightly = [rule('everyday', '23:00', 'shutdown')];

  expect(offRanges(null)).toEqual(empty);
  expect(offRanges({ enabled: false, rules: nightly })).toEqual(empty);
  expect(offRanges({ enabled: true, rules: [rule('everyday', '04:00', 'restart')] })).toEqual(
    empty,
  );
});

it('keeps the NAS off from each shutdown to the next start, across midnight', () => {
  const days = offRanges({
    enabled: true,
    rules: [rule('everyday', '23:00', 'shutdown'), rule('everyday', '07:00', 'start')],
  });

  for (const day of days) {
    expect(day).toEqual([
      { from: 0, to: 420 },
      { from: 1380, to: 1440 },
    ]);
  }
});

it('carries a weekend shutdown over to the start of the next week', () => {
  const days = offRanges({
    enabled: true,
    rules: [
      rule('friday', '20:00', 'shutdown'),
      rule('monday', '08:00', 'start'),
      rule('wednesday', '12:00', 'restart'),
    ],
  });

  expect(days[0]).toEqual([{ from: 0, to: 480 }]);
  expect(days[1]).toEqual([]);
  expect(days[4]).toEqual([{ from: 1200, to: 1440 }]);
  expect(days[5]).toEqual([{ from: 0, to: 1440 }]);
  expect(days[6]).toEqual([{ from: 0, to: 1440 }]);
});

it('takes a shutdown without any start to last until midnight', () => {
  const days = offRanges({ enabled: true, rules: [rule('weekends', '22:00', 'shutdown')] });

  expect(days.slice(0, 5)).toEqual([[], [], [], [], []]);
  expect(days[5]).toEqual([{ from: 1320, to: 1440 }]);
  expect(days[6]).toEqual([{ from: 1320, to: 1440 }]);
});

it('tells which of the checked weekdays are off at a minute', () => {
  const days = offRanges({
    enabled: true,
    rules: [rule('weekdays', '01:00', 'shutdown'), rule('weekdays', '06:00', 'start')],
  });

  expect(offAt(days, [1, 2, 3, 4, 5, 6, 7], 120)).toEqual([1, 2, 3, 4, 5]);
  expect(offAt(days, [6], 120)).toEqual([]);
  expect(offAt(days, [1], 360)).toEqual([]);
});
