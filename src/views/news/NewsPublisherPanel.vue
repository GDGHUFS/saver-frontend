<script setup lang="ts">
import type { NewsPublisher } from '@/api/news'
import { formatDateTime } from '@/utils/date-time'
import { extractPlainText } from '@/utils/plain-text'
import { getSafeExternalUrl } from '@/utils/safe-url'

defineProps<{
  publisher: NewsPublisher
}>()
</script>

<template>
  <aside class="card bg-body-tertiary border-0 mb-4" aria-labelledby="publisher-panel-title">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div>
          <h2 id="publisher-panel-title" class="h5 mb-1">{{ publisher.publisher }}</h2>
          <p class="text-body-secondary mb-2">{{ publisher.title }}</p>
        </div>
        <a
          v-if="getSafeExternalUrl(publisher.link)"
          class="btn btn-sm btn-outline-secondary"
          :href="getSafeExternalUrl(publisher.link) ?? undefined"
          target="_blank"
          rel="noopener noreferrer"
        >
          발행자 사이트 <span class="visually-hidden">(새 창)</span>
        </a>
      </div>
      <p v-if="extractPlainText(publisher.description)" class="mb-2">
        {{ extractPlainText(publisher.description) }}
      </p>
      <p v-if="publisher.lastBuildDate" class="small text-body-secondary mb-0">
        마지막 RSS 갱신 {{ formatDateTime(publisher.lastBuildDate) }}
      </p>
    </div>
  </aside>
</template>
