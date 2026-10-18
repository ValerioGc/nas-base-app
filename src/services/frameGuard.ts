type View = Window & typeof globalThis;

function leaves(view: View, target: string | null | undefined): boolean {
  const name = (target ?? '').trim();
  if (name === '' || name.toLowerCase() === '_self') {
    return false;
  }

  return ![...view.document.querySelectorAll('iframe')].some((frame) => frame.name === name);
}

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
