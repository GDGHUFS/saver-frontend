<script setup lang="ts">
import { researchSources } from '@/views/search/research-search-sources'
</script>

<template>
  <aside
    class="research-sources card bg-body-tertiary border-0 mb-5"
    aria-labelledby="research-sources-heading"
  >
    <div class="card-body p-4">
      <h2 id="research-sources-heading" class="h5 mb-2">검색 자료 출처</h2>
      <p class="text-body-secondary mb-3">
        자체 검색엔진은 아래 두 사이트의 문서를 대상으로 실험한 결과를 제공합니다.
      </p>
      <ul class="row g-3 list-unstyled mb-0">
        <li v-for="source in researchSources" :key="source.type" class="col-12 col-md-6">
          <a
            class="fw-semibold"
            :href="source.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ source.label }}
          </a>
          <span class="d-block small text-body-secondary mt-1">{{ source.description }}</span>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.research-sources {
  max-width: 52rem;
}
</style>
