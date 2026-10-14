<script setup lang="ts">

interface Props {
  title: string;
  overview?: string;
  subtitle?: string;
}

defineProps<Props>();

</script>

<template>
  <header class="page_header nas_page_header">
    <div>
      <p v-if="overview" class="eyebrow">{{ overview }}</p>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </div>

    <!-- Header actions slot -->
    <div v-if="$slots.actions" class="header_actions">
      <slot name="actions"></slot>
    </div>
  </header>
</template>
