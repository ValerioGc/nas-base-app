import type { PowerDay, PowerSchedule } from '../types/launcher';

/** A stretch of a day, in minutes from midnight: `from` included, `to` excluded. */
export type MinuteRange = { from: number; to: number };

const DAY = 1440;
const WEEK = 7 * DAY;

/** The minutes from midnight of an `HH:MM` time, null when it is not one. */
export function minuteOf(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** The weekdays each power rule applies to: 1 is Monday, 7 Sunday. */
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

/** A shutdown or a start of the week, in minutes from Monday at midnight. */
type PowerEvent = { at: number; on: boolean };

/** The shutdowns and the starts of the week in order, a shutdown before a start at the same time. */
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

/**
 * The stretches of the week the NAS is off, from a shutdown to the next start. The week is a loop:
 * before its first event the NAS is as its last event left it.
 */
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

/** Each stretch of the week cut at midnight, into the day it falls on. */
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

/**
 * When the NAS is off on each weekday (index 0 is Monday): from a shutdown to the next start of
 * the week. Without any start rule the NAS waits to be switched on by hand, so a shutdown is
 * taken to last until midnight. A restart does not leave it off.
 */
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

/** The weekdays among `weekdays` (1 Monday to 7 Sunday) on which the NAS is off at `minute`. */
export function offAt(days: MinuteRange[][], weekdays: number[], minute: number): number[] {
  return weekdays.filter((weekday) =>
    (days[weekday - 1] ?? []).some((range) => range.from <= minute && minute < range.to),
  );
}
