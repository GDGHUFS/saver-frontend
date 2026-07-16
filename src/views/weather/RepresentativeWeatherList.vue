<script setup lang="ts">
import { formatTemperature, getWeatherLabel } from '@/utils/weather'
import type { RepresentativeWeatherMarker } from '@/views/weather/nationwide-weather'
import WeatherIcon from '@/views/weather/WeatherIcon.vue'

defineProps<{
  markers: readonly RepresentativeWeatherMarker[]
}>()
</script>

<template>
  <ul class="list-group list-group-flush representative-list" aria-label="주요 지역 날씨">
    <li
      v-for="marker in markers"
      :key="marker.name"
      class="list-group-item d-flex align-items-center gap-3 px-0"
    >
      <span class="representative-icon">
        <WeatherIcon
          :precipitation-type-label="marker.item.precipitationTypeLabel"
          :sky-status-label="marker.item.skyStatusLabel"
        />
      </span>
      <strong class="representative-name">{{ marker.name }}</strong>
      <span class="representative-condition text-body-secondary flex-grow-1">
        {{ getWeatherLabel(marker.item) }}
      </span>
      <span class="representative-temperature fw-semibold">
        {{ formatTemperature(marker.item.temperature) }}
      </span>
    </li>
  </ul>
</template>

<style scoped>
.representative-list {
  max-height: 36rem;
  padding-inline-end: 0.75rem;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.representative-icon {
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
}

.representative-name {
  min-width: 2.5rem;
}

.representative-condition {
  min-width: 0;
}

.representative-temperature {
  flex: 0 0 auto;
  padding-inline-end: 0.25rem;
}

@media (max-width: 991.98px) {
  .representative-list {
    max-height: none;
    padding-inline-end: 0;
    overflow-y: visible;
  }
}
</style>
