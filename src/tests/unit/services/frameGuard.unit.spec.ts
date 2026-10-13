import { afterEach, expect, it } from 'vitest';
import { guardFrame } from '../../../services/frameGuard';

afterEach(() => {
  document.body.innerHTML = '';
});

/** The window of a frame, as the launcher holds an application. */
function framed() {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  return frame.contentWindow as Window & typeof globalThis;
}

it('leaves an application opened on its own as it always was', () => {
  const open = window.open;
  expect(guardFrame(window)).toBe(false);
  expect(window.open).toBe(open);
});

it('answers windows and dialogs as the sandbox of the launcher did', () => {
  const view = framed();
  expect(guardFrame(view)).toBe(true);
  expect(view.open('https://example.org')).toBeNull();
  expect(view.alert('hello')).toBeUndefined();
  expect(view.confirm('sure?')).toBe(false);
  expect(view.prompt('name?', 'default')).toBeNull();
});

it('keeps links from leaving the frame, and lets the others go', () => {
  const view = framed();
  guardFrame(view);
  view.document.body.innerHTML = `
    <a id="top" href="#t" target="_top">top</a>
    <a id="parent" href="#p" target="_parent">parent</a>
    <a id="blank" href="#b" target=" _BLANK ">blank</a>
    <a id="unknown" href="#u" target="elsewhere">unknown</a>
    <a id="self" href="#s" target="_SELF">self</a>
    <a id="plain" href="#n"><span id="inside">plain</span></a>
    <a id="file" href="#f" target="_blank" download>file</a>
    <iframe name="inner"></iframe><a id="inner" href="#i" target="inner">inner</a>
    <span id="text">text</span>`;
  const prevented = (id: string) => {
    const event = new view.MouseEvent('click', { bubbles: true, cancelable: true });
    view.document.getElementById(id)!.dispatchEvent(event);
    return event.defaultPrevented;
  };

  for (const id of ['top', 'parent', 'blank', 'unknown']) {
    expect(prevented(id), id).toBe(true);
  }
  for (const id of ['self', 'inside', 'file', 'inner', 'text']) {
    expect(prevented(id), id).toBe(false);
  }
});

it('keeps forms from leaving the frame, the target of their button first', () => {
  const view = framed();
  guardFrame(view);
  view.document.body.innerHTML = `
    <form id="away" target="_top"><button id="send">send</button><button id="here" formtarget="_self">here</button></form>
    <form id="home"><button id="out" formtarget="_parent">out</button></form>`;
  const prevented = (form: string, button?: string) => {
    const event = new view.SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: button ? (view.document.getElementById(button) as HTMLElement) : null,
    });
    view.document.getElementById(form)!.dispatchEvent(event);
    return event.defaultPrevented;
  };

  expect(prevented('away')).toBe(true);
  expect(prevented('away', 'send')).toBe(true);
  expect(prevented('away', 'here')).toBe(false);
  expect(prevented('home')).toBe(false);
  expect(prevented('home', 'out')).toBe(true);
  const stray = new view.Event('submit', { cancelable: true });
  view.document.dispatchEvent(stray);
  expect(stray.defaultPrevented).toBe(false);
});
