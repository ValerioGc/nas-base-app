import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import NasNumberStepper from '../../../components/NasNumberStepper.vue';

const props = {
  id: 'interval',
  label: 'Interval',
  min: 1,
  max: 3,
  increaseLabel: 'Increase',
  decreaseLabel: 'Decrease',
};

describe('NAS number stepper', () => {
  it('updates the numeric model and disables actions at the bounds', async () => {
    const wrapper = mount(NasNumberStepper, {
      props: {
        ...props,
        modelValue: 2,
        'onUpdate:modelValue': (value: number) => wrapper.setProps({ modelValue: value }),
      },
    });
    const input = wrapper.get<HTMLInputElement>('input');
    expect(input.attributes('id')).toBe('interval');
    expect(input.attributes('aria-label')).toBe('Interval');
    await wrapper.get('[aria-label="Increase"]').trigger('click');
    expect(input.element.value).toBe('3');
    expect(wrapper.get('[aria-label="Increase"]').attributes('disabled')).toBeDefined();
    await input.setValue('1');
    expect(wrapper.props('modelValue')).toBe(1);
    expect(wrapper.get('[aria-label="Decrease"]').attributes('disabled')).toBeDefined();
    await wrapper.get('[aria-label="Increase"]').trigger('click');
    await wrapper.get('[aria-label="Decrease"]').trigger('click');
    expect(wrapper.props('modelValue')).toBe(1);
    wrapper.unmount();
  });

  it('rejects empty, fractional and out-of-range input without changing the model', async () => {
    const wrapper = mount(NasNumberStepper, { props: { ...props, modelValue: 2 } });
    const input = wrapper.get<HTMLInputElement>('input');
    for (const value of ['', '1.5', '0', '4']) {
      await input.setValue(value);
      expect(wrapper.emitted('update:modelValue')).toBeUndefined();
      expect(input.element.value).toBe('2');
    }
    wrapper.unmount();
  });

  it('blocks changes while disabled and takes all button text from props', async () => {
    const wrapper = mount(NasNumberStepper, { props: { ...props, modelValue: 2, disabled: true } });
    expect(wrapper.get('input').element.disabled).toBe(true);
    await wrapper.get('[aria-label="Increase"]').trigger('click');
    await wrapper.get('input').setValue('3');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await wrapper.setProps({ increaseLabel: 'Aumenta', decreaseLabel: 'Diminuisci' });
    expect(wrapper.get('[aria-label="Aumenta"]').attributes('title')).toBe('Aumenta');
    expect(wrapper.get('[aria-label="Diminuisci"]').attributes('title')).toBe('Diminuisci');
    wrapper.unmount();
  });
});
