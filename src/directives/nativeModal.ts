import type { ObjectDirective } from 'vue';

/** The browser owns focus containment, Escape and restoration for native dialogs. */
export const vNasModal: ObjectDirective<HTMLDialogElement> = {
  mounted(dialog) {
    dialog.showModal();
  },
  beforeUnmount(dialog) {
    dialog.close();
  },
};
