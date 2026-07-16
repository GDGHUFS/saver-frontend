<script setup lang="ts">
import { computed } from 'vue'

import { getWeatherCondition } from '@/utils/weather'
import type { RepresentativeWeatherMarker } from '@/views/weather/nationwide-weather'

interface FallbackMapMarker extends RepresentativeWeatherMarker {
  x: number
  y: number
}

const props = defineProps<{
  markers: readonly RepresentativeWeatherMarker[]
}>()

function projectLongitude(longitude: number): number {
  return 30 + ((longitude - 125) / 5.5) * 360
}

function projectLatitude(latitude: number): number {
  return 35 + ((38.5 - latitude) / 5.5) * 420
}

const fallbackMarkers = computed<readonly FallbackMapMarker[]>(() =>
  props.markers.map((marker) => ({
    ...marker,
    x: projectLongitude(marker.longitude),
    y: projectLatitude(marker.latitude),
  })),
)
</script>

<template>
  <div class="weather-map-wrap">
    <svg
      class="weather-map"
      viewBox="0 0 420 500"
      role="img"
      aria-labelledby="fallback-weather-map-title fallback-weather-map-description"
    >
      <title id="fallback-weather-map-title">대한민국 주요 지역 현재 날씨 간단 지도</title>
      <desc id="fallback-weather-map-description">
        외부 지도를 사용할 수 없어 주요 도시와 가장 가까운 격자 예보를 간단한 지도에 표시합니다.
      </desc>
      <defs>
        <linearGradient id="fallback-land-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e7f5eb" />
          <stop offset="1" stop-color="#cfe5d6" />
        </linearGradient>
      </defs>
      <path
        class="map-land"
        d="M88 38C126 22 172 38 214 25c48-15 97-6 122 26 19 25 12 62 2 91-12 34-5 72-15 107-9 31-31 56-61 73-25 15-41 43-71 50-39 8-77-12-94-46-15-30 3-61-6-92-7-25-28-43-24-72 4-32 23-53 20-85-1-14-8-29 1-39Z"
      />
      <ellipse class="map-land" cx="130" cy="438" rx="43" ry="17" transform="rotate(-9 130 438)" />
      <circle class="map-island" cx="369" cy="177" r="5" />

      <g
        v-for="marker in fallbackMarkers"
        :key="marker.name"
        class="map-marker"
        :class="`condition-${getWeatherCondition(marker.item)}`"
        :transform="`translate(${marker.x} ${marker.y})`"
      >
        <circle r="17" />
        <text class="marker-temperature" y="4">{{ marker.item.temperature ?? '–' }}°</text>
        <text class="marker-name" y="33">{{ marker.name }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.weather-map-wrap {
  max-width: 34rem;
  margin-inline: auto;
  padding: 1rem;
  background: linear-gradient(160deg, #e9f7ff, #f5fbff 58%, #e6f4fa);
  border: 1px solid #cce3ef;
  border-radius: 1.25rem;
}

.weather-map {
  display: block;
  width: 100%;
  max-height: 34rem;
}

.map-land,
.map-island {
  fill: url(#fallback-land-gradient);
  stroke: #72a181;
  stroke-linejoin: round;
  stroke-width: 2;
}

.map-marker circle {
  fill: #64788c;
  stroke: #fff;
  stroke-width: 3;
  filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.16));
}

.map-marker.condition-sunny circle {
  fill: #e9a400;
}

.map-marker.condition-cloudy circle,
.map-marker.condition-overcast circle {
  fill: #73879a;
}

.map-marker.condition-rain circle,
.map-marker.condition-sleet circle {
  fill: #337fbd;
}

.map-marker.condition-snow circle {
  fill: #65a9d9;
}

.map-marker.condition-unknown circle {
  fill: #7d8b99;
}

.map-marker text {
  font-family: inherit;
  text-anchor: middle;
}

.marker-temperature {
  fill: #fff;
  font-size: 11px;
  font-weight: 700;
}

.marker-name {
  fill: #25384a;
  font-size: 12px;
  font-weight: 700;
  paint-order: stroke;
  stroke: #f5fbff;
  stroke-linejoin: round;
  stroke-width: 4px;
}
</style>
