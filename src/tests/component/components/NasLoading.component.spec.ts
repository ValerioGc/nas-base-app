import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import NasLoading from '../../../components/NasLoading.vue';

it('announces what is loading and hides the spinner from screen readers', () => {
  const wrapper = mount(NasLoading, { props: { label: 'Caricamento dei dischi' } });

  expect(wrapper.get('output').attributes('aria-live')).toBe('polite');
  expect(wrapper.text()).toBe('Caricamento dei dischi');
  expect(wrapper.get('.loading_spinner').attributes('aria-hidden')).toBe('true');
});
