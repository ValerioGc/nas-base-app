<script setup lang="ts">

import NasIcon from './NasIcon.vue';

interface Props {
  title: string;
  description?: string;
  svg?: string;
}

defineProps<Props>();

</script>

<template>
  <section class="nas_empty_state">
    <slot name="icon">
      <NasIcon v-if="svg" :svg="svg" class="nas_empty_icon" />
    </slot>
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.actions" class="nas_empty_actions">
      <slot name="actions" />
    </div>
  </section>
</template>
