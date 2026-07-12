<script setup lang="ts">
import { computed } from 'vue'

import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{
  source: string
}>()

const renderedMarkdown = computed(() => renderMarkdown(props.source))
</script>

<template>
  <div class="markdown-content" v-html="renderedMarkdown"></div>
</template>

<style scoped>
.markdown-content {
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin-block: 1.5em 0.65em;
  line-height: 1.3;
}

.markdown-content :deep(h1) {
  font-size: 1.75rem;
}

.markdown-content :deep(h2) {
  font-size: 1.5rem;
}

.markdown-content :deep(h3) {
  font-size: 1.25rem;
}

.markdown-content :deep(pre) {
  overflow-x: auto;
  padding: 1rem;
  background: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
}

.markdown-content :deep(code) {
  color: var(--bs-code-color);
}

.markdown-content :deep(blockquote) {
  margin-block: 1.25rem;
  padding: 0.75rem 1rem;
  color: var(--bs-secondary-color);
  border-left: 0.25rem solid var(--bs-border-color);
  background: var(--bs-tertiary-bg);
}

.markdown-content :deep(blockquote > :last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(.contains-task-list) {
  padding-left: 0;
  list-style: none;
}

.markdown-content :deep(.task-list-item) {
  list-style: none;
}

.markdown-content :deep(.task-list-item-checkbox) {
  width: 1rem;
  height: 1rem;
  margin: 0 0.5rem 0.2rem 0;
  vertical-align: middle;
  accent-color: var(--bs-primary);
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.markdown-content :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 0.5rem;
  border: 1px solid var(--bs-border-color);
}

.markdown-content :deep(th) {
  background: var(--bs-tertiary-bg);
}
</style>
