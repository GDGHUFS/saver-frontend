<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { getSafeExternalUrl } from '@/utils/safe-url'

const props = defineProps<{
  pageUrl: string
}>()

const hasFailed = ref(false)
const favicon = computed(() => {
  const safePageUrl = getSafeExternalUrl(props.pageUrl)
  if (safePageUrl === null) {
    return null
  }

  const pageUrl = new URL(safePageUrl)
  const hostname = pageUrl.hostname.replace(/^www\./i, '')
  return {
    fallback: hostname.charAt(0).toLocaleUpperCase() || '?',
    hostname: pageUrl.hostname,
    url: new URL('/favicon.ico', pageUrl.origin).href,
  }
})
const fallback = computed(() => favicon.value?.fallback ?? '?')

watch(
  () => props.pageUrl,
  () => {
    hasFailed.value = false
  },
)
</script>

<template>
  <span
    class="result-favicon d-inline-grid flex-shrink-0 border rounded bg-white"
    :title="favicon?.hostname"
    aria-hidden="true"
  >
    <img
      v-if="favicon !== null && !hasFailed"
      class="result-favicon-image"
      :src="favicon.url"
      alt=""
      width="20"
      height="20"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="hasFailed = true"
    />
    <span v-else class="result-favicon-fallback">{{ fallback }}</span>
  </span>
</template>

<style scoped>
.result-favicon {
  width: 2rem;
  height: 2rem;
  margin-top: 0.1rem;
  color: var(--bs-secondary-color);
  font-size: 0.75rem;
  font-weight: 700;
  place-items: center;
}

.result-favicon-image {
  width: 1.25rem;
  height: 1.25rem;
  object-fit: contain;
}

.result-favicon-fallback {
  line-height: 1;
}
</style>
