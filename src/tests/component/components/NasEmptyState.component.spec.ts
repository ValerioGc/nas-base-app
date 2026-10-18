import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import NasEmptyState from '../../../components/NasEmptyState.vue';
import icon from '../../helpers/assets/refresh.svg';

describe('NAS empty state', () => {
  it('renders translated content and an optional decorative imported SVG', async () => {
    const wrapper = mount(NasEmptyState, { props: { title: 'No items' } });
    expect(wrapper.get('h2').text()).toBe('No items');
    expect(wrapper.find('p').exists()).toBe(false);
    expect(wrapper.find('[aria-hidden]').exists()).toBe(false);
    await wrapper.setProps({
      title: 'Nessun elemento',
      description: 'Aggiungi un elemento',
      svg: icon,
    });
    expect(wrapper.get('h2').text()).toBe('Nessun elemento');
    expect(wrapper.get('p').text()).toBe('Aggiungi un elemento');
    expect(wrapper.get('[aria-hidden="true"]').attributes('style')).toContain(icon);
    wrapper.unmount();
  });

  it('accepts a custom icon and caller actions without imposing data or event behavior', async () => {
    const retry = vi.fn();
    const wrapper = mount(NasEmptyState, {
      props: { title: 'No results', svg: icon },
      slots: {
        icon: '<span aria-hidden="true">Custom icon</span>',
        actions: () => h('button', { onClick: retry }, 'Retry'),
      },
    });
    expect(wrapper.get('[aria-hidden="true"]').text()).toBe('Custom icon');
    expect(wrapper.find('[style]').exists()).toBe(false);
    await wrapper.get('button').trigger('click');
    expect(retry).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
});
