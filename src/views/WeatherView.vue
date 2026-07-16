<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { ApiHttpError } from '@/api/client'
import {
  WEATHER_DEFAULT_FORECAST_HOURS,
  weatherApi,
  type NationwideCurrentWeather,
  type WeatherForecastResponse,
} from '@/api/weather'
import AsyncState from '@/components/AsyncState.vue'
import PageScaffold from '@/components/PageScaffold.vue'
import { useCurrentLocation } from '@/composables/useCurrentLocation'
import type { AsyncStatus } from '@/types/async-state'
import { formatDateTime } from '@/utils/date-time'
import NationwideWeatherMap from '@/views/weather/NationwideWeatherMap.vue'
import WeatherForecastPanel from '@/views/weather/WeatherForecastPanel.vue'
import WeatherLocationSearch from '@/views/weather/WeatherLocationSearch.vue'

type ForecastTarget =
  | { kind: 'coordinates'; latitude: number; longitude: number }
  | { kind: 'region'; region: string }

const nationwideStatus = ref<AsyncStatus>('loading')
const nationwide = ref<NationwideCurrentWeather | null>(null)
const forecastStatus = ref<AsyncStatus>('empty')
const forecast = ref<WeatherForecastResponse | null>(null)
const forecastRequested = ref(false)
const forecastError = ref('날씨 예보를 불러오지 못했습니다.')
const forecastEmpty = ref('선택한 위치에서 제공 가능한 예보를 찾지 못했습니다.')
const lastForecastTarget = ref<ForecastTarget | null>(null)

const currentLocation = useCurrentLocation()
const isLocating = computed(
  () =>
    currentLocation.status.value === 'checking' ||
    currentLocation.status.value === 'requesting',
)

let nationwideController: AbortController | null = null
let forecastController: AbortController | null = null
let nationwideSequence = 0
let forecastSequence = 0
let searchIntentSequence = 0
let disposed = false

async function loadNationwide(): Promise<void> {
  const requestSequence = ++nationwideSequence
  nationwideController?.abort()
  const controller = new AbortController()
  nationwideController = controller
  nationwideStatus.value = 'loading'
  try {
    const response = await weatherApi.getCurrent(controller.signal)
    if (requestSequence !== nationwideSequence) return
    nationwide.value = response
    nationwideStatus.value = response.items.length === 0 ? 'empty' : 'success'
  } catch {
    if (!controller.signal.aborted && requestSequence === nationwideSequence) {
      nationwideStatus.value = 'error'
    }
  } finally {
    if (requestSequence === nationwideSequence) nationwideController = null
  }
}

function setForecastFailure(error: unknown): void {
  forecastError.value = '날씨 예보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  forecastEmpty.value = '선택한 위치에서 제공 가능한 예보를 찾지 못했습니다.'
  if (error instanceof ApiHttpError && error.status === 404) {
    forecastStatus.value = 'empty'
    return
  }
  if (error instanceof ApiHttpError && error.status === 503) {
    forecastError.value = '날씨 저장소를 일시적으로 사용할 수 없습니다.'
  } else if (error instanceof ApiHttpError && error.status === 422) {
    forecastError.value = '선택한 위치로 날씨를 조회할 수 없습니다.'
  } else if (error instanceof RangeError) {
    forecastStatus.value = 'empty'
    forecastEmpty.value = '현재 위치가 국내 날씨 제공 범위를 벗어났습니다.'
    return
  }
  forecastStatus.value = 'error'
}

async function loadForecast(target: ForecastTarget): Promise<void> {
  const requestSequence = ++forecastSequence
  forecastController?.abort()
  const controller = new AbortController()
  forecastController = controller
  lastForecastTarget.value = target
  forecastRequested.value = true
  forecastStatus.value = 'loading'
  forecast.value = null

  try {
    const response =
      target.kind === 'region'
        ? await weatherApi.getForecast({
            hours: WEATHER_DEFAULT_FORECAST_HOURS,
            region: target.region,
            signal: controller.signal,
          })
        : await weatherApi.getForecast({
            hours: WEATHER_DEFAULT_FORECAST_HOURS,
            latitude: target.latitude,
            longitude: target.longitude,
            signal: controller.signal,
          })
    if (requestSequence !== forecastSequence) return
    forecast.value = response
    forecastStatus.value = 'success'
  } catch (error: unknown) {
    if (!controller.signal.aborted && requestSequence === forecastSequence) {
      setForecastFailure(error)
    }
  } finally {
    if (requestSequence === forecastSequence) forecastController = null
  }
}

