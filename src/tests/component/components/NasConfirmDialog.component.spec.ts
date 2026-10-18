import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import NasConfirmDialog from '../../../components/NasConfirmDialog.vue';
import NasPageHeader from '../../../components/NasPageHeader.vue';

const props = {
  title: 'Remove item',
  message: 'Continue?',
  cancelLabel: 'Cancel',
  confirmLabel: 'Remove',
};

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

describe('NAS confirmation dialog', () => {
  it('opens a native dialog labelled by its title and message with initial cancel focus', () => {
    const wrapper = mount(NasConfirmDialog, { props });
    expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true);
    expect(wrapper.attributes('aria-labelledby')).toBe(wrapper.get('h2').attributes('id'));
    expect(wrapper.attributes('aria-describedby')).toBe(wrapper.get('p').attributes('id'));
    expect(wrapper.get('h2').text()).toBe('Remove item');
    expect(wrapper.get('p').text()).toBe('Continue?');
    expect(wrapper.get('button').attributes('autofocus')).toBeDefined();
    expect(show).toHaveBeenCalledOnce();
    wrapper.unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it('names both buttons for tests and shows what the caller adds below the actions', () => {
    const wrapper = mount(NasConfirmDialog, {
      props: { ...props, cancelTestid: 'probe_cancel', confirmTestid: 'probe_confirm' },
      slots: { default: () => h('p', { role: 'alert' }, 'Refused') },
    });
    expect(wrapper.get('[data-testid="probe_cancel"]').text()).toBe('Cancel');
    expect(wrapper.get('[data-testid="probe_confirm"]').text()).toBe('Remove');
    expect(wrapper.get('footer + [role="alert"]').text()).toBe('Refused');
    wrapper.unmount();
  });

  it('emits requests while the caller controls dismissal and updates translations', async () => {
    const wrapper = mount(NasConfirmDialog, { props });
    await wrapper.get('button').trigger('click');
    await wrapper.findAll('button')[1]?.trigger('click');
    const cancel = new Event('cancel', { cancelable: true });
    wrapper.element.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(wrapper.emitted('cancel')).toHaveLength(2);
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true);
    await wrapper.setProps({
      title: 'Rimuovi elemento',
      cancelLabel: 'Annulla',
      confirmLabel: 'Rimuovi',
    });
    expect(wrapper.get('h2').text()).toBe('Rimuovi elemento');
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      'Annulla',
      'Rimuovi',
    ]);
    wrapper.unmount();
  });

  it('blocks invalid confirmations and prevents every dismissal while busy', async () => {
    const wrapper = mount(NasConfirmDialog, { props: { ...props, confirmDisabled: true } });
    await wrapper.findAll('button')[1]?.trigger('click');
    expect(wrapper.emitted('confirm')).toBeUndefined();
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    await wrapper.setProps({ confirmDisabled: false, busy: true });
    for (const button of wrapper.findAll('button')) {
      expect(button.element.disabled).toBe(true);
      await button.trigger('click');
    }
    await wrapper.trigger('cancel');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.attributes('aria-busy')).toBe('true');
    wrapper.unmount();
  });

  it('uses distinct accessible title and message identifiers for separate instances', () => {
    const wrapper = mount(NasPageHeader, {
      props: { title: 'Dialogs' },
      slots: { actions: () => [h(NasConfirmDialog, props), h(NasConfirmDialog, props)] },
    });
    const ids = wrapper.findAll('dialog h2, dialog p').map((element) => element.attributes('id'));
    expect(new Set(ids).size).toBe(4);
    wrapper.unmount();
  });
});
