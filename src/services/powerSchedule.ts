import type { PowerDay, PowerSchedule } from '../types/launcher';

export type MinuteRange = { from: number; to: number };

const DAY = 1440;
const WEEK = 7 * DAY;

export function minuteOf(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export const powerWeekdays: Record<PowerDay, number[]> = {
  everyday: [1, 2, 3, 4, 5, 6, 7],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [6, 7],
  monday: [1],
  tuesday: [2],
  wednesday: [3],
  thursday: [4],
  friday: [5],
  saturday: [6],
  sunday: [7],
};

type PowerEvent = { at: number; on: boolean };

function weekEvents(schedule: PowerSchedule): PowerEvent[] {
  return schedule.rules
    .filter((rule) => rule.action !== 'restart')
    .flatMap((rule) =>
      powerWeekdays[rule.day].map((weekday) => ({
        at: (weekday - 1) * DAY + (minuteOf(rule.time) ?? 0),
        on: rule.action === 'start',
      })),
    )
    .sort((first, second) => first.at - second.at || Number(first.on) - Number(second.on));
}

function offStretches(events: PowerEvent[]): MinuteRange[] {
  const stretches: MinuteRange[] = [];
  let off = !events.at(-1)?.on;
  let since = 0;
  for (const event of events) {
    if (off && event.on) {
      stretches.push({ from: since, to: event.at });
    } else if (!off && !event.on) {
      since = event.at;
    }
    off = !event.on;
  }
  if (off) {
    stretches.push({ from: since, to: WEEK });
  }
  return stretches;
}

function byDay(stretches: MinuteRange[]): MinuteRange[][] {
  const days: MinuteRange[][] = Array.from({ length: 7 }, () => []);
  for (const stretch of stretches) {
    for (
      let start = stretch.from;
      start < stretch.to;
      start = (Math.floor(start / DAY) + 1) * DAY
    ) {
      const day = Math.floor(start / DAY);
      const end = Math.min(stretch.to, (day + 1) * DAY);
      days[day]!.push({ from: start - day * DAY, to: end - day * DAY });
    }
  }

  return days;
}

export function offRanges(schedule: PowerSchedule | null): MinuteRange[][] {
  const events = schedule?.enabled ? weekEvents(schedule) : [];
  if (!events.some((event) => !event.on)) {
    return byDay([]);
  }
  if (events.some((event) => event.on)) {
    return byDay(offStretches(events));
  }
  return byDay(
    events.map((event) => ({ from: event.at, to: (Math.floor(event.at / DAY) + 1) * DAY })),
  );
}

export function offAt(days: MinuteRange[][], weekdays: number[], minute: number): number[] {
  return weekdays.filter((weekday) =>
    (days[weekday - 1] ?? []).some((range) => range.from <= minute && minute < range.to),
  );
}
