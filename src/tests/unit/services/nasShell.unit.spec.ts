import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNasShell } from '../../../services/nasShell';
import { contextMessage, shellFixture } from '../../helpers/shell';

afterEach(() => vi.useRealTimers());

describe('NAS shell transport', () => {
  it('correlates concurrent HTTP requests when crypto.randomUUID is unavailable', async () => {
    const source = { getRandomValues: window.crypto.getRandomValues.bind(window.crypto) };
    const { shell, post, receive, lastRequest } = shellFixture(10000, source, 'http://192.168.1.2');
    const first = shell.request('access-settings');
    const firstId = lastRequest();
    const second = shell.request('diagnostics');
    const secondId = lastRequest();
    expect(secondId).not.toBe(firstId);
    expect(firstId).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    expect(post.mock.calls.every(([, origin]) => origin === 'http://192.168.1.2')).toBe(true);
    receive({ nas: 1, type: 'diagnostics-result', requestId: secondId, success: true, data: [] });
    receive({
      nas: 1,
      type: 'access-settings-result',
      requestId: firstId,
      success: true,
      data: {},
    });
    await expect(second).resolves.toMatchObject({ success: true, data: [] });
    await expect(first).resolves.toMatchObject({ success: true, data: {} });
    shell.dispose();
  });

  it('sends existing protocol commands only to the parent origin', () => {
    const { shell, post } = shellFixture();
    expect(shell.ready()).toBe(true);
    shell.openApp('nas-file-manager', '?directory=/photos');
    shell.openHttps();
    shell.notify('Saved', 'Backup complete', 'success');
    shell.describeNotifications([]);
    expect(post.mock.calls).toEqual([
      [{ nas: 1, type: 'ready' }, 'https://nas.test'],
      [
        { nas: 1, type: 'open', app: 'nas-file-manager', location: '?directory=/photos' },
        'https://nas.test',
      ],
      [{ nas: 1, type: 'open-https' }, 'https://nas.test'],
      [
        { nas: 1, type: 'notify', title: 'Saved', message: 'Backup complete', tone: 'success' },
        'https://nas.test',
      ],
      [{ nas: 1, type: 'describe', notifications: [] }, 'https://nas.test'],
    ]);
    shell.dispose();
  });

  it('rejects invalid navigation before sending it', () => {
    const { shell, post } = shellFixture();
    expect(() => shell.openApp('')).toThrow(TypeError);
    expect(() => shell.openApp('explorer', 'https://elsewhere.test')).toThrow(TypeError);
    expect(() => shell.pickFiles({ directory: '../private' })).toThrow(TypeError);
    expect(() => shell.pickFiles({ extensions: ['exe'] })).toThrow(TypeError);
    expect(post).not.toHaveBeenCalled();
    shell.dispose();
  });

  it('ignores messages from other origins, other windows and invalid payloads', () => {
    const { shell, receive, remove } = shellFixture();
    const listener = vi.fn();
    const stop = shell.listen(listener);
    receive(contextMessage, 'https://elsewhere.test');
    receive(contextMessage, undefined, window);
    receive({ ...contextMessage, nas: 2 });
    receive({ ...contextMessage, context: { app: 'sample' } });
    receive({ nas: 1, type: 'described', notifications: [{ id: 'invalid' }] });
    expect(listener).not.toHaveBeenCalled();
    receive(contextMessage);
    expect(listener).toHaveBeenCalledWith(contextMessage);
    stop();
    expect(remove).toHaveBeenCalledOnce();
    receive(contextMessage);
    expect(listener).toHaveBeenCalledOnce();
    shell.dispose();
  });

  it('keeps concurrent file requests separate and ignores mismatched responses', async () => {
    const { shell, receive, lastRequest, remove } = shellFixture();
    const first = shell.pickFiles({ multiple: true });
    const firstId = lastRequest();
    const second = shell.pickFolder('/photos');
    const secondId = lastRequest();
    expect(secondId).not.toBe(firstId);
    receive({ nas: 1, type: 'shortcut-result', requestId: firstId, success: true });
    receive({
      nas: 1,
      type: 'pick-files-result',
      requestId: 'unknown',
      files: [],
      cancelled: true,
    });
    receive({ nas: 1, type: 'pick-files-result', requestId: secondId, files: [], cancelled: true });
    await expect(second).resolves.toEqual({ files: [], cancelled: true });
    expect(remove).not.toHaveBeenCalled();
    const files = [
      { name: 'photo.jpg', path: '/photos/photo.jpg', url: '/apps/explorer/api/file' },
    ];
    receive({ nas: 1, type: 'pick-files-result', requestId: firstId, files, cancelled: false });
    await expect(first).resolves.toEqual({ files, cancelled: false });
    expect(remove).toHaveBeenCalledOnce();
    shell.dispose();
  });

  it('validates file payloads and propagates launcher errors', async () => {
    const { shell, receive, lastRequest } = shellFixture();
    const invalid = shell.pickFiles();
    receive({
      nas: 1,
      type: 'pick-files-result',
      requestId: lastRequest(),
      files: [{ name: 42 }],
      cancelled: false,
    });
    await expect(invalid).rejects.toMatchObject({ code: 'invalid-response' });
    const failed = shell.requestFolderShortcut('/photos', 'Photos');
    receive({
      nas: 1,
      type: 'shortcut-result',
      requestId: lastRequest(),
      success: false,
      error: 'Permission denied',
    });
    await expect(failed).rejects.toMatchObject({
      code: 'launcher-error',
      message: 'Permission denied',
    });
    shell.dispose();
  });

  it('reads network disks and the power schedule using the existing wire format', async () => {
    const { shell, receive, lastRequest } = shellFixture();
    const disks = [
      { name: 'Remote', mount: '/mnt/share', source: '//server/share', readOnly: true },
    ];
    const networkRequest = shell.requestNetworkDisks();
    receive({
      nas: 1,
      type: 'network-disks-result',
      requestId: lastRequest(),
      success: true,
      data: disks,
    });
    await expect(networkRequest).resolves.toEqual(disks);
    const schedule = {
      enabled: true,
      rules: [{ day: 'weekdays', time: '08:30', action: 'start' }],
    };
    const powerRequest = shell.requestPowerSchedule();
    receive({
      nas: 1,
      type: 'power-schedule-result',
      requestId: lastRequest(),
      success: true,
      data: schedule,
    });
    await expect(powerRequest).resolves.toEqual(schedule);
    const invalid = shell.requestPowerSchedule();
    receive({
      nas: 1,
      type: 'power-schedule-result',
      requestId: lastRequest(),
      success: true,
      data: { enabled: true, rules: [{ day: 'weekdays', time: '25:00', action: 'start' }] },
    });
    await expect(invalid).rejects.toMatchObject({ code: 'invalid-response' });
    shell.dispose();
  });

  it('settles timed out requests and removes the idle listener', async () => {
    vi.useFakeTimers();
    const { shell, receive, lastRequest, remove } = shellFixture(50);
    const outcome = expect(shell.requestFolderShortcut('/photos', 'Photos')).rejects.toMatchObject({
      code: 'timeout',
    });
    const requestId = lastRequest();
    await vi.advanceTimersByTimeAsync(50);
    await outcome;
    expect(remove).toHaveBeenCalledOnce();
    receive({ nas: 1, type: 'shortcut-result', requestId, success: true });
    expect(vi.getTimerCount()).toBe(0);
    shell.dispose();
  });

  it('rejects pending requests on disposal and prevents further use', async () => {
    vi.useFakeTimers();
    const { shell, remove } = shellFixture();
    const pending = expect(shell.pickFiles()).rejects.toMatchObject({ code: 'disposed' });
    shell.dispose();
    shell.dispose();
    await pending;
    expect(remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(shell.ready()).toBe(false);
    expect(() => shell.listen(() => {})).toThrow('Bridge disposed');
    await expect(shell.pickFiles()).rejects.toMatchObject({ code: 'disposed' });
  });

  it('works standalone and without a browser', async () => {
    for (const view of [window, null]) {
      const shell = createNasShell({ view });
      expect(shell.available).toBe(false);
      expect(shell.ready()).toBe(false);
      await expect(shell.pickFiles()).rejects.toMatchObject({ code: 'unavailable' });
      shell.dispose();
    }
    expect(() => createNasShell({ timeoutMs: 0 })).toThrow(RangeError);
  });
  it('correlates generic commands and waits for a valid response from the parent', async () => {
    const { shell, post, receive, lastRequest } = shellFixture();
    const first = shell.request(
      'initialize-disk',
      { device: '/dev/example', requestId: 'spoof' },
      { timeoutMs: 600000 },
    );
    const firstId = lastRequest();
    const second = shell.request('diagnostics');
    const secondId = lastRequest();
    expect(firstId).not.toBe('spoof');
    expect(post.mock.calls[0]?.[0]).toMatchObject({
      nas: 1,
      type: 'initialize-disk',
      device: '/dev/example',
    });
    receive({ nas: 1, type: 'initialize-disk-result', requestId: firstId, success: 'true' });
    receive(
      { nas: 1, type: 'initialize-disk-result', requestId: firstId, success: true },
      'https://other.test',
    );
    receive({
      nas: 1,
      type: 'diagnostics-result',
      requestId: secondId,
      success: false,
      error: 'Permission denied',
    });
    await expect(second).resolves.toMatchObject({ success: false, error: 'Permission denied' });
    receive({
      nas: 1,
      type: 'initialize-disk-result',
      requestId: firstId,
      success: true,
      taskId: 'task-1',
    });
    await expect(first).resolves.toMatchObject({ success: true, taskId: 'task-1' });
    shell.dispose();
  });

  it('ignores malformed picker envelopes and keeps cancellation errors', async () => {
    const { shell, receive, lastRequest } = shellFixture();
    const pending = shell.pickFiles();
    const requestId = lastRequest();
    receive({ nas: 1, type: 'pick-files-result', requestId, files: null, cancelled: false });
    receive({
      nas: 1,
      type: 'pick-files-result',
      requestId,
      files: [],
      cancelled: true,
      error: 'Cancelled',
    });
    await expect(pending).resolves.toEqual({ files: [], cancelled: true, error: 'Cancelled' });
    shell.dispose();
  });
});
