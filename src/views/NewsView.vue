<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import {
  NEWS_DEFAULT_PAGE_SIZE,
  newsApi,
  type NewsItem,
  type NewsPublisher,
} from '@/api/news'
import { ApiHttpError } from '@/api/client'
import AsyncState from '@/components/AsyncState.vue'
import PageScaffold from '@/components/PageScaffold.vue'
import type { AsyncStatus } from '@/types/async-state'
import NewsItemList from '@/views/news/NewsItemList.vue'
import NewsPublisherPanel from '@/views/news/NewsPublisherPanel.vue'

const publishersStatus = ref<AsyncStatus>('loading')
const publishers = ref<readonly NewsPublisher[]>([])
const selectedPublisher = ref('')
const publisherStatus = ref<AsyncStatus>('empty')
const publisherDetail = ref<NewsPublisher | null>(null)
const publisherError = ref('발행자 정보를 불러오지 못했습니다.')
const pageStatus = ref<AsyncStatus>('loading')
const items = ref<readonly NewsItem[]>([])
const nextCursor = ref<string | null>(null)
const cursorHistory = ref<readonly (string | null)[]>([null])
const pageIndex = ref(0)
const requestedCursor = ref<string | null>(null)
const requestedPageIndex = ref(0)

let publishersController: AbortController | null = null
let publisherController: AbortController | null = null
let pageController: AbortController | null = null
let publisherSequence = 0
let pageSequence = 0

async function loadPublishers(): Promise<void> {
  publishersController?.abort()
  const controller = new AbortController()
  publishersController = controller
  publishersStatus.value = 'loading'
  try {
    const loaded = await newsApi.getPublishers(controller.signal)
    publishers.value = loaded
    publishersStatus.value = loaded.length === 0 ? 'empty' : 'success'
  } catch {
    if (!controller.signal.aborted) publishersStatus.value = 'error'
  } finally {
    if (publishersController === controller) publishersController = null
  }
}

async function loadPublisherDetail(): Promise<void> {
  const requestSequence = ++publisherSequence
  publisherController?.abort()
  publisherDetail.value = null
  publisherError.value = '발행자 정보를 불러오지 못했습니다.'
  if (selectedPublisher.value === '') {
    publisherStatus.value = 'empty'
    return
  }

  const controller = new AbortController()
  publisherController = controller
  publisherStatus.value = 'loading'
  try {
    const detail = await newsApi.getPublisher(selectedPublisher.value, controller.signal)
    if (requestSequence !== publisherSequence) return
    publisherDetail.value = detail
    publisherStatus.value = 'success'
  } catch (error: unknown) {
    if (controller.signal.aborted || requestSequence !== publisherSequence) return
    if (error instanceof ApiHttpError && error.status === 404) {
      publisherError.value = '선택한 발행자를 찾을 수 없습니다.'
    }
    publisherStatus.value = 'error'
  } finally {
    if (requestSequence === publisherSequence) publisherController = null
  }
}

async function loadPage(cursor: string | null, targetPageIndex: number): Promise<void> {
  const requestSequence = ++pageSequence
  pageController?.abort()
  const controller = new AbortController()
  pageController = controller
  requestedCursor.value = cursor
  requestedPageIndex.value = targetPageIndex
  pageStatus.value = 'loading'
  items.value = []

  try {
    const page = await newsApi.getPage({
      cursor,
      pageSize: NEWS_DEFAULT_PAGE_SIZE,
      publisher: selectedPublisher.value === '' ? null : selectedPublisher.value,
      signal: controller.signal,
    })
    if (requestSequence !== pageSequence) return
    items.value = page.items
    nextCursor.value = page.nextCursor
    pageIndex.value = targetPageIndex
    pageStatus.value = page.items.length === 0 ? 'empty' : 'success'
  } catch {
    if (!controller.signal.aborted && requestSequence === pageSequence) pageStatus.value = 'error'
  } finally {
    if (requestSequence === pageSequence) pageController = null
  }
}

