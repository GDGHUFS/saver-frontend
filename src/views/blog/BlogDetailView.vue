<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { blogApi, type BlogPost } from '@/api/blog'
import { ApiHttpError } from '@/api/client'
import AsyncState from '@/components/AsyncState.vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import PageScaffold from '@/components/PageScaffold.vue'
import { useCurrentUser } from '@/composables/useCurrentUser'
import type { AsyncStatus } from '@/types/async-state'
import { formatDateTime } from '@/utils/date-time'
import { parsePositiveRouteParam } from '@/utils/route-params'

const route = useRoute()
const router = useRouter()
const { load: loadCurrentUser, status: authStatus, user } = useCurrentUser()
const status = ref<AsyncStatus>('loading')
const post = ref<BlogPost | null>(null)
const errorMessage = ref('블로그 글을 불러오지 못했습니다.')
const isDeleteModalOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')
const deleteTrigger = ref<HTMLButtonElement | null>(null)
const deleteCancelButton = ref<HTMLButtonElement | null>(null)
const deleteConfirmButton = ref<HTMLButtonElement | null>(null)
let sequence = 0
let controller: AbortController | null = null

const blogId = computed(() => parsePositiveRouteParam(route.params.blogId))
const pageTitle = computed(() => post.value?.title ?? '블로그 글')
const isOwner = computed(
  () =>
    authStatus.value === 'success' &&
    user.value !== null &&
    post.value !== null &&
    user.value.id === post.value.author.id,
)

async function loadPost(): Promise<void> {
  const requestSequence = ++sequence
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  status.value = 'loading'
  post.value = null
  errorMessage.value = '블로그 글을 불러오지 못했습니다.'

  try {
    const requestedBlogId = blogId.value
    if (requestedBlogId === null) {
      throw new RangeError('invalid blog id')
    }

    const loadedPost = await blogApi.getById(requestedBlogId, requestController.signal)
    if (requestSequence !== sequence) {
      return
    }

    post.value = loadedPost
    status.value = 'success'
  } catch (error: unknown) {
    if (requestController.signal.aborted || requestSequence !== sequence) {
      return
    }

    if (error instanceof RangeError) {
      errorMessage.value = '유효하지 않은 블로그 글 주소입니다.'
    } else if (error instanceof ApiHttpError && error.status === 404) {
      errorMessage.value = '블로그 글을 찾을 수 없습니다.'
    }
    status.value = 'error'
  } finally {
    if (requestSequence === sequence) {
      controller = null
    }
  }
}

async function openDeleteModal(): Promise<void> {
  deleteError.value = ''
  isDeleteModalOpen.value = true
  await nextTick()
  deleteCancelButton.value?.focus()
}

function closeDeleteModal(): void {
  if (isDeleting.value) {
    return
  }

  isDeleteModalOpen.value = false
  void nextTick(() => deleteTrigger.value?.focus())
}

function keepFocusInDeleteModal(event: KeyboardEvent): void {
  if (event.shiftKey && document.activeElement === deleteCancelButton.value) {
    event.preventDefault()
    deleteConfirmButton.value?.focus()
  } else if (!event.shiftKey && document.activeElement === deleteConfirmButton.value) {
    event.preventDefault()
    deleteCancelButton.value?.focus()
  }
}

async function deletePost(): Promise<void> {
  const requestedBlogId = blogId.value
  if (requestedBlogId === null || isDeleting.value) {
    return
  }

  isDeleting.value = true
  deleteError.value = ''
  try {
    await blogApi.delete(requestedBlogId)
    await router.push({ name: 'blog' })
  } catch (error: unknown) {
    if (error instanceof ApiHttpError && error.status === 401) {
      deleteError.value = '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    } else if (error instanceof ApiHttpError && error.status === 404) {
      deleteError.value = '글이 없거나 삭제할 권한이 없습니다.'
    } else {
      deleteError.value = '글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    }
  } finally {
    isDeleting.value = false
  }
}

watch(
  () => route.params.blogId,
  () => {
    void loadPost()
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
    <div class="d-flex flex-wrap justify-content-between gap-3 mb-4">
      <RouterLink class="btn btn-outline-secondary" :to="{ name: 'blog' }">목록으로</RouterLink>
      <div v-if="isOwner" class="d-flex gap-2">
        <RouterLink
          class="btn btn-outline-primary"
          :to="{ name: 'blog-edit', params: { blogId: post?.id } }"
        >
          수정
        </RouterLink>
        <button
          ref="deleteTrigger"
          class="btn btn-outline-danger"
          type="button"
          @click="openDeleteModal"
        >
          삭제
        </button>
      </div>
    </div>

    <AsyncState :status="status" :error-message="errorMessage" @retry="loadPost">
      <article v-if="post !== null">
        <div class="d-flex align-items-center gap-3 pb-4 mb-4 border-bottom">
          <img class="author-image" :src="post.author.profileImage" alt="" />
          <div>
            <RouterLink
              class="fw-semibold text-body"
              :to="{ name: 'blog-author', params: { userId: post.author.id } }"
            >
              {{ post.author.nickname }}
            </RouterLink>
            <div class="small text-body-secondary mt-1">
              <time :datetime="post.createdAt">{{ formatDateTime(post.createdAt) }}</time>
              <template v-if="post.updatedAt !== post.createdAt">
                <span aria-hidden="true"> · </span>
                <span>수정 {{ formatDateTime(post.updatedAt) }}</span>
              </template>
            </div>
          </div>
        </div>

        <div v-if="authStatus === 'error'" class="alert alert-warning d-flex gap-3" role="alert">
          <span class="flex-grow-1">로그인 상태를 확인하지 못해 수정 권한을 표시할 수 없습니다.</span>
          <button class="btn btn-sm btn-outline-dark" type="button" @click="loadCurrentUser">
            다시 확인
          </button>
        </div>

        <MarkdownContent :source="post.content" />
      </article>
    </AsyncState>
  </PageScaffold>

  <Teleport to="body">
    <template v-if="isDeleteModalOpen">
      <div
        class="modal fade show d-block"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-blog-title"
        aria-describedby="delete-blog-description"
        @keydown.esc="closeDeleteModal"
        @keydown.tab="keepFocusInDeleteModal"
      >
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h2 id="delete-blog-title" class="modal-title fs-5">블로그 글을 삭제할까요?</h2>
            </div>
            <div class="modal-body">
              <p id="delete-blog-description">삭제한 글은 복구할 수 없습니다.</p>
              <div v-if="deleteError" class="alert alert-danger mb-0" role="alert">
                {{ deleteError }}
              </div>
            </div>
            <div class="modal-footer">
              <button
                ref="deleteCancelButton"
                class="btn btn-secondary"
                type="button"
                :disabled="isDeleting"
                @click="closeDeleteModal"
              >
                취소
              </button>
              <button
                ref="deleteConfirmButton"
                class="btn btn-danger"
                type="button"
                :disabled="isDeleting"
                @click="deletePost"
              >
                {{ isDeleting ? '삭제 중' : '삭제하기' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    </template>
  </Teleport>
</template>

<style scoped>
.author-image {
  width: 3rem;
  height: 3rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 50%;
  object-fit: cover;
}
</style>
