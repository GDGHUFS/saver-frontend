<script setup lang="ts">
import { computed } from 'vue'

import type { SpecialDay } from '@/api/special-days'
import type { CalendarDay } from '@/utils/calendar-date'

const props = defineProps<{
  days: readonly SpecialDay[]
  monthLabel: string
  selectedDate: string | null
  today: string
  weeks: readonly (readonly (CalendarDay | null)[])[]
}>()

defineEmits<{
  select: [isoDate: string]
}>()

const weekdays = ['일', '월', '화', '수', '목', '금', '토'] as const
const daysByDate = computed(() => {
  const grouped = new Map<string, SpecialDay[]>()
  for (const specialDay of props.days) {
    const dateDays = grouped.get(specialDay.observedDate) ?? []
    dateDays.push(specialDay)
    grouped.set(specialDay.observedDate, dateDays)
  }
  return grouped
})

function getSpecialDays(isoDate: string): readonly SpecialDay[] {
  return daysByDate.value.get(isoDate) ?? []
}

function getDateLabel(day: CalendarDay): string {
  const specialDays = getSpecialDays(day.isoDate)
  const specialDayLabel = specialDays.map((item) => item.dateName).join(', ')
  return specialDayLabel.length > 0
    ? `${day.isoDate}, ${specialDayLabel}`
    : day.isoDate
}

function isHoliday(isoDate: string): boolean {
  return getSpecialDays(isoDate).some((item) => item.isHoliday)
}
</script>

<template>
  <div class="calendar-frame border rounded bg-white overflow-hidden">
    <table class="calendar-table table table-bordered mb-0">
      <caption class="visually-hidden">{{ monthLabel }} 기념일 달력</caption>
      <thead>
        <tr>
          <th
            v-for="(weekday, index) in weekdays"
            :key="weekday"
            class="calendar-weekday text-center small"
            :class="{ 'text-danger': index === 0, 'text-primary': index === 6 }"
            scope="col"
          >
            {{ weekday }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(week, weekIndex) in weeks" :key="weekIndex">
          <td
            v-for="(day, dayIndex) in week"
            :key="day?.isoDate ?? `empty-${weekIndex}-${dayIndex}`"
            class="calendar-cell p-0"
          >
            <button
              v-if="day !== null"
              class="calendar-day btn w-100 h-100 rounded-0 text-start"
              :class="{
                'calendar-day-selected': selectedDate === day.isoDate,
                'calendar-day-today': today === day.isoDate,
                'text-danger': day.weekday === 0 || isHoliday(day.isoDate),
                'text-primary': day.weekday === 6 && !isHoliday(day.isoDate),
              }"
              type="button"
              :aria-label="getDateLabel(day)"
              :aria-pressed="selectedDate === day.isoDate"
              @click="$emit('select', day.isoDate)"
            >
              <span class="d-flex justify-content-between align-items-start gap-1">
                <span class="day-number" :class="{ 'today-number': today === day.isoDate }">
                  {{ day.day }}
                </span>
                <span
                  v-if="getSpecialDays(day.isoDate).length > 0"
                  class="special-dot d-md-none"
                  aria-hidden="true"
                ></span>
              </span>
              <span class="special-labels d-none d-md-flex flex-column gap-1 mt-2">
                <span
                  v-for="specialDay in getSpecialDays(day.isoDate).slice(0, 2)"
                  :key="specialDay.id"
                  class="badge text-start text-truncate"
                  :class="specialDay.isHoliday ? 'text-bg-danger' : 'text-bg-light border text-body'"
                >
                  {{ specialDay.dateName }}
                </span>
                <span
                  v-if="getSpecialDays(day.isoDate).length > 2"
                  class="small text-body-secondary"
                >
                  +{{ getSpecialDays(day.isoDate).length - 2 }}개
                </span>
              </span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.calendar-table {
  table-layout: fixed;
}

.calendar-weekday {
  padding-block: 0.75rem;
  background: var(--bs-tertiary-bg);
}

.calendar-cell {
  height: 7.25rem;
  background: var(--bs-body-bg);
}

.calendar-day {
  position: relative;
  padding: 0.6rem;
  border: 0;
}

.calendar-day:hover,
.calendar-day:focus-visible {
  z-index: 1;
  background: var(--bs-tertiary-bg);
  box-shadow: inset 0 0 0 2px var(--bs-primary);
}

.calendar-day-selected {
  background: var(--bs-primary-bg-subtle);
  box-shadow: inset 0 0 0 2px var(--bs-primary);
}

.calendar-day-today:not(.calendar-day-selected) {
  box-shadow: inset 0 0 0 2px var(--bs-warning);
}

.today-number {
  display: inline-grid;
  width: 1.75rem;
  height: 1.75rem;
  color: var(--bs-dark);
  background: var(--bs-warning);
  border-radius: 50%;
  place-items: center;
}

.special-dot {
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.35rem;
  background: var(--bs-primary);
  border-radius: 50%;
}

.special-labels .badge {
  max-width: 100%;
  font-weight: 500;
}

@media (max-width: 767.98px) {
  .calendar-weekday {
    padding-block: 0.5rem;
  }

  .calendar-cell {
    height: 4rem;
  }

  .calendar-day {
    padding: 0.35rem;
    text-align: center !important;
  }

  .day-number {
    margin-inline: auto;
  }
}
</style>
