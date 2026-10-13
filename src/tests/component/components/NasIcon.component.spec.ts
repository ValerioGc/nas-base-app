import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import NasIcon from '../../../components/NasIcon.vue';
import refreshIcon from '../../helpers/assets/refresh.svg';

describe('NAS icon', () => {
  it('renders an SVG imported by its consumer as a decorative currentColor mask', () => {
    const wrapper = mount(NasIcon, {
      props: { svg: refreshIcon },
      attrs: { class: 'refresh_icon' },
    });
    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.classes()).toContain('refresh_icon');
    expect(wrapper.attributes('style')).toContain(JSON.stringify(refreshIcon));
    expect(wrapper.find('img').exists()).toBe(false);
    wrapper.unmount();
  });

  it('updates the mask when the consumer changes its SVG', async () => {
    const wrapper = mount(NasIcon, { props: { svg: refreshIcon } });
    await wrapper.setProps({ svg: '/icons/next.svg' });
    expect(wrapper.attributes('style')).toContain('url("/icons/next.svg")');
    expect(wrapper.attributes('style')).not.toContain(refreshIcon);
    wrapper.unmount();
  });
});
