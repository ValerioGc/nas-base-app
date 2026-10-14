<script setup lang="ts" generic="T extends string">

import { computed } from 'vue';
import type { HTMLAttributes } from 'vue';
import type { NasCategory } from '../types/layout';

import NasIcon from './NasIcon.vue';

export interface Props<T extends string> {
  categories: readonly NasCategory<T>[];
  navigationLabel: string;
  closeLabel?: string;
  closeDisabled?: boolean;
  contained?: boolean;
  sidebarAttrs?: HTMLAttributes & Record<string, unknown>;
  contentAttrs?: HTMLAttributes & Record<string, unknown>;
}

const props = defineProps<Props<T>>();
const emit = defineEmits<{ close: [] }>();

const model = defineModel<T>({ required: true });
const category = computed(() => props.categories.find((item) => item.value === model.value));

</script>

<template>
  <div class="app_surface" :class="{ app_contained: contained }">
    <aside v-bind="sidebarAttrs" class="app_sidebar" :aria-label="navigationLabel">
      <!-- Sidebar header slot -->
      <slot name="sidebar-header" :category="category"></slot>

      <!-- Sidebar navigation -->
      <nav class="category_navigation" :aria-label="navigationLabel">
        <button
          v-for="item in categories"
          :key="item.value"
          type="button"
          class="category_button"
          :class="{ active: model === item.value }"
          :aria-pressed="model === item.value"
          :disabled="item.disabled"
          :data-testid="item.testid"
          @click="model = item.value"
        >
          <!-- Sidebar navigation icon slot -->
          <slot name="icon" :category="item" :active="model === item.value">
            <NasIcon v-if="item.icon" class="category_icon" :svg="item.icon" />
          </slot>
          {{ item.label }}
        </button>
      </nav>

      <!-- Sidebar footer slot -->
      <slot name="sidebar-footer" :category="category"></slot>

      <!-- Close button -->
      <button
        v-if="closeLabel"
        type="button"
        class="close_button category_button"
        :disabled="closeDisabled"
        @click="emit('close')"
      >
        {{ closeLabel }}
      </button>
    </aside>

    <!-- Main content area -->
    <main v-bind="contentAttrs" class="app_content">
      <slot name="header" :category="category"></slot>
      <slot :category="category" :value="model"></slot>
    </main>
  </div>
</template>
