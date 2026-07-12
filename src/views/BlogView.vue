<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { BLOG_LATEST_MAX_COUNT, blogApi, type BlogSummary } from '@/api/blog'
import AsyncState from '@/components/AsyncState.vue'
import PageScaffold from '@/components/PageScaffold.vue'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { parsePositiveRouteParam } from '@/utils/route-params'
import BlogSummaryList from '@/views/blog/BlogSummaryList.vue'

const route = useRoute()
const { load: loadCurrentUser, status: authStatus } = useCurrentUser()
const status = ref<'empty' | 'error' | 'loading' | 'success'>('loading')
const posts = ref<readonly BlogSummary[]>([])
const errorMessage = ref('블로그 글을 불러오지 못했습니다.')
let sequence = 0
let controller: AbortController | null = null

const authorId = computed(() => parsePositiveRouteParam(route.params.userId))
const isAuthorView = computed(() => route.name === 'blog-author')
const pageTitle = computed(() => {
  if (!isAuthorView.value) {
    return '블로그'
  }

  const nickname = posts.value[0]?.author.nickname
  return nickname === undefined ? '작성자의 글' : `${nickname}님의 글`
})

async function loadPosts(): Promise<void> {
  const requestSequence = ++sequence
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  status.value = 'loading'
  posts.value = []
  errorMessage.value = '블로그 글을 불러오지 못했습니다.'

  try {
    let loadedPosts: readonly BlogSummary[]
    if (isAuthorView.value) {
      const requestedAuthorId = authorId.value
      if (requestedAuthorId === null) {
        throw new RangeError('invalid author id')
      }
      loadedPosts = await blogApi.getByAuthor(requestedAuthorId, requestController.signal)
    } else {
      loadedPosts = await blogApi.getLatest(BLOG_LATEST_MAX_COUNT, requestController.signal)
    }

    if (requestSequence !== sequence) {
      return
    }

    posts.value = loadedPosts
    status.value = loadedPosts.length === 0 ? 'empty' : 'success'
  } catch (error: unknown) {
    if (requestController.signal.aborted || requestSequence !== sequence) {
      return
    }

    if (error instanceof RangeError) {
      errorMessage.value = '유효하지 않은 작성자 주소입니다.'
    }
    status.value = 'error'
  } finally {
    if (requestSequence === sequence) {
      controller = null
    }
  }
}

watch(
  () => route.fullPath,
  () => {
    void loadPosts()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  sequence += 1
  controller?.abort()
})
</script>

<template>
  <PageScaffold :title="pageTitle">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <RouterLink v-if="isAuthorView" class="btn btn-outline-secondary" :to="{ name: 'blog' }">
        전체 글
      </RouterLink>
      <span v-else></span>

      <RouterLink
        v-if="authStatus === 'success'"
        class="btn btn-primary"
        :to="{ name: 'blog-new' }"
      >
        새 글 작성
      </RouterLink>
      <RouterLink v-else-if="authStatus === 'empty'" class="btn btn-outline-primary" to="/">
        로그인하고 글쓰기
      </RouterLink>
      <button
        v-else-if="authStatus === 'error'"
        class="btn btn-outline-danger"
        type="button"
        @click="loadCurrentUser"
      >
        로그인 상태 다시 확인
      </button>
    </div>

    <AsyncState
      :status="status"
      empty-message="표시할 블로그 글이 없습니다."
      :error-message="errorMessage"
      @retry="loadPosts"
    >
      <BlogSummaryList :posts="posts" />
    </AsyncState>
  </PageScaffold>
</template>
