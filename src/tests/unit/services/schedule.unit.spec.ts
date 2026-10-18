import { expect, it } from 'vitest';
import {
  describeSchedule,
  monthName,
  scheduleKind,
  weekdayName,
  type NasSchedule,
} from '../../../services/schedule';

const summaries = {
  daily: 'Ogni giorno alle {time}',
  weekly: 'Ogni {weekday} alle {time}',
  monthly: 'Ogni mese il giorno {day} alle {time}',
  yearly: 'Ogni anno il {day} {month} alle {time}',
};

const at = (schedule: Partial<NasSchedule>): NasSchedule => ({
  frequency: 'daily',
  time: '03:00',
  ...schedule,
});

it('says in words when a rule runs', () => {
  expect(describeSchedule(at({}), 'it', summaries)).toBe('Ogni giorno alle 03:00');
  expect(describeSchedule(at({ frequency: 'weekly', weekday: 1 }), 'it', summaries)).toBe(
    'Ogni lunedì alle 03:00',
  );
  expect(describeSchedule(at({ frequency: 'monthly', day: 15 }), 'it', summaries)).toBe(
    'Ogni mese il giorno 15 alle 03:00',
  );
  expect(describeSchedule(at({ frequency: 'yearly', day: 24, month: 12 }), 'it', summaries)).toBe(
    'Ogni anno il 24 dicembre alle 03:00',
  );
  expect(describeSchedule(at({ frequency: 'weekly', weekday: null }), 'it', summaries)).toBe(
    'Ogni  alle 03:00',
  );
});

it('names weekdays and months in the language of the page', () => {
  expect(weekdayName('en', 7)).toBe('Sunday');
  expect(weekdayName('it', 3, 'short')).toBe('mer');
  expect(monthName('it', 1)).toBe('gennaio');
});

it('gives the kind of a schedule and its time for the list', () => {
  const names = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
  expect(scheduleKind(at({ frequency: 'weekly', weekday: 1 }), names)).toBe('Weekly · 03:00');
});
