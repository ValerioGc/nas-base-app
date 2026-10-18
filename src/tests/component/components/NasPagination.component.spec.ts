import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import NasPagination from '../../../components/NasPagination.vue';

const props = {
  totalPages: 5,
  label: 'Results pages',
  previousLabel: 'Previous',
  nextLabel: 'Next',
  pageLabel: (page: number) => `Page ${page}`,
};

describe('NAS pagination', () => {
  it('selects pages through the model and respects the first and last bounds', async () => {
    const wrapper = mount(NasPagination, {
      props: {
        ...props,
        modelValue: 1,
        'onUpdate:modelValue': (value: number) => wrapper.setProps({ modelValue: value }),
      },
    });
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Results pages');
    expect(wrapper.get('button').element.disabled).toBe(true);
    await wrapper.get('[aria-label="Page 1"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await wrapper.findAll('button').at(-1)?.trigger('click');
    expect(wrapper.get('[aria-current="page"]').text()).toBe('2');
    await wrapper.get('button').trigger('click');
    expect(wrapper.props('modelValue')).toBe(1);
    await wrapper.get('[aria-label="Page 5"]').trigger('click');
    expect(wrapper.props('modelValue')).toBe(5);
    expect(wrapper.findAll('button').at(-1)?.element.disabled).toBe(true);
    expect(wrapper.emitted('update:modelValue')).toEqual([[2], [1], [5]]);
    wrapper.unmount();
  });

  it('keeps large page counts compact with endpoints and non-interactive gaps', async () => {
    const wrapper = mount(NasPagination, {
      props: { ...props, totalPages: 10000, modelValue: 500 },
    });
    expect(wrapper.findAll('ul button').map((button) => button.text())).toEqual([
      '1',
      '499',
      '500',
      '501',
      '10000',
    ]);
    expect(wrapper.findAll('ul span').map((gap) => gap.attributes('aria-hidden'))).toEqual([
      'true',
      'true',
    ]);
    await wrapper.setProps({ modelValue: 1 });
    expect(wrapper.findAll('ul button').map((button) => button.text())).toEqual([
      '1',
      '2',
      '3',
      '4',
      '10000',
    ]);
    await wrapper.setProps({ modelValue: 10000 });
    expect(wrapper.findAll('ul button').map((button) => button.text())).toEqual([
      '1',
      '9997',
      '9998',
      '9999',
      '10000',
    ]);
    wrapper.unmount();
  });

  it('updates translated labels and blocks every control while disabled', async () => {
    const wrapper = mount(NasPagination, { props: { ...props, modelValue: 2, disabled: true } });
    for (const button of wrapper.findAll('button')) {
      expect(button.element.disabled).toBe(true);
      await button.trigger('click');
    }
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await wrapper.setProps({
      label: 'Pagine dei risultati',
      previousLabel: 'Precedente',
      nextLabel: 'Successiva',
      pageLabel: (page: number) => `Pagina ${page}`,
    });
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Pagine dei risultati');
    expect(wrapper.get('button').text()).toBe('Precedente');
    expect(wrapper.findAll('button').at(-1)?.text()).toBe('Successiva');
    expect(wrapper.get('[aria-label="Pagina 2"]').attributes('aria-current')).toBe('page');
    wrapper.unmount();
  });

  it('handles empty results and a single page without emitting changes', async () => {
    const wrapper = mount(NasPagination, { props: { ...props, totalPages: 0, modelValue: 1 } });
    expect(wrapper.findAll('ul button')).toHaveLength(0);
    for (const button of wrapper.findAll('button')) {
      expect(button.element.disabled).toBe(true);
    }
    await wrapper.setProps({ totalPages: 1 });
    expect(wrapper.get('[aria-current="page"]').text()).toBe('1');
    await wrapper.get('[aria-label="Page 1"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });

  it('clamps the displayed page when totals shrink without changing the consumer model', async () => {
    const wrapper = mount(NasPagination, { props: { ...props, totalPages: 10, modelValue: 8 } });
    await wrapper.setProps({ totalPages: 3 });
    expect(wrapper.get('[aria-current="page"]').text()).toBe('3');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[2]]);
    await wrapper.setProps({ modelValue: 0 });
    expect(wrapper.get('[aria-current="page"]').text()).toBe('1');
    await wrapper.setProps({ modelValue: Number.NaN });
    expect(wrapper.get('[aria-current="page"]').text()).toBe('1');
    await wrapper.setProps({ totalPages: Number.POSITIVE_INFINITY });
    expect(wrapper.findAll('ul button')).toHaveLength(0);
    wrapper.unmount();
  });
});
