<script setup lang="ts">

import { computed } from 'vue';

interface Props {
  totalPages: number;
  label: string;
  previousLabel: string;
  nextLabel: string;
  pageLabel: (page: number) => string;
  disabled?: boolean;
  testid?: string;
}

const props = defineProps<Props>();
const page = defineModel<number>({ required: true });

const total = computed(() =>
  Number.isSafeInteger(props.totalPages) ? Math.max(0, props.totalPages) : 0,
);

const current = computed(() => {
  if (total.value === 0) {
    return 0;
  }

  const wanted = Number.isSafeInteger(page.value) ? page.value : 1;
  return Math.min(total.value, Math.max(1, wanted));
});

const pages = computed<(number | 'before' | 'after')[]>(() => {
  if (total.value <= 7) {
    return Array.from({ length: total.value }, (_, index) => index + 1);
  }

  const start = Math.max(2, Math.min(current.value - 1, total.value - 3));
  const end = start + 2;
  const items: (number | 'before' | 'after')[] = [1];
  if (start > 2) {
    items.push(start === 3 ? 2 : 'before');
  }

  for (let value = start; value <= end; value += 1) {
    items.push(value);
  }

  if (end < total.value - 1) {
    items.push(end === total.value - 2 ? total.value - 1 : 'after');
  }

  items.push(total.value);
  return items;
});

function select(next: number) {
  if (!props.disabled && next >= 1 && next <= total.value && next !== current.value) {
    page.value = next;
  }
}

</script>

<template>
  <nav class="nas_pagination" :aria-label="label" :data-testid="testid">
    <button
      type="button"
      class="app_button app_button--small"
      :disabled="disabled || current <= 1"
      @click="select(current - 1)"
    >
      {{ previousLabel }}
    </button>

    <!-- Pagination pages -->
    <ul class="nas_pagination_pages">
      <li v-for="item in pages" :key="item">
        <button
          v-if="typeof item === 'number'"
          type="button"
          class="app_button app_button--small nas_pagination_page"
          :class="{ 'app_button--primary': item === current }"
          :aria-label="pageLabel(item)"
          :aria-current="item === current ? 'page' : undefined"
          :disabled="disabled"
          @click="select(item)"
        >
          {{ item }}
        </button>
        <span v-else class="nas_pagination_gap" aria-hidden="true">…</span>
      </li>
    </ul>
    <button
      type="button"
      class="app_button app_button--small"
      :disabled="disabled || current >= total"
      @click="select(current + 1)"
    >
      {{ nextLabel }}
    </button>
  </nav>
</template>