function searchRegion(region: string): void {
  searchIntentSequence += 1
  void loadForecast({ kind: 'region', region })
}

async function searchCurrentLocation(): Promise<void> {
  const searchIntent = ++searchIntentSequence
  const coordinates = await currentLocation.requestCurrentLocation()
  if (coordinates === null || disposed || searchIntent !== searchIntentSequence) return
  await loadForecast({
    kind: 'coordinates',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  })
}

function retryForecast(): void {
  if (lastForecastTarget.value !== null) void loadForecast(lastForecastTarget.value)
}

onMounted(() => void loadNationwide())
onBeforeUnmount(() => {
  disposed = true
  nationwideSequence += 1
  forecastSequence += 1
  searchIntentSequence += 1
  nationwideController?.abort()
  forecastController?.abort()
})
</script>

<template>
  <PageScaffold title="날씨">
    <p class="lead text-body-secondary mb-4">
      전국의 현재 시각 최근접 예보를 살펴보거나 원하는 지역의 단기예보를 확인하세요.
    </p>

    <section id="weather-region-search" class="mb-5" aria-labelledby="weather-search-title">
      <h2 id="weather-search-title" class="visually-hidden">날씨 검색</h2>
      <div class="row g-4 align-items-stretch">
        <div class="col-12 col-lg-8">
          <WeatherLocationSearch
            :disabled="isLocating || forecastStatus === 'loading'"
            @search="searchRegion"
          />
        </div>
        <div class="col-12 col-lg-4">
          <article class="current-location-card card border-0 shadow-sm h-100">
            <div class="card-body d-flex flex-column p-4">
              <div class="location-illustration mb-3" aria-hidden="true">
                <svg viewBox="0 0 64 64" focusable="false">
                  <circle cx="32" cy="32" r="27" />
                  <path d="M32 7v9M32 48v9M7 32h9M48 32h9" />
                  <circle cx="32" cy="32" r="8" />
                </svg>
              </div>
              <h2 class="h5">현재 위치로 날씨 검색</h2>
              <p class="small text-body-secondary flex-grow-1">
                버튼을 누르면 브라우저가 위치 권한을 요청하고 위도와 경도로 예보를 조회합니다.
              </p>
              <button
                class="btn btn-outline-primary"
                type="button"
                :disabled="isLocating || forecastStatus === 'loading'"
                @click="searchCurrentLocation"
              >
                <span
                  v-if="isLocating"
                  class="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                ></span>
                {{ isLocating ? '현재 위치 확인 중' : '현재 위치 날씨 보기' }}
              </button>
              <p
                v-if="currentLocation.errorMessage.value !== ''"
                class="small text-danger mt-3 mb-0"
                role="alert"
              >
                {{ currentLocation.errorMessage.value }}
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <div v-if="forecastRequested" class="mb-5" aria-live="polite">
      <AsyncState
        :status="forecastStatus"
        :empty-message="forecastEmpty"
        :error-message="forecastError"
        @retry="retryForecast"
      >
        <WeatherForecastPanel v-if="forecast !== null" :forecast="forecast" />
      </AsyncState>
    </div>

    <section aria-labelledby="nationwide-weather-title">
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <p class="text-primary fw-semibold mb-1">대한민국</p>
          <h2 id="nationwide-weather-title" class="h3 mb-0">전국 날씨</h2>
        </div>
        <p v-if="nationwide !== null" class="small text-body-secondary mb-0">
          {{ formatDateTime(nationwide.generatedAt) }} 기준
        </p>
      </div>
      <AsyncState
        :status="nationwideStatus"
        empty-message="현재 제공되는 전국 날씨가 없습니다."
        error-message="전국 날씨를 불러오지 못했습니다."
        @retry="loadNationwide"
      >
        <NationwideWeatherMap v-if="nationwide !== null" :items="nationwide.items" />
      </AsyncState>
    </section>
  </PageScaffold>
</template>

<style scoped>
.current-location-card {
  background: linear-gradient(145deg, #edf7ff, #fff);
}

.location-illustration {
  width: 4rem;
  height: 4rem;
}

.location-illustration circle:first-child {
  fill: rgb(var(--bs-primary-rgb) / 0.1);
  stroke: rgb(var(--bs-primary-rgb) / 0.28);
  stroke-width: 2;
}

.location-illustration path,
.location-illustration circle:last-child {
  fill: none;
  stroke: var(--bs-primary);
  stroke-linecap: round;
  stroke-width: 3;
}
</style>