function applyPublisherFilter(): void {
  cursorHistory.value = [null]
  pageIndex.value = 0
  void loadPublisherDetail()
  void loadPage(null, 0)
}

function goToNextPage(): void {
  if (nextCursor.value === null || pageStatus.value === 'loading') return
  const history = cursorHistory.value.slice(0, pageIndex.value + 1)
  cursorHistory.value = [...history, nextCursor.value]
  void loadPage(nextCursor.value, pageIndex.value + 1)
}

function goToPreviousPage(): void {
  if (pageIndex.value < 1 || pageStatus.value === 'loading') return
  const previousIndex = pageIndex.value - 1
  void loadPage(cursorHistory.value[previousIndex] ?? null, previousIndex)
}

function retryPage(): void {
  void loadPage(requestedCursor.value, requestedPageIndex.value)
}

onMounted(() => {
  void loadPublishers()
  void loadPage(null, 0)
})

onBeforeUnmount(() => {
  publisherSequence += 1
  pageSequence += 1
  publishersController?.abort()
  publisherController?.abort()
  pageController?.abort()
})
</script>

<template>
  <PageScaffold title="뉴스">
    <section class="mb-4" aria-labelledby="publisher-filter-title">
      <h2 id="publisher-filter-title" class="h5">발행자</h2>
      <div v-if="publishersStatus === 'loading'" class="text-body-secondary" role="status">
        발행자 목록을 불러오는 중입니다.
      </div>
      <div v-else-if="publishersStatus === 'error'" class="alert alert-warning" role="alert">
        <span>발행자 목록을 불러오지 못했습니다.</span>
        <button class="btn btn-sm btn-outline-dark ms-3" type="button" @click="loadPublishers">
          다시 시도
        </button>
      </div>
      <select
        v-else
        v-model="selectedPublisher"
        class="form-select publisher-select"
        aria-label="뉴스 발행자 선택"
        @change="applyPublisherFilter"
      >
        <option value="">전체 발행자</option>
        <option v-for="publisher in publishers" :key="publisher.id" :value="publisher.publisher">
          {{ publisher.publisher }}
        </option>
      </select>
    </section>

    <div v-if="publisherStatus === 'loading'" class="py-3 text-center" role="status">
      발행자 정보를 불러오는 중입니다.
    </div>
    <div v-else-if="publisherStatus === 'error'" class="alert alert-warning" role="alert">
      <span>{{ publisherError }}</span>
      <button class="btn btn-sm btn-outline-dark ms-3" type="button" @click="loadPublisherDetail">
        다시 시도
      </button>
    </div>
    <NewsPublisherPanel v-else-if="publisherDetail !== null" :publisher="publisherDetail" />

    <section aria-labelledby="latest-news-title">
      <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
        <h2 id="latest-news-title" class="h4 mb-0">최신 뉴스</h2>
        <span class="small text-body-secondary">{{ pageIndex + 1 }}페이지</span>
      </div>
      <AsyncState
        :status="pageStatus"
        empty-message="조건에 맞는 뉴스가 없습니다."
        error-message="뉴스를 불러오지 못했습니다."
        @retry="retryPage"
      >
        <NewsItemList :items="items" />
      </AsyncState>

      <nav class="d-flex justify-content-between align-items-center gap-3 mt-4" aria-label="뉴스 페이지">
        <button
          class="btn btn-outline-secondary"
          type="button"
          :disabled="pageIndex === 0 || pageStatus === 'loading'"
          @click="goToPreviousPage"
        >
          이전 페이지
        </button>
        <span class="text-body-secondary">{{ pageIndex + 1 }} / 다음 페이지 탐색</span>
        <button
          class="btn btn-outline-primary"
          type="button"
          :disabled="nextCursor === null || pageStatus === 'loading'"
          @click="goToNextPage"
        >
          다음 페이지
        </button>
      </nav>
    </section>
  </PageScaffold>
</template>

<style scoped>
.publisher-select {
  max-width: 30rem;
}
</style>
