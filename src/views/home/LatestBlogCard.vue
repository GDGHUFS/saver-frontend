<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { blogApi, type BlogSummary } from '@/api/blog'
import type { AsyncStatus } from '@/types/async-state'
import BlogSummaryList from '@/views/blog/BlogSummaryList.vue'

const status = ref<AsyncStatus>('loading')
const posts = ref<readonly BlogSummary[]>([])
let sequence = 0
let controller: AbortController | null = null

async function loadLatestPosts(): Promise<void> {
  const requestSequence = ++sequence
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  status.value = 'loading'

  try {
    const latestPosts = await blogApi.getLatest(3, requestController.signal)
    if (requestSequence !== sequence) {
      return
    }

    posts.value = latestPosts
    status.value = latestPosts.length === 0 ? 'empty' : 'success'
  } catch {
    if (!requestController.signal.aborted && requestSequence === sequence) {
      status.value = 'error'
    }
  } finally {
    if (requestSequence === sequence) {
      controller = null
    }
  }
}

onMounted(() => {
  void loadLatestPosts()
})

onBeforeUnmount(() => {
  sequence += 1
  controller?.abort()
})
</script>

<template>
  <article class="service-card card h-100" aria-labelledby="latest-blog-title">
    <div class="card-body d-flex flex-column p-4">
      <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
        <h3 id="latest-blog-title" class="h5 mb-0">블로그</h3>
        <RouterLink class="btn btn-sm btn-outline-primary" to="/blog">전체 보기</RouterLink>
      </div>

      <div v-if="status === 'loading'" class="py-4 text-center" role="status">
        <span class="spinner-border spinner-border-sm text-primary" aria-hidden="true"></span>
        <span class="visually-hidden">최신 글을 불러오는 중</span>
      </div>

      <div v-else-if="status === 'empty'" class="py-4 text-center text-body-secondary">
        아직 작성된 블로그 글이 없습니다.
      </div>

      <div v-else-if="status === 'error'" class="alert alert-danger mb-0" role="alert">
        <p class="small mb-2">최신 글을 불러오지 못했습니다.</p>
        <button class="btn btn-sm btn-outline-danger" type="button" @click="loadLatestPosts">
          다시 시도
        </button>
      </div>

      <BlogSummaryList v-else :posts="posts" compact />
    </div>
  </article>
</template>

<style scoped>
.service-card {
  border-color: var(--bs-border-color);
  border-radius: 0.5rem;
}
</style>
