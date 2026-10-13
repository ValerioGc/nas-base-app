import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppSwitch from '../../../components/NasSwitch.vue';

describe('AppSwitch', () => {
  it('is a switch with its label, and hands back the value it is set to', async () => {
    const wrapper = mount(AppSwitch, {
      props: {
        modelValue: false,
        label: 'Notifica accessi falliti',
        testid: 'probe',
        'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }),
      },
    });
    const input = wrapper.get<HTMLInputElement>('[data-testid="probe"]');

    expect(input.attributes('role')).toBe('switch');
    expect(input.attributes('aria-checked')).toBe('false');
    expect(wrapper.text()).toBe('Notifica accessi falliti');
    expect(wrapper.attributes('data-testid')).toBe('probe_switch');
    await input.setValue(true);
    expect(wrapper.props('modelValue')).toBe(true);
    expect(input.attributes('aria-checked')).toBe('true');
  });

  it('can be locked', () => {
    const wrapper = mount(AppSwitch, {
      props: { modelValue: true, label: 'Blocco', disabled: true },
    });

    expect(wrapper.get('input').element.disabled).toBe(true);
    expect(wrapper.classes()).toContain('app_switch_disabled');
  });

  it('gives each field of a page an id of its own, for the browser to tell them apart', () => {
    const page = mount({
      components: { AppSwitch },
      template: `<AppSwitch :model-value="true" label="Uno" /><AppSwitch :model-value="false" label="Due" />`,
    });
    const [first, second] = page.findAll('input').map((input) => input.attributes('id'));

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });
});
