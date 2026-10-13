import type {
  AppContext,
  DescribedNotification,
  NetworkDisk,
  PickedFile,
  PowerSchedule,
} from '../types/launcher';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isContext(value: unknown): value is AppContext {
  return (
    isRecord(value) &&
    typeof value.app === 'string' &&
    (value.theme === 'light' || value.theme === 'dark') &&
    typeof value.accent === 'string' &&
    typeof value.locale === 'string' &&
    (value.nasName === undefined || typeof value.nasName === 'string') &&
    (value.palette === undefined ||
      (isRecord(value.palette) &&
        Object.values(value.palette).every((color) => typeof color === 'string')))
  );
}

export function isNotification(value: unknown): value is DescribedNotification {
  return (
    isRecord(value) &&
    ['id', 'title', 'message', 'source'].every((key) => typeof value[key] === 'string')
  );
}

export function isPickedFile(value: unknown): value is PickedFile {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.path === 'string' &&
    (value.url === undefined || typeof value.url === 'string')
  );
}

export function isNetworkDisk(value: unknown): value is NetworkDisk {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.mount === 'string' &&
    value.mount.startsWith('/') &&
    (value.source === null || typeof value.source === 'string') &&
    typeof value.readOnly === 'boolean'
  );
}

const powerDays = new Set([
  'everyday',
  'weekdays',
  'weekends',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export function isPowerSchedule(value: unknown): value is PowerSchedule {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    Array.isArray(value.rules) &&
    value.rules.every(
      (rule: unknown) =>
        isRecord(rule) &&
        typeof rule.day === 'string' &&
        powerDays.has(rule.day) &&
        typeof rule.time === 'string' &&
        /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.time) &&
        (rule.action === 'start' || rule.action === 'shutdown' || rule.action === 'restart'),
    )
  );
}
