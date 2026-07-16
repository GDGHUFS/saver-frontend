<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { NationwideCurrentWeatherItem } from '@/api/weather'
import {
  createKakaoMapDiagnosticId,
  getKakaoMapResourceStatus,
  isKakaoMapResourceUrl,
  KakaoMapLoadError,
  loadKakaoMapsSdk,
  logKakaoMapEvent,
} from '@/integrations/kakao-maps'
import { getWeatherCondition, type WeatherCondition } from '@/utils/weather'
import FallbackNationwideWeatherMap from '@/views/weather/FallbackNationwideWeatherMap.vue'
import {
  selectRepresentativeWeather,
  type RepresentativeWeatherMarker,
} from '@/views/weather/nationwide-weather'
import RepresentativeWeatherList from '@/views/weather/RepresentativeWeatherList.vue'

type MapStatus = 'fallback' | 'loading' | 'ready'
type FallbackReason = 'quota' | 'resource_failure' | 'sdk_failure' | 'tiles_timeout'

const nationwideMapCenter = { latitude: 36.2, longitude: 127.8 } as const
const nationwideMapInitialLevel = 12
const nationwideMapBoundsPadding = 24

const props = defineProps<{
  items: readonly NationwideCurrentWeatherItem[]
}>()

const mapContainer = ref<HTMLElement | null>(null)
const mapStatus = ref<MapStatus>('loading')
const fallbackMessage = ref('외부 지도를 불러오지 못해 간단 지도를 표시합니다.')
const markers = computed(() => selectRepresentativeWeather(props.items))
const diagnosticId = createKakaoMapDiagnosticId('weather-map')
const initializationStartedAt = Date.now()

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
  const overlayCount = overlays.length
  const mapCreated = map !== null
  const tilesListenerRegistered = tilesLoadedHandler !== null
  clearTileTimeout()
  if (mapsApi !== null && map !== null && tilesLoadedHandler !== null) {
    mapsApi.event.removeListener(map, 'tilesloaded', tilesLoadedHandler)
  }
  tilesLoadedHandler = null
  for (const overlay of overlays) overlay.setMap(null)
  overlays = []
  map = null
  mapsApi = null
  logKakaoMapEvent('info', 'map.resources_released', {
    diagnosticId,
    frontendOrigin: window.location.origin,
    mapCreated,
    overlayCount,
    tilesListenerRegistered,
  })
}

function showFallback(reason: FallbackReason, responseStatus: number | null = null): void {
  if (mapStatus.value === 'fallback') return
  const isQuotaExceeded = reason === 'quota'
  fallbackMessage.value = isQuotaExceeded
    ? '카카오맵 사용량 제한에 도달해 간단 지도를 표시합니다.'
    : '카카오맵을 불러오지 못해 간단 지도를 표시합니다.'
  logKakaoMapEvent(isQuotaExceeded ? 'warn' : 'error', 'map.fallback_activated', {
    diagnosticId,
    elapsedMs: Date.now() - initializationStartedAt,
    frontendOrigin: window.location.origin,
    previousStatus: mapStatus.value,
    reason,
    responseStatus,
  })
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
  } else if (event instanceof ErrorEvent) {
    resourceUrl = event.filename
  }
  const isInsideMap = target instanceof Node && mapContainer.value?.contains(target) === true
  if (!isInsideMap && !isKakaoMapResourceUrl(resourceUrl)) return
  const responseStatus = getKakaoMapResourceStatus(resourceUrl)
  let resourceHost = ''
  let resourcePath = ''
  try {
    const resource = new URL(resourceUrl, window.location.href)
    resourceHost = resource.host
    resourcePath = resource.pathname
  } catch {
    resourcePath = 'unavailable'
  }
  logKakaoMapEvent('error', 'map.resource_failed', {
    diagnosticId,
    frontendOrigin: window.location.origin,
    isInsideMap,
    resourceHost,
    resourcePath,
    responseStatus,
    targetTag: target instanceof Element ? target.tagName.toLowerCase() : 'unknown',
  })
  showFallback(responseStatus === 429 ? 'quota' : 'resource_failure', responseStatus)
}

