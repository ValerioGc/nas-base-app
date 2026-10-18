import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import NasAppLayout from '../../../components/NasAppLayout.vue';

const categories = [
  { value: 'scheduled', label: 'Scheduled', icon: '/scheduled.svg' },
  { value: 'live', label: 'Live', testid: 'section_live' },
  { value: 'cloud', label: 'Cloud', disabled: true },
];

describe('NAS application layout', () => {
  it('renders configurable categories, accessible icons and the main slot', () => {
    const wrapper = mount(NasAppLayout, {
      props: { modelValue: 'scheduled', categories, navigationLabel: 'Backup types' },
      slots: { default: '<h1>Backup jobs</h1>', 'sidebar-header': '<h2>Backup</h2>' },
    });
    expect(wrapper.get('aside').attributes('aria-label')).toBe('Backup types');
    expect(wrapper.get('main').text()).toBe('Backup jobs');
    expect(wrapper.get('.category_icon').attributes()).toMatchObject({ 'aria-hidden': 'true' });
    expect(wrapper.get('.category_icon').attributes('style')).toContain('/scheduled.svg');
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      'Scheduled',
      'Live',
      'Cloud',
    ]);
    expect(wrapper.findAll('button')[0].attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-testid="section_live"]').text()).toBe('Live');
    expect(wrapper.findAll('button')[0].attributes('data-testid')).toBeUndefined();
    wrapper.unmount();
  });

  it('updates the model when selecting a category and follows external selection', async () => {
    const wrapper = mount(NasAppLayout, {
      props: { modelValue: 'scheduled', categories, navigationLabel: 'Sections' },
      slots: { default: ({ value }) => String(value) },
    });
    await wrapper.findAll('button')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['live']]);
    await wrapper.setProps({ modelValue: 'live' });
    expect(wrapper.findAll('button')[1].attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('main').text()).toBe('live');
    await wrapper.findAll('button')[2].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
    wrapper.unmount();
  });

  it('emits a close request and lets the host disable it during a save', async () => {
    const wrapper = mount(NasAppLayout, {
      props: {
        modelValue: 'scheduled',
        categories,
        navigationLabel: 'Sections',
        closeLabel: 'Close',
      },
    });
    const close = wrapper.findAll('button').find((button) => button.text() === 'Close');
    expect(close).toBeDefined();
    await close?.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    await wrapper.setProps({ closeDisabled: true });
    await close?.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('supports custom icon and header slots with the selected category', () => {
    const wrapper = mount(NasAppLayout, {
      props: { modelValue: 'live', categories, navigationLabel: 'Sections' },
      slots: {
        icon: ({ category }) => `[${category.value}]`,
        header: ({ category }) => `Selected: ${category?.label}`,
      },
    });
    expect(wrapper.findAll('button')[1].text()).toBe('[live] Live');
    expect(wrapper.get('main').text()).toBe('Selected: Live');
    expect(wrapper.find('img').exists()).toBe(false);
    wrapper.unmount();
  });
});
