<script setup lang="ts">

import { useId } from 'vue';
import { vNasModal } from '../directives/nativeModal';

interface Props {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  busy?: boolean;
  testid?: string;
  cancelTestid?: string;
  confirmTestid?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ cancel: []; confirm: [] }>();
const id = useId();

function cancel() {
  if (!props.busy) {
    emit('cancel');
  }
}

function confirm() {
  if (!props.busy && !props.confirmDisabled) {
    emit('confirm');
  }
}

</script>

<template>
  <dialog
    v-nas-modal
    class="nas_confirm_dialog"
    :aria-labelledby="`${id}_title`"
    :aria-describedby="`${id}_message`"
    :aria-busy="busy || undefined"
    :data-testid="testid"
    @cancel.prevent="cancel"
  >
    <h2 :id="`${id}_title`">{{ title }}</h2>
    <p :id="`${id}_message`" class="nas_confirm_message">{{ message }}</p>

    <!-- Dialog actions -->
    <footer class="nas_confirm_actions">
      <button
        type="button"
        class="app_button"
        autofocus
        :disabled="busy"
        :data-testid="cancelTestid"
        @click="cancel"
      >
        {{ cancelLabel }}
      </button>
      <button
        type="button"
        class="app_button app_button--primary"
        :disabled="busy || confirmDisabled"
        :data-testid="confirmTestid"
        @click="confirm"
      >
        {{ confirmLabel }}
      </button>
    </footer>

    <!-- Default slot for additional content -->
    <slot></slot>
  </dialog>
</template>
