<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import {
  weatherApi,
  type WeatherLocationCatalog,
  type WeatherRegionOption,
} from '@/api/weather'
import type { AsyncStatus } from '@/types/async-state'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  search: [region: string]
}>()

const level1Catalog = ref<WeatherLocationCatalog | null>(null)
const level2Catalog = ref<WeatherLocationCatalog | null>(null)
const level3Catalog = ref<WeatherLocationCatalog | null>(null)
const level1Status = ref<AsyncStatus>('loading')
const level2Status = ref<AsyncStatus>('empty')
const level3Status = ref<AsyncStatus>('empty')
const selectedLevel1 = ref('')
const selectedLevel2 = ref('')
const selectedLevel3 = ref('')

let level1Controller: AbortController | null = null
let level2Controller: AbortController | null = null
let level3Controller: AbortController | null = null
let level2Sequence = 0
let level3Sequence = 0

function findOption(
  catalog: WeatherLocationCatalog | null,
  name: string,
): WeatherRegionOption | null {
  return catalog?.items.find((option) => option.name === name) ?? null
}

const level1Option = computed(() => findOption(level1Catalog.value, selectedLevel1.value))
const level2Option = computed(() => findOption(level2Catalog.value, selectedLevel2.value))
const level3Option = computed(() => findOption(level3Catalog.value, selectedLevel3.value))
const selectedOption = computed(
  () => level3Option.value ?? level2Option.value ?? level1Option.value,
)

async function loadLevel1(): Promise<void> {
  level1Controller?.abort()
  const controller = new AbortController()
  level1Controller = controller
  level1Status.value = 'loading'
  try {
    const catalog = await weatherApi.getLocations({ signal: controller.signal })
    level1Catalog.value = catalog
    level1Status.value = catalog.items.length === 0 ? 'empty' : 'success'
  } catch {
    if (!controller.signal.aborted) level1Status.value = 'error'
  } finally {
    if (level1Controller === controller) level1Controller = null
  }
}

async function loadLevel2(regionLevel1: string): Promise<void> {
  const requestSequence = ++level2Sequence
  level2Controller?.abort()
  const controller = new AbortController()
  level2Controller = controller
  level2Status.value = 'loading'
  try {
    const catalog = await weatherApi.getLocations({ regionLevel1, signal: controller.signal })
    if (requestSequence !== level2Sequence) return
    level2Catalog.value = catalog
    level2Status.value = catalog.items.length === 0 ? 'empty' : 'success'
  } catch {
    if (!controller.signal.aborted && requestSequence === level2Sequence) {
      level2Status.value = 'error'
    }
  } finally {
    if (requestSequence === level2Sequence) level2Controller = null
  }
}

async function loadLevel3(regionLevel1: string, regionLevel2: string): Promise<void> {
  const requestSequence = ++level3Sequence
  level3Controller?.abort()
  const controller = new AbortController()
  level3Controller = controller
  level3Status.value = 'loading'
  try {
    const catalog = await weatherApi.getLocations({
      regionLevel1,
      regionLevel2,
      signal: controller.signal,
    })
    if (requestSequence !== level3Sequence) return
    level3Catalog.value = catalog
    level3Status.value = catalog.items.length === 0 ? 'empty' : 'success'
  } catch {
    if (!controller.signal.aborted && requestSequence === level3Sequence) {
      level3Status.value = 'error'
    }
  } finally {
    if (requestSequence === level3Sequence) level3Controller = null
  }
}

function changeLevel1(): void {
  level2Sequence += 1
  level3Sequence += 1
  level2Controller?.abort()
  level3Controller?.abort()
  level2Catalog.value = null
  level3Catalog.value = null
  level2Status.value = 'empty'
  level3Status.value = 'empty'
  selectedLevel2.value = ''
  selectedLevel3.value = ''
  if (level1Option.value?.hasChildren === true) {
    void loadLevel2(level1Option.value.name)
  }
}

function changeLevel2(): void {
  level3Sequence += 1
  level3Controller?.abort()
  level3Catalog.value = null
  level3Status.value = 'empty'
  selectedLevel3.value = ''
  if (level1Option.value !== null && level2Option.value?.hasChildren === true) {
    void loadLevel3(level1Option.value.name, level2Option.value.name)
  }
}

function retryLevel2(): void {
  if (level1Option.value !== null) void loadLevel2(level1Option.value.name)
}

