import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContextHarness from '../../helpers/ContextHarness.vue';
import { contextMessage, shellFixture } from '../../helpers/shell';

afterEach(() => vi.unstubAllGlobals());

describe('NAS launcher context', () => {
  it('subscribes before ready, applies live context and clears stale colors', async () => {
    vi.stubGlobal('CSS', {
      supports: (_property: string, value: string) => /^#[0-9a-f]{6}$/i.test(value),
    });
    const { shell, receive, post } = shellFixture();
    const root = document.createElement('div');
    const onLocaleChange = vi.fn();
    post.mockImplementation((message) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'ready'
      ) {
        receive(contextMessage);
      }
    });
    const wrapper = mount(ContextHarness, { props: { options: { shell, root, onLocaleChange } } });
    await nextTick();
    expect(wrapper.text()).toBe('en:dark:true');
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.nasShell).toBe('true');
    expect(root.style.getPropertyValue('--nas-surface')).toBe('#202020');
    expect(root.style.getPropertyValue('--accent')).toBe('#123456');
    expect(onLocaleChange).toHaveBeenCalledWith('en');
    receive({
      ...contextMessage,
      context: {
        ...contextMessage.context,
        theme: 'light',
        locale: 'it',
        accent: 'invalid',
        palette: {},
      },
    });
    await nextTick();
    expect(wrapper.text()).toBe('it:light:true');
    expect(root.style.getPropertyValue('--accent')).toBe('');
    expect(root.style.getPropertyValue('--nas-surface')).toBe('');
    wrapper.unmount();
    shell.dispose();
  });

  it('restores host tokens on unmount and leaves an injected bridge usable', () => {
    const { shell, receive, remove } = shellFixture();
    const root = document.createElement('div');
    root.dataset.theme = 'light';
    root.style.setProperty('--nas-surface', '#ffffff', 'important');
    const wrapper = mount(ContextHarness, { props: { options: { shell, root } } });
    receive(contextMessage);
    wrapper.unmount();
    expect(root.dataset.theme).toBe('light');
    expect(root.hasAttribute('data-nas-shell')).toBe(false);
    expect(root.style.getPropertyValue('--nas-surface')).toBe('#ffffff');
    expect(root.style.getPropertyPriority('--nas-surface')).toBe('important');
    expect(remove).toHaveBeenCalledOnce();
    expect(shell.ready()).toBe(true);
    shell.dispose();
  });

  it('uses query defaults standalone and ignores unsupported launcher locales', async () => {
    window.history.replaceState(null, '', '?lang=en&theme=dark');
    const { shell, receive } = shellFixture();
    const root = document.createElement('div');
    const wrapper = mount(ContextHarness, { props: { options: { shell, root } } });
    await nextTick();
    expect(wrapper.text()).toBe('en:dark:false');
    receive({ ...contextMessage, context: { ...contextMessage.context, locale: 'unsupported' } });
    await nextTick();
    expect(wrapper.text()).toBe('en:dark:true');
    wrapper.unmount();
    shell.dispose();
    window.history.replaceState(null, '', '/');
  });

  it('can track context without changing the document', async () => {
    const { shell, receive } = shellFixture();
    const initialTheme = document.documentElement.dataset.theme;
    const wrapper = mount(ContextHarness, {
      props: { options: { shell, root: null, locale: 'en' } },
    });
    receive(contextMessage);
    await nextTick();
    expect(wrapper.text()).toBe('en:dark:true');
    expect(document.documentElement.dataset.theme).toBe(initialTheme);
    wrapper.unmount();
    shell.dispose();
  });
});
