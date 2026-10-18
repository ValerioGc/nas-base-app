import type { ObjectDirective } from 'vue';

export const vNasModal: ObjectDirective<HTMLDialogElement> = {
  mounted(dialog) {
    dialog.showModal();
  },
  beforeUnmount(dialog) {
    dialog.close();
  },
};