function retryLevel3(): void {
  if (level1Option.value !== null && level2Option.value !== null) {
    void loadLevel3(level1Option.value.name, level2Option.value.name)
  }
}

function submit(): void {
  if (selectedOption.value !== null) emit('search', selectedOption.value.fullName)
}

onMounted(() => void loadLevel1())
onBeforeUnmount(() => {
  level2Sequence += 1
  level3Sequence += 1
  level1Controller?.abort()
  level2Controller?.abort()
  level3Controller?.abort()
})
</script>

<template>
  <form class="card border-0 shadow-sm h-100" aria-labelledby="region-search-title" @submit.prevent="submit">
    <div class="card-body p-4">
      <h2 id="region-search-title" class="h5 mb-2">지역명으로 날씨 검색</h2>
      <p class="small text-body-secondary mb-4">
        시·도부터 원하는 범위까지 선택해 정확한 지역명으로 조회하세요.
      </p>

      <div v-if="level1Status === 'loading'" class="py-3 text-center" role="status">
        <span class="spinner-border spinner-border-sm text-primary" aria-hidden="true"></span>
        <span class="ms-2">지역 목록을 불러오는 중입니다.</span>
      </div>
      <div v-else-if="level1Status === 'error'" class="alert alert-warning" role="alert">
        <p class="small mb-2">지역 목록을 불러오지 못했습니다.</p>
        <button class="btn btn-sm btn-outline-dark" type="button" @click="loadLevel1">
          다시 시도
        </button>
      </div>
      <p v-else-if="level1Status === 'empty'" class="text-body-secondary">
        선택할 수 있는 지역이 없습니다.
      </p>
      <div v-else class="row g-3">
        <div class="col-12 col-sm-4">
          <label class="form-label" for="weather-region-level-1">시·도</label>
          <select
            id="weather-region-level-1"
            v-model="selectedLevel1"
            class="form-select"
            :disabled="disabled"
            @change="changeLevel1"
          >
            <option value="">선택</option>
            <option v-for="option in level1Catalog?.items" :key="option.fullName" :value="option.name">
              {{ option.name }}
            </option>
          </select>
        </div>

        <div v-if="level1Option?.hasChildren === true" class="col-12 col-sm-4">
          <label class="form-label" for="weather-region-level-2">시·군·구</label>
          <select
            id="weather-region-level-2"
            v-model="selectedLevel2"
            class="form-select"
            :disabled="disabled || level2Status !== 'success'"
            @change="changeLevel2"
          >
            <option value="">
              {{ level2Status === 'loading' ? '불러오는 중' : '선택' }}
            </option>
            <option v-for="option in level2Catalog?.items" :key="option.fullName" :value="option.name">
              {{ option.name }}
            </option>
          </select>
          <button
            v-if="level2Status === 'error'"
            class="btn btn-link btn-sm px-0"
            type="button"
            @click="retryLevel2"
          >
            목록 다시 불러오기
          </button>
          <span v-else-if="level2Status === 'empty'" class="d-block form-text">
            하위 지역이 없습니다.
          </span>
        </div>

        <div v-if="level2Option?.hasChildren === true" class="col-12 col-sm-4">
          <label class="form-label" for="weather-region-level-3">읍·면·동</label>
          <select
            id="weather-region-level-3"
            v-model="selectedLevel3"
            class="form-select"
            :disabled="disabled || level3Status !== 'success'"
          >
            <option value="">
              {{ level3Status === 'loading' ? '불러오는 중' : '선택' }}
            </option>
            <option v-for="option in level3Catalog?.items" :key="option.fullName" :value="option.name">
              {{ option.name }}
            </option>
          </select>
          <button
            v-if="level3Status === 'error'"
            class="btn btn-link btn-sm px-0"
            type="button"
            @click="retryLevel3"
          >
            목록 다시 불러오기
          </button>
          <span v-else-if="level3Status === 'empty'" class="d-block form-text">
            하위 지역이 없습니다.
          </span>
        </div>
      </div>
    </div>
    <div class="card-footer border-0 bg-transparent px-4 pb-4 pt-0">
      <button
        class="btn btn-primary"
        type="submit"
        :disabled="disabled || selectedOption === null"
      >
        선택한 지역 날씨 보기
      </button>
      <span v-if="selectedOption !== null" class="small text-body-secondary ms-3">
        {{ selectedOption.fullName }}
      </span>
    </div>
  </form>
</template>
