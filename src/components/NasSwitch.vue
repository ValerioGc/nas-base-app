<script setup lang="ts">

import { useId } from 'vue';

interface Props {
  label: string;
  disabled?: boolean;
  testid?: string;
}

const props = withDefaults(defineProps<Props>(), { disabled: false, testid: undefined });

const checked = defineModel<boolean>({ required: true });
// An id of its own, for the browser to tell the field apart.
const id = useId();

</script>

<template>
  <label
    class="app_switch"
    :class="{ app_switch_disabled: props.disabled }"
    :data-testid="props.testid && `${props.testid}_switch`"
  >
    <input
      :id="id"
      v-model="checked"
      type="checkbox"
      role="switch"
      :aria-checked="checked"
      :disabled="props.disabled"
      :data-testid="props.testid"
    />
    <span class="app_switch_track" aria-hidden="true"></span>
    <span class="app_switch_label">{{ props.label }}</span>
  </label>
</template>
