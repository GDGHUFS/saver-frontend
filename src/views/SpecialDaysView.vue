<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiHttpError } from '@/api/client'
import { specialDaysApi, type SpecialDay } from '@/api/special-days'
import AsyncState from '@/components/AsyncState.vue'
import PageScaffold from '@/components/PageScaffold.vue'
import { useCurrentUser } from '@/composables/useCurrentUser'
import type { AsyncStatus } from '@/types/async-state'
import {
  createCalendarWeeks,
  formatKoreanCalendarDate,
  getLocalTodayIsoDate,
  getLocalYearMonth,
  parseYearMonth,
  shiftYearMonth,
} from '@/utils/calendar-date'
import SpecialDayCalendar from '@/views/special-days/SpecialDayCalendar.vue'

const route = useRoute()
const router = useRouter()
const { status: authStatus } = useCurrentUser()
const today = getLocalTodayIsoDate()
const fallbackMonth = getLocalYearMonth()
const currentMonth = ref(fallbackMonth)
const status = ref<AsyncStatus>('loading')
const specialDays = ref<readonly SpecialDay[]>([])
const selectedDate = ref<string | null>(null)
const errorMessage = ref('기념일 정보를 불러오지 못했습니다.')
let sequence = 0
let controller: AbortController | null = null

const monthParts = computed(() => {
  const parsed = parseYearMonth(currentMonth.value)
  if (parsed === null) {
    throw new Error('currentMonth must always be valid')
  }
  return parsed
})
const monthLabel = computed(() => `${monthParts.value.year}년 ${monthParts.value.month}월`)
const calendarWeeks = computed(() => createCalendarWeeks(currentMonth.value))
const canGoPrevious = computed(() => currentMonth.value !== '1000-01')
const canGoNext = computed(() => currentMonth.value !== '9999-12')
const selectedSpecialDays = computed(() =>
  selectedDate.value === null
    ? []
    : specialDays.value.filter((day) => day.observedDate === selectedDate.value),
)
const selectedDateLabel = computed(() =>
  selectedDate.value === null ? '' : formatKoreanCalendarDate(selectedDate.value),
)
const searchSuggestions = computed(() => [
  ...new Set(selectedSpecialDays.value.map((day) => day.dateName)),
])

async function loadSpecialDays(): Promise<void> {
  const requestSequence = ++sequence
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  status.value = 'loading'
  specialDays.value = []
  selectedDate.value = null
  errorMessage.value = '기념일 정보를 불러오지 못했습니다.'

  try {
    const loadedDays = await specialDaysApi.getByMonth(
      currentMonth.value,
      requestController.signal,
    )
    if (requestSequence !== sequence) {
      return
    }
    specialDays.value = loadedDays
    applyRouteSelectedDate(route.query.date)
    status.value = loadedDays.length === 0 ? 'empty' : 'success'
  } catch (error: unknown) {
    if (requestController.signal.aborted || requestSequence !== sequence) {
      return
    }
    if (error instanceof ApiHttpError && error.status === 422) {
      errorMessage.value = '조회할 연월 형식이 올바르지 않습니다.'
    } else if (error instanceof ApiHttpError && error.status === 503) {
      errorMessage.value = '기념일 저장소를 일시적으로 사용할 수 없습니다.'
    }
    status.value = 'error'
  } finally {
    if (requestSequence === sequence) {
      controller = null
    }
  }
}

function isDateInCurrentMonth(value: string): boolean {
  return calendarWeeks.value
    .flat()
    .some((day) => day?.isoDate === value)
}

function applyRouteSelectedDate(routeDate: unknown): void {
  selectedDate.value =
    typeof routeDate === 'string' && isDateInCurrentMonth(routeDate) ? routeDate : null
}

async function selectDate(isoDate: string): Promise<void> {
  selectedDate.value = isoDate
  await router.replace({
    name: 'special-days',
    query: { month: currentMonth.value, date: isoDate },
  })
}

async function moveMonth(offset: number): Promise<void> {
  const nextMonth = shiftYearMonth(currentMonth.value, offset)
  await router.push({ name: 'special-days', query: { month: nextMonth } })
}

async function goToCurrentMonth(): Promise<void> {
  await router.push({ name: 'special-days', query: { month: fallbackMonth } })
}

watch(
  () => route.query.month,
  (routeMonth) => {
    const requestedMonth =
      typeof routeMonth === 'string' && parseYearMonth(routeMonth) !== null
        ? routeMonth
        : fallbackMonth

    if (routeMonth !== undefined && requestedMonth !== routeMonth) {
      void router.replace({ name: 'special-days', query: { month: fallbackMonth } })
      return
    }

    currentMonth.value = requestedMonth
    void loadSpecialDays()
  },
  { immediate: true },
)

