/** How often a scheduled rule runs. */
export type NasScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * When a rule runs, at an `HH:MM` time of the NAS: `weekday` (1 Monday to 7 Sunday) belongs to a
 * weekly rule, `day` to a monthly or yearly one, `month` (1 to 12) to a yearly one.
 */
export interface NasSchedule {
  frequency: NasScheduleFrequency;
  time: string;
  weekday?: number | null;
  day?: number | null;
  month?: number | null;
}

/** The schedule texts of a catalog: placeholders `{time}`, `{weekday}`, `{day}`, `{month}`. */
export type ScheduleSummaries = Record<NasScheduleFrequency, string>;

// January 1st 2024 was a Monday: the names come from the locale, not from the catalog.
export function weekdayName(locale: string, weekday: number, width: 'long' | 'short' = 'long') {
  return new Intl.DateTimeFormat(locale, { weekday: width }).format(new Date(2024, 0, weekday));
}

export function monthName(locale: string, month: number) {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, month - 1, 1));
}

/** When a rule runs, in words: `Ogni lunedì alle 03:00`. */
export function describeSchedule(
  schedule: NasSchedule,
  locale: string,
  summaries: ScheduleSummaries,
): string {
  return summaries[schedule.frequency]
    .replace('{time}', schedule.time)
    .replace('{weekday}', schedule.weekday ? weekdayName(locale, schedule.weekday) : '')
    .replace('{day}', String(schedule.day ?? ''))
    .replace('{month}', schedule.month ? monthName(locale, schedule.month) : '');
}

/** The kind of a schedule and its time, for the list: `Settimanale · 03:00`. */
export function scheduleKind(
  schedule: NasSchedule,
  names: Record<NasScheduleFrequency, string>,
): string {
  return `${names[schedule.frequency]} · ${schedule.time}`;
}
