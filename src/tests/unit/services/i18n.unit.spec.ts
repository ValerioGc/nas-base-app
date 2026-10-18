import { afterEach, expect, it } from 'vitest';
import { createNasI18n } from '../../../services/i18n';

const messages = { it: { hello: 'Ciao' }, en: { hello: 'Hello' } } as const;

afterEach(() => document.documentElement.removeAttribute('lang'));

it('starts in Italian and follows the language it is given, on the page too', () => {
  const { locale, setLocale, useI18n } = createNasI18n(messages);
  const { t } = useI18n();

  expect(locale.value).toBe('it');
  expect(t.value.hello).toBe('Ciao');
  setLocale('en');
  expect(t.value.hello).toBe('Hello');
  expect(document.documentElement.lang).toBe('en');
});

it('keeps the language of each application apart', () => {
  const first = createNasI18n(messages, 'en');
  const second = createNasI18n(messages);

  first.setLocale('it');
  expect(second.locale.value).toBe('it');
  second.setLocale('en');
  expect(first.locale.value).toBe('it');
});
