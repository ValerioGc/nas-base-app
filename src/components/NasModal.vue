<script setup lang="ts">

import { vNasModal } from '../directives/nativeModal';

interface Props {
  label: string;
  dismissible?: boolean;
}

const props = withDefaults(defineProps<Props>(), { dismissible: true });
const emit = defineEmits<{ close: [] }>();

function requestClose() {
  if (props.dismissible) {
    emit('close');
  }
}

</script>

<template>
  <dialog
    v-nas-modal
    class="app_modal"
    :aria-label="label"
    @click.self="requestClose"
    @cancel.prevent="requestClose"
  >
    <!-- Default slot for modal content -->
    <slot></slot>
  </dialog>
</template>
