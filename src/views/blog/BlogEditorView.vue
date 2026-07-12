<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { BlogCreationLocationError, blogApi, type BlogPost } from '@/api/blog'
import { ApiHttpError, ApiResponseError } from '@/api/client'
import AsyncState from '@/components/AsyncState.vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import PageScaffold from '@/components/PageScaffold.vue'
import { useCurrentUser } from '@/composables/useCurrentUser'
import type { AsyncStatus } from '@/types/async-state'
import { parsePositiveRouteParam } from '@/utils/route-params'

const route = useRoute()
const router = useRouter()
const { load: loadCurrentUser, status: authStatus, user } = useCurrentUser()
const existingStatus = ref<AsyncStatus>('loading')
const existingPost = ref<BlogPost | null>(null)
const loadErrorMessage = ref('수정할 글을 불러오지 못했습니다.')
const title = ref('')
const content = ref('')
const validationError = ref('')
const submitError = ref('')
const isSubmitting = ref(false)
const hasUnlocatedCreation = ref(false)
let sequence = 0
let controller: AbortController | null = null

const isEdit = computed(() => route.name === 'blog-edit')
const blogId = computed(() => parsePositiveRouteParam(route.params.blogId))
const pageTitle = computed(() => (isEdit.value ? '블로그 글 수정' : '새 블로그 글'))
const canEdit = computed(
  () =>
    !isEdit.value ||
    (user.value !== null &&
      existingPost.value !== null &&
      user.value.id === existingPost.value.author.id),
)
const cancelTarget = computed(() => {
  const requestedBlogId = blogId.value
  return isEdit.value && requestedBlogId !== null
    ? { name: 'blog-detail', params: { blogId: requestedBlogId } }
    : { name: 'blog' }
})

async function loadExistingPost(): Promise<void> {
  if (!isEdit.value) {
    existingStatus.value = 'success'
    existingPost.value = null
    title.value = ''
    content.value = ''
    return
  }

  const requestSequence = ++sequence
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  existingStatus.value = 'loading'
  existingPost.value = null
  loadErrorMessage.value = '수정할 글을 불러오지 못했습니다.'

  try {
    const requestedBlogId = blogId.value
    if (requestedBlogId === null) {
      throw new RangeError('invalid blog id')
    }

    const loadedPost = await blogApi.getById(requestedBlogId, requestController.signal)
    if (requestSequence !== sequence) {
      return
    }

    existingPost.value = loadedPost
    title.value = loadedPost.title
    content.value = loadedPost.content
    existingStatus.value = 'success'
  } catch (error: unknown) {
    if (requestController.signal.aborted || requestSequence !== sequence) {
      return
    }

    if (error instanceof RangeError) {
      loadErrorMessage.value = '유효하지 않은 블로그 글 주소입니다.'
    } else if (error instanceof ApiHttpError && error.status === 404) {
      loadErrorMessage.value = '수정할 블로그 글을 찾을 수 없습니다.'
    }
    existingStatus.value = 'error'
  } finally {
    if (requestSequence === sequence) {
      controller = null
    }
  }
}

function validate(): boolean {
  const normalizedTitle = title.value.trim()
  const normalizedContent = content.value.trim()

  if (normalizedTitle.length === 0) {
    validationError.value = '제목을 입력해 주세요.'
    return false
  }
  if (normalizedTitle.length > 300) {
    validationError.value = '제목은 300자 이하로 입력해 주세요.'
    return false
  }
  if (normalizedContent.length === 0) {
    validationError.value = '본문을 입력해 주세요.'
    return false
  }

  validationError.value = ''
  return true
}

