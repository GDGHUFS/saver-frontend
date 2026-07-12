<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { specialDaysApi, type SpecialDay } from '@/api/special-days'
import type { AsyncStatus } from '@/types/async-state'
import {
  differenceInCalendarDays,
  formatKoreanCalendarDate,
  getLocalTodayIsoDate,
  getLocalYearMonth,
  shiftYearMonth,
} from '@/utils/calendar-date'

const MAX_ITEMS = 3
const status = ref<AsyncStatus>('loading')
const items = ref<readonly SpecialDay[]>([])
const today = getLocalTodayIsoDate()
let sequence = 0
let controller: AbortController | null = null

const itemOffsets = computed(() =>
  items.value.map((item) => ({
    dayOffset: differenceInCalendarDays(item.observedDate, today),
    item,
  })),
)

function formatDayOffset(dayOffset: number): string {
  return dayOffset === 0 ? '오늘' : `D-${dayOffset}`
}

async function loadUpcomingDays(): Promise<void> {
  const requestSequence = ++sequence
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  status.value = 'loading'
  items.value = []

  try {
    const currentMonth = getLocalYearMonth()
    const nextMonth = shiftYearMonth(currentMonth, 1)
    const monthlyDays = await Promise.all([
      specialDaysApi.getByMonth(currentMonth, requestController.signal),
      specialDaysApi.getByMonth(nextMonth, requestController.signal),
    ])
    if (requestSequence !== sequence) {
      return
    }

    const upcomingDays = monthlyDays
      .flat()
      .filter((day) => day.observedDate >= today)
      .sort((left, right) =>
        left.observedDate === right.observedDate
          ? left.id - right.id
          : left.observedDate.localeCompare(right.observedDate),
      )
      .slice(0, MAX_ITEMS)
    items.value = upcomingDays
    status.value = upcomingDays.length === 0 ? 'empty' : 'success'
  } catch {
    if (!requestController.signal.aborted && requestSequence === sequence) {
      status.value = 'error'
      requestController.abort()
    }
  } finally {
    if (requestSequence === sequence) {
      controller = null
    }
  }
}

onMounted(() => {
  void loadUpcomingDays()
})

onBeforeUnmount(() => {
  sequence += 1
  controller?.abort()
})
</script>

<template>
  <article class="service-card card h-100" aria-labelledby="upcoming-special-days-title">
    <div class="card-body d-flex flex-column p-4">
      <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
        <h3 id="upcoming-special-days-title" class="h5 mb-0">기념일</h3>
        <RouterLink class="btn btn-sm btn-outline-primary" to="/special-days">
          달력 보기
        </RouterLink>
      </div>

      <div v-if="status === 'loading'" class="py-4 text-center" role="status">
        <span class="spinner-border spinner-border-sm text-primary" aria-hidden="true"></span>
        <span class="visually-hidden">가까운 기념일을 불러오는 중</span>
      </div>

      <div v-else-if="status === 'empty'" class="py-4 text-center text-body-secondary">
        가까운 기념일이 없습니다.
      </div>

      <div v-else-if="status === 'error'" class="alert alert-danger mb-0" role="alert">
        <p class="small mb-2">가까운 기념일을 불러오지 못했습니다.</p>
        <button class="btn btn-sm btn-outline-danger" type="button" @click="loadUpcomingDays">
          다시 시도
        </button>
      </div>

      <ul v-else class="list-group list-group-flush">
        <li v-for="entry in itemOffsets" :key="entry.item.id" class="list-group-item px-0">
          <RouterLink
            class="d-flex justify-content-between align-items-center gap-3 text-decoration-none"
            :to="{
              name: 'special-days',
              query: {
                month: entry.item.observedDate.slice(0, 7),
                date: entry.item.observedDate,
              },
            }"
          >
            <span class="min-width-0">
              <strong class="d-block text-body text-truncate">{{ entry.item.dateName }}</strong>
              <span class="small text-body-secondary">
                {{ formatKoreanCalendarDate(entry.item.observedDate) }} · {{ entry.item.dateKind }}
              </span>
            </span>
            <span
              class="badge rounded-pill"
              :class="entry.item.isHoliday ? 'text-bg-danger' : 'text-bg-light border text-body'"
            >
              {{ formatDayOffset(entry.dayOffset) }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </article>
</template>

<style scoped>
.service-card {
  border-color: var(--bs-border-color);
  border-radius: 0.5rem;
}

.min-width-0 {
  min-width: 0;
}
</style>
