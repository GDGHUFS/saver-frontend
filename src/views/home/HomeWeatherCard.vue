<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { ApiHttpError } from '@/api/client'
import {
  WEATHER_HOME_FORECAST_HOURS,
  weatherApi,
  type WeatherForecastResponse,
} from '@/api/weather'
import { useCurrentLocation } from '@/composables/useCurrentLocation'
import type { AsyncStatus } from '@/types/async-state'
import {
  formatTemperature,
  formatWeatherLocation,
  getWeatherLabel,
} from '@/utils/weather'
import WeatherIcon from '@/views/weather/WeatherIcon.vue'

const currentLocation = useCurrentLocation()
const forecast = ref<WeatherForecastResponse | null>(null)
const forecastStatus = ref<AsyncStatus>('empty')
const forecastMessage = ref('')
const checkingPermission = computed(() => currentLocation.status.value === 'checking')
const locating = computed(() => currentLocation.status.value === 'requesting')
const currentGrid = computed(() => forecast.value?.items[0] ?? null)
const currentForecast = computed(() => currentGrid.value?.forecasts[0] ?? null)
const currentLocationLabel = computed(() => {
  const location = currentGrid.value?.locations[0]
  return location === undefined ? '현재 위치' : formatWeatherLocation(location)
})
const hourFormatter = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', hour12: false })

let controller: AbortController | null = null
let sequence = 0
let disposed = false

async function loadForecast(latitude: number, longitude: number): Promise<void> {
  const requestSequence = ++sequence
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  forecastStatus.value = 'loading'
  forecastMessage.value = ''
  try {
    const response = await weatherApi.getForecast({
      hours: WEATHER_HOME_FORECAST_HOURS,
      latitude,
      longitude,
      signal: requestController.signal,
    })
    if (requestSequence !== sequence) return
    forecast.value = response
    forecastStatus.value = 'success'
  } catch (error: unknown) {
    if (requestController.signal.aborted || requestSequence !== sequence) return
    forecast.value = null
    if (error instanceof ApiHttpError && error.status === 404) {
      forecastStatus.value = 'empty'
      forecastMessage.value = '현재 위치의 예보가 아직 제공되지 않습니다.'
    } else if (error instanceof RangeError) {
      forecastStatus.value = 'empty'
      forecastMessage.value = '현재 위치가 국내 날씨 제공 범위를 벗어났습니다.'
    } else {
      forecastStatus.value = 'error'
      forecastMessage.value = '현재 위치 날씨를 불러오지 못했습니다.'
    }
  } finally {
    if (requestSequence === sequence) controller = null
  }
}

async function requestLocation(): Promise<void> {
  const coordinates = await currentLocation.requestCurrentLocation()
  if (coordinates !== null && !disposed) {
    await loadForecast(coordinates.latitude, coordinates.longitude)
  }
}

async function loadGrantedLocation(): Promise<void> {
  const coordinates = await currentLocation.useGrantedLocation()
  if (coordinates !== null && !disposed) {
    await loadForecast(coordinates.latitude, coordinates.longitude)
  }
}

function retryForecast(): void {
  const coordinates = currentLocation.coordinates.value
  if (coordinates !== null) void loadForecast(coordinates.latitude, coordinates.longitude)
}

function formatForecastHour(value: string): string {
  return hourFormatter.format(new Date(value))
}

onMounted(() => void loadGrantedLocation())
onBeforeUnmount(() => {
  disposed = true
  sequence += 1
  controller?.abort()
})
</script>

<template>
  <article class="service-card weather-card card h-100" aria-labelledby="home-weather-title">
    <div class="card-body d-flex flex-column p-4">
      <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
        <h3 id="home-weather-title" class="h5 mb-0">날씨</h3>
        <RouterLink class="btn btn-sm btn-outline-primary" to="/weather">전국 날씨</RouterLink>
      </div>

      <div v-if="checkingPermission || forecastStatus === 'loading'" class="py-4 text-center" role="status">
        <span class="spinner-border spinner-border-sm text-primary" aria-hidden="true"></span>
        <span class="visually-hidden">현재 위치 날씨를 불러오는 중</span>
      </div>

      <template v-else-if="forecastStatus === 'success' && currentForecast !== null">
        <div class="d-flex align-items-center gap-3 mb-3">
          <span class="home-weather-icon">
            <WeatherIcon
              :precipitation-type-label="currentForecast.precipitationTypeLabel"
              :sky-status-label="currentForecast.skyStatusLabel"
            />
          </span>
          <div>
            <p class="small fw-semibold text-primary mb-0">{{ currentLocationLabel }}</p>
            <p class="h3 fw-bold mb-0">{{ formatTemperature(currentForecast.temperature) }}</p>
            <p class="text-body-secondary mb-0">{{ getWeatherLabel(currentForecast) }}</p>
          </div>
        </div>
        <div v-if="currentGrid !== null" class="d-flex gap-2 overflow-x-auto pb-2" aria-label="단기 날씨">
          <div
            v-for="item in currentGrid.forecasts.slice(1, 4)"
            :key="item.forecastAt"
            class="mini-forecast rounded-3 text-center p-2"
          >
            <span class="small d-block text-body-secondary">
              {{ formatForecastHour(item.forecastAt) }}
            </span>
            <strong>{{ formatTemperature(item.temperature) }}</strong>
          </div>
        </div>
      </template>

      <template v-else>
        <div v-if="forecastStatus === 'error'" class="alert alert-warning py-2" role="alert">
          <p class="small mb-2">{{ forecastMessage }}</p>
          <button class="btn btn-sm btn-outline-dark" type="button" @click="retryForecast">
            다시 시도
          </button>
        </div>
        <p v-else-if="forecastMessage !== ''" class="small text-body-secondary">
          {{ forecastMessage }}
        </p>

        <RouterLink class="region-search-link mb-2" to="/weather#weather-region-search">
          <span aria-hidden="true">⌕</span>
          <span>지역명으로 날씨 검색</span>
          <span class="ms-auto" aria-hidden="true">→</span>
        </RouterLink>
        <button
          class="btn btn-outline-primary"
          type="button"
          :disabled="locating"
          @click="requestLocation"
        >
          <span v-if="locating" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
          {{ locating ? '현재 위치 확인 중' : '현재 위치로 검색' }}
        </button>
        <p
          v-if="currentLocation.errorMessage.value !== ''"
          class="small text-danger mt-2 mb-0"
          role="alert"
        >
          {{ currentLocation.errorMessage.value }}
        </p>
      </template>
    </div>
  </article>
</template>

<style scoped>
.service-card {
  border-color: var(--bs-border-color);
  border-radius: 0.5rem;
}

.weather-card {
  background: linear-gradient(145deg, #fff, #f2f9ff);
}

.home-weather-icon {
  width: 4.5rem;
  height: 4.5rem;
  flex: 0 0 auto;
}

.mini-forecast {
  min-width: 5rem;
  background: rgb(var(--bs-primary-rgb) / 0.07);
}

.region-search-link {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 2.5rem;
  padding: 0.45rem 0.75rem;
  color: var(--bs-body-color);
  text-decoration: none;
  background: var(--bs-body-bg);
  border: var(--bs-border-width) solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
}

.region-search-link:hover,
.region-search-link:focus-visible {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.25rem rgb(var(--bs-primary-rgb) / 0.25);
}
</style>
