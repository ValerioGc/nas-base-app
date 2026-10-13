/**
 * Keeps an application in the frame of the launcher as the sandbox of that frame used to keep it:
 * no window of its own (`window.open`, a link or a form to a new one), no `alert`, `confirm` or
 * `prompt` dialog (they answer as in a sandboxed frame: nothing, `false`, `null`) and no navigation
 * of the page that holds it. The launcher shows the applications on its own origin, where a
 * sandbox that runs scripts and keeps the origin is no wall and only makes the browser warn: it is
 * gone, and its rules live on here. Opened on its own, outside a frame, an application is as it
 * always was. Keep this file the same in every external application.
 */

type View = Window & typeof globalThis;

/** Whether a link or a form aimed at `target` would leave the frame of the application. */
function leaves(view: View, target: string | null | undefined): boolean {
  const name = (target ?? '').trim();
  if (name === '' || name.toLowerCase() === '_self') {
    return false;
  }
  // A frame of the application itself may be navigated, as in the sandbox.
  return ![...view.document.querySelectorAll('iframe')].some((frame) => frame.name === name);
}

/** Applies the rules when the application runs in a frame; tells whether it does. */
export function guardFrame(view: View = window): boolean {
  if (view.parent === view) {
    return false;
  }
  view.open = () => null;
  view.alert = () => undefined;
  view.confirm = () => false;
  view.prompt = () => null;
  view.document.addEventListener(
    'click',
    (event) => {
      const link = event.target instanceof view.Element ? event.target.closest('a[href]') : null;
      if (link && !link.hasAttribute('download') && leaves(view, link.getAttribute('target'))) {
        event.preventDefault();
      }
    },
    true,
  );
  view.document.addEventListener(
    'submit',
    (event) => {
      if (!(event.target instanceof view.HTMLFormElement)) {
        return;
      }
      // The target of the button that sends the form wins over the one of the form.
      const submitter = (event as SubmitEvent).submitter;
      const target = submitter?.getAttribute('formtarget') ?? event.target.getAttribute('target');
      if (leaves(view, target)) {
        event.preventDefault();
      }
    },
    true,
  );
  return true;
}
