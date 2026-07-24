<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { authApi } from '@/api/auth'
import { ApiHttpError, ApiResponseError } from '@/api/client'
import {
  SEARCH_QUERY_MAX_LENGTH,
  normalizeSearchQuery,
  type SearchResult,
} from '@/api/search'
import AsyncState from '@/components/AsyncState.vue'
import PageScaffold from '@/components/PageScaffold.vue'
import { runSearchPolling, SearchPollingTimeoutError } from '@/composables/search-polling'
import { useCurrentUser } from '@/composables/useCurrentUser'
import type { AsyncStatus } from '@/types/async-state'
import { getSafeExternalUrl } from '@/utils/safe-url'
import SearchResultFavicon from '@/views/search/SearchResultFavicon.vue'

type SearchViewStatus = 'idle' | AsyncStatus

const route = useRoute()
const router = useRouter()
const { load: loadCurrentUser, status: authStatus } = useCurrentUser()
const queryInput = ref('')
const searchedQuery = ref('')
const searchStatus = ref<SearchViewStatus>('idle')
const result = ref<SearchResult | null>(null)
const validationMessage = ref('')
const errorMessage = ref('검색 결과를 가져오지 못했습니다.')
const sessionExpired = ref(false)
let handledRouteQuery: string | null = null
let sequence = 0
let controller: AbortController | null = null

const routeQuery = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
const loginUrl = computed(() => authApi.getLoginUrl())
const displayItems = computed(() =>
  (result.value?.items ?? []).map((item) => ({
    ...item,
    safeImageUrl: getSafeExternalUrl(item.imageUrl),
    safeUrl: getSafeExternalUrl(item.url),
  })),
)

function setSearchError(error: unknown): void {
  sessionExpired.value = false
  if (error instanceof SearchPollingTimeoutError) {
    errorMessage.value = '검색 처리 시간이 길어져 조회를 중단했습니다. 새 검색으로 다시 시도해 주세요.'
  } else if (error instanceof ApiHttpError && error.status === 401) {
    sessionExpired.value = true
    errorMessage.value = '로그인이 만료되었습니다. 다시 로그인한 뒤 검색해 주세요.'
  } else if (error instanceof ApiHttpError && error.status === 404) {
    errorMessage.value = '검색 결과의 유효 시간이 만료되었습니다. 새 검색으로 다시 시도해 주세요.'
  } else if (error instanceof ApiHttpError && error.status === 422) {
    errorMessage.value = '검색어 또는 검색 요청 형식이 올바르지 않습니다.'
  } else if (error instanceof ApiHttpError && error.status === 502) {
    errorMessage.value = '검색 작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } else if (error instanceof ApiHttpError && error.status === 503) {
    errorMessage.value = '검색 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  } else if (error instanceof ApiResponseError) {
    errorMessage.value = '검색 서버의 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  } else {
    errorMessage.value = '네트워크 문제로 검색하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'
  }
  searchStatus.value = 'error'
}

async function startSearch(query: string): Promise<void> {
  if (authStatus.value !== 'success' || sessionExpired.value) {
    return
  }

  let normalizedQuery: string
  try {
    normalizedQuery = normalizeSearchQuery(query)
  } catch {
    validationMessage.value = `검색어를 1자 이상 ${SEARCH_QUERY_MAX_LENGTH}자 이하로 입력해 주세요.`
    return
  }

  const requestSequence = ++sequence
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  validationMessage.value = ''
  searchedQuery.value = normalizedQuery
  searchStatus.value = 'loading'
  result.value = null

  try {
    const searchResult = await runSearchPolling(normalizedQuery, {
      signal: requestController.signal,
    })
    if (requestSequence !== sequence) {
      return
    }

    result.value = searchResult
    searchStatus.value =
      searchResult.items.length === 0 && searchResult.aiSummary === null ? 'empty' : 'success'
  } catch (error: unknown) {
    if (requestController.signal.aborted || requestSequence !== sequence) {
      return
    }
    setSearchError(error)
  } finally {
    if (requestSequence === sequence) {
      controller = null
    }
  }
}