watch(
  () => route.query.date,
  (routeDate) => {
    if (status.value !== 'loading') {
      applyRouteSelectedDate(routeDate)
    }
  },
)

onBeforeUnmount(() => {
  sequence += 1
  controller?.abort()
})
</script>

<template>
  <PageScaffold title="기념일">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div class="btn-group" role="group" aria-label="달력 월 이동">
        <button
          class="btn btn-outline-secondary"
          type="button"
          :disabled="!canGoPrevious || status === 'loading'"
          aria-label="이전 달"
          @click="moveMonth(-1)"
        >
          이전
        </button>
        <button
          class="btn btn-outline-secondary"
          type="button"
          :disabled="status === 'loading'"
          @click="goToCurrentMonth"
        >
          오늘
        </button>
        <button
          class="btn btn-outline-secondary"
          type="button"
          :disabled="!canGoNext || status === 'loading'"
          aria-label="다음 달"
          @click="moveMonth(1)"
        >
          다음
        </button>
      </div>
      <h2 class="h4 mb-0" aria-live="polite">{{ monthLabel }}</h2>
    </div>

    <AsyncState
      v-if="status === 'loading' || status === 'error'"
      :status="status"
      :error-message="errorMessage"
      @retry="loadSpecialDays"
    />

    <div v-else class="row g-4 align-items-start">
      <div class="col-12 col-xl-9">
        <div v-if="status === 'empty'" class="alert alert-info" role="status">
          이 달에 등록된 기념일이 없습니다.
        </div>
        <SpecialDayCalendar
          :days="specialDays"
          :month-label="monthLabel"
          :selected-date="selectedDate"
          :today="today"
          :weeks="calendarWeeks"
          @select="selectDate"
        />
        <p class="small text-body-secondary mt-2 mb-0">
          공휴일은 빨간색으로 표시됩니다. 날짜를 선택하면 상세 내용을 확인할 수 있습니다.
        </p>
      </div>

      <aside class="col-12 col-xl-3" aria-labelledby="selected-date-heading">
        <div class="card selected-date-card">
          <div class="card-body">
            <h2 id="selected-date-heading" class="h5">선택한 날짜</h2>
            <p v-if="selectedDate === null" class="text-body-secondary mb-0">
              달력에서 날짜를 선택해 주세요.
            </p>
            <template v-else>
              <p class="fw-semibold mb-3">{{ selectedDateLabel }}</p>
              <p v-if="selectedSpecialDays.length === 0" class="text-body-secondary mb-0">
                등록된 기념일이 없습니다.
              </p>
              <ul v-else class="list-group list-group-flush mb-3">
                <li
                  v-for="specialDay in selectedSpecialDays"
                  :key="specialDay.id"
                  class="list-group-item px-0"
                >
                  <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <strong>{{ specialDay.dateName }}</strong>
                    <span v-if="specialDay.isHoliday" class="badge text-bg-danger">공휴일</span>
                  </div>
                  <span class="small text-body-secondary">{{ specialDay.dateKind }}</span>
                </li>
              </ul>

              <div v-if="selectedSpecialDays.length > 0" class="border-top pt-3">
                <h3 class="h6">검색 제안</h3>
                <div v-if="authStatus === 'success'" class="d-grid gap-2">
                  <RouterLink
                    v-for="suggestion in searchSuggestions"
                    :key="suggestion"
                    class="btn btn-sm btn-outline-primary text-start"
                    :to="{ name: 'search', query: { q: suggestion } }"
                  >
                    {{ suggestion }} 검색
                  </RouterLink>
                </div>
                <p v-else-if="authStatus === 'empty'" class="small text-body-secondary mb-0">
                  로그인하면 이 기념일을 바로 검색할 수 있습니다.
                </p>
                <p v-else-if="authStatus === 'error'" class="small text-body-secondary mb-0">
                  로그인 상태를 확인하지 못해 검색 제안을 표시할 수 없습니다.
                </p>
                <p v-else class="small text-body-secondary mb-0" role="status">
                  검색 제안을 준비하고 있습니다.
                </p>
              </div>
            </template>
          </div>
        </div>
      </aside>
    </div>
  </PageScaffold>
</template>

<style scoped>
.selected-date-card {
  border-color: var(--bs-border-color);
}

@media (min-width: 1200px) {
  .selected-date-card {
    position: sticky;
    top: 1rem;
  }
}
</style>
