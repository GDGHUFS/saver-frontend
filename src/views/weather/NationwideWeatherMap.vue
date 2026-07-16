<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { NationwideCurrentWeatherItem } from '@/api/weather'
import {
  getKakaoMapResourceStatus,
  isKakaoMapResourceUrl,
  KakaoMapLoadError,
  loadKakaoMapsSdk,
} from '@/integrations/kakao-maps'
import { getWeatherCondition, type WeatherCondition } from '@/utils/weather'
import FallbackNationwideWeatherMap from '@/views/weather/FallbackNationwideWeatherMap.vue'
import {
  selectRepresentativeWeather,
  type RepresentativeWeatherMarker,
} from '@/views/weather/nationwide-weather'
import RepresentativeWeatherList from '@/views/weather/RepresentativeWeatherList.vue'

type MapStatus = 'fallback' | 'loading' | 'ready'

const props = defineProps<{
  items: readonly NationwideCurrentWeatherItem[]
}>()

const mapContainer = ref<HTMLElement | null>(null)
const mapStatus = ref<MapStatus>('loading')
const fallbackMessage = ref('외부 지도를 불러오지 못해 간단 지도를 표시합니다.')
const markers = computed(() => selectRepresentativeWeather(props.items))

let map: KakaoMap | null = null
let mapsApi: KakaoMapsNamespace | null = null
let overlays: KakaoCustomOverlay[] = []
let tilesLoadedHandler: (() => void) | null = null
let tileTimeoutId: number | null = null
let disposed = false

const weatherSymbols: Readonly<Record<WeatherCondition, string>> = {
  cloudy: '☁',
  overcast: '☁',
  rain: '☂',
  sleet: '◈',
  snow: '❄',
  sunny: '☀',
  unknown: '?',
}

function clearTileTimeout(): void {
  if (tileTimeoutId !== null) {
    window.clearTimeout(tileTimeoutId)
    tileTimeoutId = null
  }
}

function removeMapResources(): void {
  clearTileTimeout()
  if (mapsApi !== null && map !== null && tilesLoadedHandler !== null) {
    mapsApi.event.removeListener(map, 'tilesloaded', tilesLoadedHandler)
  }
  tilesLoadedHandler = null
  for (const overlay of overlays) overlay.setMap(null)
  overlays = []
  map = null
  mapsApi = null
}

function showFallback(isQuotaExceeded: boolean): void {
  if (mapStatus.value === 'fallback') return
  fallbackMessage.value = isQuotaExceeded
    ? '카카오맵 사용량 제한에 도달해 간단 지도를 표시합니다.'
    : '카카오맵을 불러오지 못해 간단 지도를 표시합니다.'
  removeMapResources()
  mapStatus.value = 'fallback'
}

function weatherMarkerElement(marker: RepresentativeWeatherMarker): HTMLElement {
  const condition = getWeatherCondition(marker.item)
  const element = document.createElement('div')
  element.className = `kakao-weather-marker condition-${condition}`
  element.setAttribute('aria-hidden', 'true')

  const symbol = document.createElement('span')
  symbol.className = 'kakao-weather-symbol'
  symbol.textContent = weatherSymbols[condition]
  const temperature = document.createElement('strong')
  temperature.textContent = marker.item.temperature === null ? '–' : `${marker.item.temperature}°`
  const name = document.createElement('span')
  name.className = 'kakao-weather-name'
  name.textContent = marker.name
  element.append(symbol, temperature, name)
  return element
}

function handleMapResourceError(event: Event): void {
  const target = event.target
  let resourceUrl = ''
  if (target instanceof HTMLImageElement) {
    resourceUrl = target.currentSrc || target.src
  } else if (target instanceof HTMLScriptElement) {
    resourceUrl = target.src
  }
  const isInsideMap = target instanceof Node && mapContainer.value?.contains(target) === true
  if (!isInsideMap && !isKakaoMapResourceUrl(resourceUrl)) return
  showFallback(getKakaoMapResourceStatus(resourceUrl) === 429)
}

