<script setup lang="ts">

import { useNasLauncherContext } from '../../composables/useNasLauncherContext';
import type { NasContextOptions } from '../../types/launcher';

interface Props {
  options: NasContextOptions;
}
const props = defineProps<Props>();
const { locale, theme, active } = useNasLauncherContext(props.options);

</script>

<template>
  <output>{{ locale }}:{{ theme }}:{{ active }}</output>
</template>