async function submit(): Promise<void> {
  if (
    isSubmitting.value ||
    hasUnlocatedCreation.value ||
    authStatus.value !== 'success' ||
    !canEdit.value ||
    !validate()
  ) {
    return
  }

  isSubmitting.value = true
  submitError.value = ''
  const input = { title: title.value.trim(), content: content.value.trim() }

  try {
    if (isEdit.value) {
      const requestedBlogId = blogId.value
      if (requestedBlogId === null) {
        throw new RangeError('invalid blog id')
      }
      await blogApi.update(requestedBlogId, input)
      await router.push({ name: 'blog-detail', params: { blogId: requestedBlogId } })
    } else {
      const created = await blogApi.create(input)
      await router.push(created.location)
    }
  } catch (error: unknown) {
    if (error instanceof ApiHttpError && error.status === 401) {
      submitError.value = '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    } else if (error instanceof ApiHttpError && error.status === 404) {
      submitError.value = '글이 없거나 수정할 권한이 없습니다.'
    } else if (error instanceof ApiHttpError && error.status === 422) {
      submitError.value = '제목 또는 본문 형식을 확인해 주세요.'
    } else if (
      !isEdit.value &&
      error instanceof ApiResponseError &&
      error.cause instanceof BlogCreationLocationError
    ) {
      hasUnlocatedCreation.value = true
      submitError.value =
        '글은 작성되었지만 생성된 주소를 확인할 수 없습니다. 목록에서 작성한 글을 확인해 주세요.'
    } else {
      submitError.value = isEdit.value
        ? '글을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        : '글을 작성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    }
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => route.fullPath,
  () => {
    void loadExistingPost()
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
    <AsyncState v-if="authStatus === 'loading'" status="loading" />

    <div v-else-if="authStatus === 'empty'" class="alert alert-warning" role="alert">
      <p>블로그 글을 작성하거나 수정하려면 로그인이 필요합니다.</p>
      <RouterLink class="btn btn-outline-dark" to="/">로그인하러 가기</RouterLink>
    </div>

    <div v-else-if="authStatus === 'error'" class="alert alert-danger" role="alert">
      <p>로그인 상태를 확인하지 못했습니다.</p>
      <button class="btn btn-outline-danger" type="button" @click="loadCurrentUser">
        다시 시도
      </button>
    </div>

    <AsyncState
      v-else-if="isEdit && existingStatus !== 'success'"
      :status="existingStatus"
      :error-message="loadErrorMessage"
      @retry="loadExistingPost"
    />

    <div v-else-if="!canEdit" class="alert alert-danger" role="alert">
      이 글을 수정할 권한이 없습니다.
    </div>

    <form v-else @submit.prevent="submit">
      <div v-if="validationError" class="alert alert-warning" role="alert">
        {{ validationError }}
      </div>
      <div v-if="submitError" class="alert alert-danger" role="alert">
        <p class="mb-0">{{ submitError }}</p>
        <RouterLink v-if="hasUnlocatedCreation" class="btn btn-sm btn-outline-danger mt-3" to="/blog">
          블로그 목록으로
        </RouterLink>
      </div>

      <div class="mb-4">
        <label class="form-label fw-semibold" for="blog-title">제목</label>
        <input
          id="blog-title"
          v-model="title"
          class="form-control"
          name="title"
          maxlength="300"
          required
          :disabled="isSubmitting"
        />
        <div class="form-text text-end">{{ title.length }} / 300</div>
      </div>

      <div class="row g-4">
        <div class="col-12 col-lg-6">
          <label class="form-label fw-semibold" for="blog-content">본문</label>
          <textarea
            id="blog-content"
            v-model="content"
            class="form-control blog-editor"
            name="content"
            rows="20"
            required
            :disabled="isSubmitting"
            aria-describedby="blog-content-help"
          ></textarea>
          <div id="blog-content-help" class="form-text">
            Markdown 서식을 사용할 수 있습니다. 입력한 HTML은 실행되지 않고 일반 텍스트로 표시됩니다.
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <h2 class="h6 fw-semibold">미리보기</h2>
          <div class="preview-panel border rounded p-3 bg-white">
            <MarkdownContent v-if="content.trim().length > 0" :source="content" />
            <p v-else class="text-body-secondary mb-0">본문을 입력하면 미리보기가 표시됩니다.</p>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-end gap-2 mt-4">
        <RouterLink class="btn btn-outline-secondary" :to="cancelTarget">취소</RouterLink>
        <button
          class="btn btn-primary"
          type="submit"
          :disabled="isSubmitting || hasUnlocatedCreation"
        >
          {{ isSubmitting ? '저장 중' : isEdit ? '전체 내용 수정' : '글 작성' }}
        </button>
      </div>
    </form>
  </PageScaffold>
</template>

<style scoped>
.blog-editor,
.preview-panel {
  min-height: 30rem;
}

.blog-editor {
  resize: vertical;
  font-family: var(--bs-font-monospace);
}
</style>