async function submitSearch(): Promise<void> {
  if (searchStatus.value === 'loading') {
    return
  }

  let normalizedQuery: string
  try {
    normalizedQuery = normalizeSearchQuery(queryInput.value)
  } catch {
    validationMessage.value = `검색어를 1자 이상 ${SEARCH_QUERY_MAX_LENGTH}자 이하로 입력해 주세요.`
    return
  }

  validationMessage.value = ''
  const isCurrentRouteQuery = routeQuery.value === normalizedQuery
  await router.push({ name: 'search', query: { q: normalizedQuery } })
  if (isCurrentRouteQuery) {
    await startSearch(normalizedQuery)
  }
}

function cancelSearch(): void {
  sequence += 1
  controller?.abort()
  controller = null
  searchStatus.value = 'idle'
  result.value = null
}

function retrySearch(): void {
  void startSearch(searchedQuery.value)
}

watch(
  routeQuery,
  (query) => {
    queryInput.value = query
  },
  { immediate: true },
)

watch(
  [authStatus, routeQuery],
  ([currentAuthStatus, query]) => {
    if (currentAuthStatus !== 'success' || query.length === 0 || query === handledRouteQuery) {
      return
    }
    handledRouteQuery = query
    void startSearch(query)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  sequence += 1
  controller?.abort()
})
</script>