async function initializeMap(): Promise<void> {
  try {
    const loadedMaps = await loadKakaoMapsSdk()
    if (disposed || mapContainer.value === null) return
    mapsApi = loadedMaps
    const createdMap = new loadedMaps.Map(mapContainer.value, {
      center: new loadedMaps.LatLng(36.2, 127.8),
      disableDoubleClick: true,
      disableDoubleClickZoom: true,
      draggable: false,
      keyboardShortcuts: false,
      level: 13,
      scrollwheel: false,
      tileAnimation: false,
    })
    map = createdMap

    const bounds = new loadedMaps.LatLngBounds()
    for (const marker of markers.value) {
      const position = new loadedMaps.LatLng(marker.latitude, marker.longitude)
      bounds.extend(position)
      overlays.push(
        new loadedMaps.CustomOverlay({
          clickable: false,
          content: weatherMarkerElement(marker),
          map: createdMap,
          position,
          xAnchor: 0.5,
          yAnchor: 1.15,
          zIndex: 3,
        }),
      )
    }

    tilesLoadedHandler = () => {
      clearTileTimeout()
      if (!disposed) mapStatus.value = 'ready'
    }
    loadedMaps.event.addListener(createdMap, 'tilesloaded', tilesLoadedHandler)
    tileTimeoutId = window.setTimeout(() => showFallback(false), 10_000)
    if (markers.value.length > 0) createdMap.setBounds(bounds, 54, 54, 54, 54)
  } catch (error: unknown) {
    if (disposed) return
    showFallback(
      error instanceof KakaoMapLoadError && (error.kind === 'quota' || error.status === 429),
    )
  }
}

onMounted(() => {
  window.addEventListener('error', handleMapResourceError, true)
  void initializeMap()
})
onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('error', handleMapResourceError, true)
  removeMapResources()
})
</script>

<template>
  <div class="row g-4 align-items-center">
    <div class="col-12 col-lg-7">
      <div v-if="mapStatus !== 'fallback'" class="kakao-map-shell">
        <div
          ref="mapContainer"
          class="kakao-map"
          role="img"
          aria-label="카카오맵으로 표시한 대한민국 주요 지역 현재 날씨"
          :aria-busy="mapStatus === 'loading'"
        ></div>
        <div v-if="mapStatus === 'loading'" class="map-loading" role="status">
          <span class="spinner-border text-primary" aria-hidden="true"></span>
          <span class="visually-hidden">카카오맵을 불러오는 중</span>
        </div>
      </div>
      <template v-else>
        <FallbackNationwideWeatherMap :markers="markers" />
        <p class="small text-body-secondary text-center mt-2 mb-0" role="status">
          {{ fallbackMessage }}
        </p>
      </template>
    </div>
    <div class="col-12 col-lg-5">
      <RepresentativeWeatherList :markers="markers" />
    </div>
  </div>
</template>

<style scoped>
.kakao-map-shell {
  position: relative;
  width: 100%;
  min-height: 31rem;
  overflow: hidden;
  background: #e9f2f7;
  border: 1px solid var(--bs-border-color);
  border-radius: 1.25rem;
}

.kakao-map {
  width: 100%;
  min-height: 31rem;
}

.map-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(255 255 255 / 0.72);
}

:global(.kakao-weather-marker) {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 4.5rem;
  padding: 0.3rem 0.5rem;
  color: #243342;
  white-space: nowrap;
  background: rgb(255 255 255 / 0.94);
  border: 2px solid #73879a;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.2);
  pointer-events: none;
}

:global(.kakao-weather-marker.condition-sunny) {
  border-color: #e9a400;
}

:global(.kakao-weather-marker.condition-rain),
:global(.kakao-weather-marker.condition-sleet),
:global(.kakao-weather-marker.condition-snow) {
  border-color: #337fbd;
}

:global(.kakao-weather-symbol) {
  color: #337fbd;
  font-size: 1rem;
  line-height: 1;
}

:global(.condition-sunny .kakao-weather-symbol) {
  color: #e9a400;
}

:global(.kakao-weather-name) {
  color: #5c6b78;
  font-size: 0.7rem;
  font-weight: 600;
}

@media (max-width: 575.98px) {
  .kakao-map-shell,
  .kakao-map {
    min-height: 25rem;
  }
}
</style>
