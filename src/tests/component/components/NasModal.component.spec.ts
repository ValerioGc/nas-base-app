import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NasModal from '../../../components/NasModal.vue';

const prototype = HTMLDialogElement.prototype;
const originalShow = Object.getOwnPropertyDescriptor(prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(prototype, 'close');
const show = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.open = false;
});

beforeEach(() => {
  show.mockClear();
  close.mockClear();
  Object.defineProperty(prototype, 'showModal', { configurable: true, value: show });
  Object.defineProperty(prototype, 'close', { configurable: true, value: close });
});
afterEach(() => {
  for (const [key, descriptor] of [
    ['showModal', originalShow],
    ['close', originalClose],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(prototype, key, descriptor);
    } else {
      Reflect.deleteProperty(prototype, key);
    }
  }
});

describe('NAS native modal', () => {
  it('opens a labelled native dialog, renders caller content and closes on unmount', () => {
    const wrapper = mount(NasModal, {
      props: { label: 'Details' },
      slots: { default: '<section><h2>Disk</h2><button>Close</button></section>' },
    });
    expect(wrapper.attributes('aria-label')).toBe('Details');
    expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true);
    expect(wrapper.get('h2').text()).toBe('Disk');
    expect(show).toHaveBeenCalledOnce();
    wrapper.unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it('requests closure for Escape and backdrop clicks, preserving clicks within content', async () => {
    const wrapper = mount(NasModal, {
      props: { label: 'Details' },
      slots: { default: '<section><button>Action</button></section>' },
    });
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('close')).toBeUndefined();
    await wrapper.trigger('click');
    await wrapper.trigger('cancel');
    expect(wrapper.emitted('close')).toHaveLength(2);
    wrapper.unmount();
  });

  it('prevents native dismissal while the application is busy', async () => {
    const wrapper = mount(NasModal, { props: { label: 'Saving', dismissible: false } });
    const cancel = new Event('cancel', { cancelable: true });
    wrapper.element.dispatchEvent(cancel);
    await wrapper.trigger('click');
    expect(cancel.defaultPrevented).toBe(true);
    expect(wrapper.emitted('close')).toBeUndefined();
    await wrapper.setProps({ dismissible: true });
    await wrapper.trigger('cancel');
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });
});