async function initializeMap(): Promise<void> {
  logKakaoMapEvent('info', 'map.initialization_started', {
    diagnosticId,
    frontendOrigin: window.location.origin,
    markerCount: markers.value.length,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  })
  try {
    const loadedMaps = await loadKakaoMapsSdk(undefined, diagnosticId)
    logKakaoMapEvent('info', 'map.sdk_ready', {
      diagnosticId,
      elapsedMs: Date.now() - initializationStartedAt,
      frontendOrigin: window.location.origin,
    })
    if (disposed || mapContainer.value === null) {
      logKakaoMapEvent('warn', 'map.initialization_aborted', {
        containerAvailable: mapContainer.value !== null,
        diagnosticId,
        disposed,
        frontendOrigin: window.location.origin,
      })
      return
    }
    mapsApi = loadedMaps
    const createdMap = new loadedMaps.Map(mapContainer.value, {
      center: new loadedMaps.LatLng(
        nationwideMapCenter.latitude,
        nationwideMapCenter.longitude,
      ),
      disableDoubleClick: false,
      disableDoubleClickZoom: false,
      draggable: true,
      keyboardShortcuts: true,
      level: nationwideMapInitialLevel,
      scrollwheel: true,
      tileAnimation: false,
    })
    map = createdMap
    createdMap.addControl(new loadedMaps.ZoomControl(), loadedMaps.ControlPosition.RIGHT)
    logKakaoMapEvent('info', 'map.instance_created', {
      containerHeight: mapContainer.value.clientHeight,
      containerWidth: mapContainer.value.clientWidth,
      diagnosticId,
      draggable: true,
      frontendOrigin: window.location.origin,
      initialLatitude: nationwideMapCenter.latitude,
      initialLevel: nationwideMapInitialLevel,
      initialLongitude: nationwideMapCenter.longitude,
      keyboardShortcuts: true,
      scrollwheel: true,
      zoomControl: true,
    })

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
    logKakaoMapEvent('info', 'map.weather_overlays_created', {
      diagnosticId,
      frontendOrigin: window.location.origin,
      overlayCount: overlays.length,
    })

    tilesLoadedHandler = () => {
      clearTileTimeout()
      if (!disposed) {
        mapStatus.value = 'ready'
        logKakaoMapEvent('info', 'map.tiles_loaded', {
          diagnosticId,
          elapsedMs: Date.now() - initializationStartedAt,
          frontendOrigin: window.location.origin,
          overlayCount: overlays.length,
        })
      }
    }
    loadedMaps.event.addListener(createdMap, 'tilesloaded', tilesLoadedHandler)
    tileTimeoutId = window.setTimeout(() => showFallback('tiles_timeout'), 10_000)
    logKakaoMapEvent('info', 'map.tiles_wait_started', {
      diagnosticId,
      frontendOrigin: window.location.origin,
      timeoutMs: 10_000,
    })
    if (markers.value.length > 0) {
      createdMap.setBounds(
        bounds,
        nationwideMapBoundsPadding,
        nationwideMapBoundsPadding,
        nationwideMapBoundsPadding,
        nationwideMapBoundsPadding,
      )
    }
  } catch (error: unknown) {
    if (disposed) return
    const errorKind = error instanceof KakaoMapLoadError ? error.kind : 'unknown'
    const responseStatus = error instanceof KakaoMapLoadError ? error.status : null
    logKakaoMapEvent('error', 'map.initialization_failed', {
      diagnosticId,
      elapsedMs: Date.now() - initializationStartedAt,
      errorKind,
      errorName: error instanceof Error ? error.name : 'unknown',
      frontendOrigin: window.location.origin,
      responseStatus,
    })
    showFallback(
      errorKind === 'quota' || responseStatus === 429 ? 'quota' : 'sdk_failure',
      responseStatus,
    )
  }
}

onMounted(() => {
  logKakaoMapEvent('info', 'map.component_mounted', {
    diagnosticId,
    frontendOrigin: window.location.origin,
  })
  window.addEventListener('error', handleMapResourceError, true)
  void initializeMap()
})
onBeforeUnmount(() => {
  disposed = true
  logKakaoMapEvent('info', 'map.component_unmounting', {
    diagnosticId,
    elapsedMs: Date.now() - initializationStartedAt,
    frontendOrigin: window.location.origin,
    status: mapStatus.value,
  })
  window.removeEventListener('error', handleMapResourceError, true)
  removeMapResources()
})
</script>

<template>
  <div class="row g-4 align-items-start nationwide-weather-layout">
    <div class="col-12 col-lg-6">
      <div v-if="mapStatus !== 'fallback'" class="kakao-map-shell">
        <div
          ref="mapContainer"
          class="kakao-map"
          role="region"
          aria-label="확대, 축소와 이동이 가능한 대한민국 주요 지역 현재 날씨 지도"
          :aria-busy="mapStatus === 'loading'"
          tabindex="0"
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
    <div class="col-12 col-lg-6">
      <RepresentativeWeatherList :markers="markers" />
    </div>
  </div>
</template>

<style scoped>
.kakao-map-shell {
  position: relative;
  width: 100%;
  height: 36rem;
  overflow: hidden;
  background: #e9f2f7;
  border: 1px solid var(--bs-border-color);
  border-radius: 1.25rem;
}

.kakao-map {
  width: 100%;
  height: 100%;
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
    height: 27rem;
  }
}

@media (min-width: 576px) and (max-width: 991.98px) {
  .kakao-map-shell {
    height: 32rem;
  }
}
</style>
