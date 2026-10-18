<script setup lang="ts">

defineProps<{ label: string }>();

</script>

<template>
  <output class="app_loading" aria-live="polite">
    <span class="loading_spinner" aria-hidden="true"></span>
    <span>{{ label }}</span>
  </output>
</template>