<template>
  <PageScaffold title="검색">
    <AsyncState v-if="authStatus === 'loading'" status="loading" />

    <div v-else-if="authStatus === 'empty'" class="alert alert-warning" role="alert">
      <p>검색은 로그인한 사용자만 이용할 수 있습니다.</p>
      <a class="btn btn-warning" :href="loginUrl">카카오 로그인</a>
    </div>

    <div v-else-if="authStatus === 'error'" class="alert alert-danger" role="alert">
      <p>로그인 상태를 확인하지 못했습니다.</p>
      <button class="btn btn-outline-danger" type="button" @click="loadCurrentUser">
        다시 시도
      </button>
    </div>

    <template v-else>
      <form class="search-form mb-5" role="search" @submit.prevent="submitSearch">
        <label class="visually-hidden" for="search-query">통합 검색</label>
        <div class="input-group input-group-lg search-input-group shadow-sm">
          <input
            id="search-query"
            v-model="queryInput"
            class="form-control"
            type="search"
            name="q"
            :maxlength="SEARCH_QUERY_MAX_LENGTH"
            autocomplete="off"
            placeholder="검색어를 입력하세요"
            :aria-invalid="validationMessage.length > 0"
            aria-describedby="search-validation"
            :disabled="searchStatus === 'loading' || sessionExpired"
          />
          <button
            class="btn btn-primary px-4"
            type="submit"
            :disabled="searchStatus === 'loading' || sessionExpired"
          >
            검색
          </button>
        </div>
        <p
          v-if="validationMessage"
          id="search-validation"
          class="text-danger small mt-2 mb-0"
          role="alert"
        >
          {{ validationMessage }}
        </p>
      </form>

      <div v-if="searchStatus === 'idle'" class="py-5 text-center text-body-secondary">
        <p class="mb-0">검색어를 입력하면 통합 검색 결과를 확인할 수 있습니다.</p>
      </div>

      <div v-else-if="searchStatus === 'loading'" class="py-5 text-center" role="status" aria-live="polite">
        <div class="spinner-border text-primary mb-3" aria-hidden="true"></div>
        <p class="mb-3"><strong>{{ searchedQuery }}</strong> 검색 결과를 준비하고 있습니다.</p>
        <p class="small text-body-secondary">페이지를 닫지 않아도 완료되는 즉시 결과를 표시합니다.</p>
        <button class="btn btn-sm btn-outline-secondary" type="button" @click="cancelSearch">
          검색 취소
        </button>
      </div>

      <div v-else-if="searchStatus === 'error'" class="alert alert-danger" role="alert">
        <p class="mb-3">{{ errorMessage }}</p>
        <a v-if="sessionExpired" class="btn btn-outline-danger" :href="loginUrl">
          다시 로그인
        </a>
        <button v-else class="btn btn-outline-danger" type="button" @click="retrySearch">
          새 검색으로 다시 시도
        </button>
      </div>

      <div v-else-if="searchStatus === 'empty'" class="py-5 text-center text-body-secondary">
        <p class="mb-1"><strong>{{ searchedQuery }}</strong>에 대한 검색 결과가 없습니다.</p>
        <p class="small mb-0">다른 검색어로 다시 시도해 보세요.</p>
      </div>

      <div v-else-if="result !== null">
        <section
          v-if="result.aiSummary !== null"
          class="ai-summary card border-primary-subtle bg-primary-subtle mb-5"
          aria-labelledby="ai-summary-heading"
        >
          <div class="card-body p-4">
            <div class="d-flex align-items-start gap-3">
              <span class="badge rounded-pill text-bg-primary mt-1" aria-hidden="true">AI</span>
              <div class="min-width-0">
                <h2 id="ai-summary-heading" class="h5 mb-3">AI 간단 요약</h2>
                <p class="ai-summary-text mb-2">{{ result.aiSummary }}</p>
                <p class="small text-body-secondary mb-0">
                  AI가 생성한 내용은 부정확할 수 있으니 아래 검색 결과를 함께 확인해 주세요.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="search-results-heading">
          <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-4">
            <h2 id="search-results-heading" class="h5 mb-0">
              <strong>{{ searchedQuery }}</strong> 검색 결과
            </h2>
            <span class="small text-body-secondary">{{ result.elapsedMilliseconds }}ms</span>
          </div>

          <ol v-if="displayItems.length > 0" class="list-unstyled search-results mb-5">
            <li
              v-for="item in displayItems"
              :key="`${item.url}-${item.title}`"
              class="search-result"
            >
              <div class="d-flex align-items-start gap-3">
                <SearchResultFavicon :page-url="item.url" />
                <div class="flex-grow-1 min-width-0">
                  <p class="small text-body-secondary text-truncate mb-1">{{ item.url }}</p>
                  <h3 class="h5 mb-2">
                    <a
                      v-if="item.safeUrl !== null"
                      :href="item.safeUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ item.title }}
                    </a>
                    <span v-else>{{ item.title }}</span>
                  </h3>
                  <p v-if="item.snippet" class="text-body-secondary mb-0">{{ item.snippet }}</p>
                </div>
                <img
                  v-if="item.safeImageUrl !== null"
                  class="search-thumbnail rounded border object-fit-cover"
                  :src="item.safeImageUrl"
                  :alt="`${item.title} 미리보기`"
                />
              </div>
            </li>
          </ol>
          <p v-else class="text-body-secondary mb-5">
            함께 표시할 일반 검색 결과가 없습니다.
          </p>

          <aside v-if="result.relatedSearches.length > 0" aria-labelledby="related-searches-heading">
            <h2 id="related-searches-heading" class="h5 mb-3">관련 검색어</h2>
            <div class="d-flex flex-wrap gap-2">
              <RouterLink
                v-for="relatedQuery in result.relatedSearches"
                :key="relatedQuery"
                class="btn btn-light border rounded-pill"
                :to="{ name: 'search', query: { q: relatedQuery } }"
              >
                {{ relatedQuery }}
              </RouterLink>
            </div>
          </aside>
        </section>
      </div>
    </template>
  </PageScaffold>
</template>

<style scoped>
.search-form {
  max-width: 48rem;
  margin-inline: auto;
}

.search-input-group {
  overflow: hidden;
  border: 1px solid var(--bs-border-color);
  border-radius: 2rem;
}

.search-input-group:focus-within {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.25rem rgb(var(--bs-primary-rgb) / 0.15) !important;
}

.search-input-group .form-control,
.search-input-group .btn {
  min-height: 3.5rem;
  border: 0;
  border-radius: 0;
}

.search-input-group .form-control:focus {
  box-shadow: none;
}

.search-results {
  max-width: 52rem;
}

.ai-summary {
  max-width: 52rem;
}

.ai-summary-text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.search-result {
  padding-block: 1.25rem;
  border-bottom: 1px solid var(--bs-border-color);
}

.search-result:first-child {
  padding-top: 0;
}

.min-width-0 {
  min-width: 0;
}

.search-thumbnail {
  width: 7rem;
  height: 5rem;
  flex: 0 0 auto;
}

@media (max-width: 575.98px) {
  .search-input-group .btn {
    padding-inline: 1rem !important;
  }

  .search-thumbnail {
    width: 5rem;
    height: 4rem;
  }
}
</style>
