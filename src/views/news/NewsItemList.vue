<script setup lang="ts">
import type { NewsItem } from '@/api/news'
import { formatDateTime } from '@/utils/date-time'
import { extractPlainText } from '@/utils/plain-text'
import { getSafeExternalUrl } from '@/utils/safe-url'

withDefaults(
  defineProps<{
    compact?: boolean
    items: readonly NewsItem[]
  }>(),
  { compact: false },
)
</script>

<template>
  <div class="news-list" :class="{ 'news-list-compact': compact }">
    <article v-for="item in items" :key="item.id" class="news-item py-3 border-bottom">
      <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary mb-2">
        <span class="badge text-bg-light border">{{ item.publisher }}</span>
        <span v-if="item.author">{{ item.author }}</span>
        <time v-if="item.pubDate" :datetime="item.pubDate">{{ formatDateTime(item.pubDate) }}</time>
      </div>

      <a
        v-if="getSafeExternalUrl(item.link)"
        class="news-title d-block h5 text-body text-decoration-none text-break mb-2"
        :href="getSafeExternalUrl(item.link) ?? undefined"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ item.title }}
        <span class="visually-hidden">(새 창)</span>
      </a>
      <p v-else class="h5 text-break mb-2">{{ item.title }}</p>

      <p v-if="extractPlainText(item.description)" class="news-description text-body-secondary mb-2">
        {{ extractPlainText(item.description) }}
      </p>

      <div v-if="!compact && item.categories.length > 0" class="d-flex flex-wrap gap-1">
        <span v-for="category in item.categories" :key="category" class="badge text-bg-secondary">
          {{ category }}
        </span>
      </div>
    </article>
  </div>
</template>

<style scoped>
.news-item:first-child {
  padding-top: 0 !important;
}

.news-title:hover,
.news-title:focus-visible {
  color: var(--bs-primary) !important;
  text-decoration: underline !important;
}

.news-description {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.news-list-compact .news-item:last-child,
.news-list .news-item:last-child {
  border-bottom: 0 !important;
}

.news-list-compact .news-description {
  -webkit-line-clamp: 2;
}
</style>
