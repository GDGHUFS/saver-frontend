<script setup lang="ts">
import { computed } from 'vue'

import type { ResearchSearchResult } from '@/api/research-search'
import { getResearchSource } from '@/views/search/research-search-sources'

interface Props {
  query: string
  result: ResearchSearchResult
}

const props = defineProps<Props>()

const displayItems = computed(() =>
  props.result.items.map((item) => ({
    ...item,
    matchLabel: item.matchedBy
      .map((method) => (method === 'keyword' ? '키워드' : '의미'))
      .join(' + '),
    publishedLabel: item.publishedAt?.replaceAll('-', '.'),
    scoreLabel: item.score.toFixed(4),
    source: getResearchSource(item.sourceType),
  })),
)
</script>

<template>
  <section aria-labelledby="research-results-heading">
    <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-4">
      <h2 id="research-results-heading" class="h5 mb-0">
        <strong>{{ query }}</strong> 자체 검색 결과
      </h2>
      <span class="small text-body-secondary">{{ result.resultCount }}건</span>
    </div>

    <ol class="list-unstyled research-results mb-0">
      <li
        v-for="item in displayItems"
        :key="item.documentId"
        class="research-result card mb-3"
      >
        <article class="card-body p-4">
          <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary mb-2">
            <span class="badge text-bg-light border">#{{ item.rank }}</span>
            <a
              :href="item.source.url"
              target="_blank"
              rel="noopener noreferrer"
              class="fw-semibold"
            >
              {{ item.source.label }}
            </a>
            <span v-if="item.publishedLabel">{{ item.publishedLabel }}</span>
            <span v-if="item.author">{{ item.author }}</span>
            <span v-if="item.category" class="badge rounded-pill text-bg-secondary">
              {{ item.category }}
            </span>
          </div>
          <h3 class="h5 mb-2">{{ item.title || '제목 없는 문서' }}</h3>
          <p
            v-if="item.chunk.sectionPath || item.chunk.heading"
            class="small text-body-secondary mb-2"
          >
            {{ item.chunk.sectionPath ?? item.chunk.heading }}
          </p>
          <p class="research-excerpt mb-3">{{ item.chunk.excerpt }}</p>
          <div class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary">
            <span title="키워드 및 의미 검색 순위를 결합한 결과 내 상대 점수입니다.">
              상대 점수 {{ item.scoreLabel }}
            </span>
            <span aria-hidden="true">·</span>
            <span>{{ item.matchLabel }} 검색</span>
            <template v-if="item.topics.length > 0">
              <span aria-hidden="true">·</span>
              <span
                v-for="topic in item.topics"
                :key="topic"
                class="badge rounded-pill text-bg-light border"
              >
                {{ topic }}
              </span>
            </template>
          </div>
        </article>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.research-results {
  max-width: 52rem;
}

.research-result {
  border-color: var(--bs-border-color);
  box-shadow: var(--bs-box-shadow-sm);
}

.research-excerpt {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
