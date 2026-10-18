import { computed, ref, type Ref } from 'vue';
import type { NasLocale } from '../types/launcher';

export function createNasI18n<Messages extends Record<NasLocale, object>>(
  messages: Messages,
  initial: NasLocale = 'it',
) {
  const locale: Ref<NasLocale> = ref(initial);

  function setLocale(value: NasLocale) {
    locale.value = value;
    document.documentElement.lang = value;
  }

  function useI18n() {
    const t = computed((): Messages[NasLocale] => messages[locale.value]);
    return { locale, t, setLocale };
  }

  return { locale, setLocale, useI18n };
}
