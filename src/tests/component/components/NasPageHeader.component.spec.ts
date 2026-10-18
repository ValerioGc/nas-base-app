import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import NasPageHeader from '../../../components/NasPageHeader.vue';

describe('NAS page header', () => {
  it('renders translated page text and caller-defined actions', async () => {
    const wrapper = mount(NasPageHeader, {
      props: { title: 'Dischi locali', overview: 'Panoramica', subtitle: 'Inventario' },
      slots: { actions: '<button type="button">Aggiorna</button>' },
    });
    expect(wrapper.get('h1').text()).toBe('Dischi locali');
    expect(wrapper.findAll('p').map((paragraph) => paragraph.text())).toEqual([
      'Panoramica',
      'Inventario',
    ]);
    expect(wrapper.get('button').text()).toBe('Aggiorna');
    await wrapper.setProps({ title: 'Local disks', overview: 'Overview', subtitle: 'Inventory' });
    expect(wrapper.get('h1').text()).toBe('Local disks');
    wrapper.unmount();
  });

  it('omits optional text and the action wrapper when they are not supplied', () => {
    const wrapper = mount(NasPageHeader, { props: { title: 'Logs' } });
    expect(wrapper.findAll('p')).toHaveLength(0);
    expect(wrapper.find('.header_actions').exists()).toBe(false);
    wrapper.unmount();
  });
});
