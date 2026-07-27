<script setup lang="ts">
import type { SearchMode } from '@/types/search-mode'

interface Props {
  centered?: boolean
  idPrefix: string
  modelValue: SearchMode
}

withDefaults(defineProps<Props>(), {
  centered: false,
})

const emit = defineEmits<{
  'update:modelValue': [mode: SearchMode]
}>()

function selectMode(mode: SearchMode): void {
  emit('update:modelValue', mode)
}
</script>

<template>
  <fieldset>
    <legend class="visually-hidden">검색 방식</legend>
    <div
      class="d-flex flex-wrap align-items-center gap-2"
      :class="{ 'justify-content-center': centered }"
    >
      <span class="small fw-semibold text-body-secondary me-1" aria-hidden="true">
        검색 방식
      </span>
      <input
        :id="`${idPrefix}-search-mode-portal`"
        class="btn-check"
        type="radio"
        :name="`${idPrefix}-search-mode`"
        value="portal"
        :checked="modelValue === 'portal'"
        @change="selectMode('portal')"
      />
      <label
        class="btn btn-sm btn-outline-secondary rounded-pill"
        :for="`${idPrefix}-search-mode-portal`"
      >
        포털 검색
      </label>
      <input
        :id="`${idPrefix}-search-mode-research`"
        class="btn-check"
        type="radio"
        :name="`${idPrefix}-search-mode`"
        value="research"
        :checked="modelValue === 'research'"
        @change="selectMode('research')"
      />
      <label
        class="btn btn-sm btn-outline-primary rounded-pill"
        :for="`${idPrefix}-search-mode-research`"
      >
        자체 검색엔진
        <span class="badge text-bg-primary ms-1">실험</span>
      </label>
    </div>
  </fieldset>
</template>
