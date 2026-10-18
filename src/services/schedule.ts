export type NasScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface NasSchedule {
  frequency: NasScheduleFrequency;
  time: string;
  weekday?: number | null;
  day?: number | null;
  month?: number | null;
}

export type ScheduleSummaries = Record<NasScheduleFrequency, string>;

export function weekdayName(locale: string, weekday: number, width: 'long' | 'short' = 'long') {
  return new Intl.DateTimeFormat(locale, { weekday: width }).format(new Date(2024, 0, weekday));
}

export function monthName(locale: string, month: number) {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, month - 1, 1));
}

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

export function scheduleKind(
  schedule: NasSchedule,
  names: Record<NasScheduleFrequency, string>,
): string {
  return `${names[schedule.frequency]} · ${schedule.time}`;
}
