<script setup lang="ts">

interface Props {
  id: string;
  min: number;
  max: number;
  disabled?: boolean;
  label?: string;
  increaseLabel: string;
  decreaseLabel: string;
  testid?: string;
}

const props = defineProps<Props>();
const value = defineModel<number>({ required: true });

function change(next: number) {
  if (!props.disabled && Number.isInteger(next) && next >= props.min && next <= props.max) {
    value.value = next;
  }
}

function typed(event: Event) {
  const input = event.target as HTMLInputElement;
  change(input.valueAsNumber);
  input.value = String(value.value);
}

</script>

<template>
  <span class="number_stepper">
    <input
      :id="id"
      :aria-label="label"
      type="number"
      :value="value"
      :min="min"
      :max="max"
      step="1"
      :disabled="disabled"
      :data-testid="testid"
      @change="typed"
    />
    <span class="number_steps">
      <button
        type="button"
        :disabled="disabled || value >= max"
        :aria-label="increaseLabel"
        :title="increaseLabel"
        :data-testid="testid && `${testid}_increase`"
        @click="change(value + 1)"
      >
        <span class="step_arrow up" aria-hidden="true"></span>
      </button>
      <button
        type="button"
        :disabled="disabled || value <= min"
        :aria-label="decreaseLabel"
        :title="decreaseLabel"
        :data-testid="testid && `${testid}_decrease`"
        @click="change(value - 1)"
      >
        <span class="step_arrow" aria-hidden="true"></span>
      </button>
    </span>
  </span>
</template>
