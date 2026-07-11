<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <section class="page-shell min-vh-content" :aria-labelledby="`${title}-heading`">
    <h1 :id="`${title}-heading`" class="page-heading">{{ title }}</h1>
    <slot />
  </section>
</template>
