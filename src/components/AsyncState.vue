<script setup lang="ts">
import type { AsyncStatus } from '@/types/async-state'

withDefaults(
  defineProps<{
    status: AsyncStatus
    emptyMessage?: string
    errorMessage?: string
  }>(),
  {
    emptyMessage: '표시할 내용이 없습니다.',
    errorMessage: '정보를 불러오지 못했습니다.',
  },
)

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div v-if="status === 'loading'" class="py-5 text-center" role="status" aria-live="polite">
    <div class="spinner-border text-primary" aria-hidden="true"></div>
    <span class="visually-hidden">불러오는 중</span>
  </div>

  <div v-else-if="status === 'empty'" class="py-5 text-center text-body-secondary">
    <p class="mb-0">{{ emptyMessage }}</p>
  </div>

  <div v-else-if="status === 'error'" class="alert alert-danger" role="alert">
    <p class="mb-3">{{ errorMessage }}</p>
    <button class="btn btn-outline-danger btn-sm" type="button" @click="$emit('retry')">
      다시 시도
    </button>
  </div>

  <slot v-else />
</template>
