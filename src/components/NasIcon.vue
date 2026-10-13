<script setup lang="ts">

interface Props {
  /** SVG URL returned by a normal Vite import in the consuming component. */
  svg: string;
}
defineProps<Props>();

</script>

<template>
  <span
    class="app_icon app_icon_mask"
    aria-hidden="true"
    :style="{ maskImage: `url(${JSON.stringify(svg)})` }"
  ></span>
</template>
