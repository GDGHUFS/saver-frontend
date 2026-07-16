<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { WeatherForecastResponse, WeatherGridForecast } from '@/api/weather'
import { formatDateTime } from '@/utils/date-time'
import { formatTemperature, formatWeatherLocation, getWeatherLabel } from '@/utils/weather'
import WeatherIcon from '@/views/weather/WeatherIcon.vue'

const props = defineProps<{
  forecast: WeatherForecastResponse
}>()

const selectedGridIndex = ref(0)
const selectedGrid = computed(
  () => props.forecast.items[selectedGridIndex.value] ?? props.forecast.items[0],
)
const firstForecast = computed(() => selectedGrid.value?.forecasts[0] ?? null)

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  day: 'numeric',
  month: 'numeric',
  weekday: 'short',
})
const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  hour12: false,
})

function gridLabel(gridForecast: WeatherGridForecast): string {
  const firstLocation = gridForecast.locations[0]
  if (firstLocation === undefined) {
    return `격자 ${gridForecast.grid.nx}, ${gridForecast.grid.ny}`
  }
  const suffix = gridForecast.locations.length > 1 ? ` 외 ${gridForecast.locations.length - 1}곳` : ''
  return `${formatWeatherLocation(firstLocation)}${suffix}`
}

function formatForecastDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

function formatForecastTime(value: string): string {
  return timeFormatter.format(new Date(value))
}

function formatPercentage(value: string | null): string {
  return value === null ? '–' : `${value}%`
}

watch(
  () => props.forecast,
  () => {
    selectedGridIndex.value = 0
  },
)
</script>

<template>
  <section class="forecast-panel card border-0 shadow-sm" aria-labelledby="forecast-title">
    <div class="card-body p-4 p-lg-5">
      <div class="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
        <div>
          <p class="text-primary fw-semibold mb-1">단기예보</p>
          <h2 id="forecast-title" class="h4 mb-1">
            {{ selectedGrid === undefined ? '선택한 지역' : gridLabel(selectedGrid) }}
          </h2>
          <p v-if="selectedGrid !== undefined" class="small text-body-secondary mb-0">
            {{ formatDateTime(selectedGrid.issuedAt) }} 발표
          </p>
        </div>
        <div v-if="forecast.items.length > 1" class="grid-picker">
          <label class="form-label small" for="weather-grid">일치하는 지역</label>
          <select id="weather-grid" v-model="selectedGridIndex" class="form-select">
            <option v-for="(item, index) in forecast.items" :key="`${item.grid.nx}-${item.grid.ny}`" :value="index">
              {{ gridLabel(item) }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="firstForecast !== null" class="current-summary rounded-4 p-4 mb-4">
        <div class="d-flex flex-wrap align-items-center gap-3 gap-md-4">
          <span class="summary-icon">
            <WeatherIcon
              :precipitation-type-label="firstForecast.precipitationTypeLabel"
              :sky-status-label="firstForecast.skyStatusLabel"
            />
          </span>
          <div class="me-auto">
            <p class="display-6 fw-bold mb-0">{{ formatTemperature(firstForecast.temperature) }}</p>
            <p class="h5 mb-0">{{ getWeatherLabel(firstForecast) }}</p>
          </div>
          <dl class="weather-details row row-cols-2 g-3 mb-0">
            <div class="col">
              <dt>강수확률</dt>
              <dd>{{ formatPercentage(firstForecast.precipitationProbability) }}</dd>
            </div>
            <div class="col">
              <dt>습도</dt>
              <dd>{{ formatPercentage(firstForecast.humidity) }}</dd>
            </div>
            <div class="col">
              <dt>강수량</dt>
              <dd>{{ firstForecast.precipitationAmount ?? '–' }}</dd>
            </div>
            <div class="col">
              <dt>풍속</dt>
              <dd>{{ firstForecast.windSpeed === null ? '–' : `${firstForecast.windSpeed} m/s` }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div v-if="selectedGrid !== undefined" class="hourly-forecast" tabindex="0" aria-label="시간대별 예보">
        <article
          v-for="item in selectedGrid.forecasts"
          :key="item.forecastAt"
          class="hour-card card flex-shrink-0 text-center"
        >
          <div class="card-body px-3 py-3">
            <p class="small text-body-secondary mb-1">{{ formatForecastDate(item.forecastAt) }}</p>
            <p class="fw-semibold mb-2">{{ formatForecastTime(item.forecastAt) }}</p>
            <div class="hour-icon mx-auto mb-2">
              <WeatherIcon
                :precipitation-type-label="item.precipitationTypeLabel"
                :sky-status-label="item.skyStatusLabel"
              />
            </div>
            <p class="h5 mb-1">{{ formatTemperature(item.temperature) }}</p>
            <p class="small text-body-secondary mb-1">{{ getWeatherLabel(item) }}</p>
            <p class="small text-primary mb-0">
              강수 {{ formatPercentage(item.precipitationProbability) }}
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.forecast-panel {
  overflow: hidden;
}

.grid-picker {
  width: min(100%, 24rem);
}

.current-summary {
  background: linear-gradient(120deg, #e8f5ff, #f4f9ff 60%, #fff7df);
  border: 1px solid #cfe6f6;
}

.summary-icon {
  width: 5.5rem;
  height: 5.5rem;
  flex: 0 0 auto;
}

.weather-details {
  width: min(100%, 24rem);
}

.weather-details dt {
  color: var(--bs-secondary-color);
  font-size: 0.75rem;
  font-weight: 500;
}

.weather-details dd {
  margin-bottom: 0;
  font-weight: 600;
}

.hourly-forecast {
  display: flex;
  gap: 0.75rem;
  padding: 0.25rem 0.15rem 0.75rem;
  overflow-x: auto;
  scroll-snap-type: x proximity;
}

.hourly-forecast:focus-visible {
  outline: 3px solid rgb(var(--bs-primary-rgb) / 0.35);
  outline-offset: 3px;
}

.hour-card {
  width: 9rem;
  border-color: var(--bs-border-color-translucent);
  scroll-snap-align: start;
}

.hour-icon {
  width: 3.5rem;
  height: 3.5rem;
}
</style>
