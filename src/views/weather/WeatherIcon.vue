<script setup lang="ts">
import { computed } from 'vue'

import type { WeatherValues } from '@/api/weather'
import { getWeatherCondition } from '@/utils/weather'

const props = defineProps<{
  precipitationTypeLabel: WeatherValues['precipitationTypeLabel']
  skyStatusLabel: WeatherValues['skyStatusLabel']
}>()

const condition = computed(() => getWeatherCondition(props))
</script>

<template>
  <svg
    class="weather-icon"
    viewBox="0 0 64 64"
    focusable="false"
    aria-hidden="true"
  >
    <g v-if="condition === 'unknown'" class="unknown">
      <circle cx="32" cy="32" r="23" />
      <path d="M25 25a7.5 7.5 0 1 1 10.5 6.9C33.3 33 32 34.8 32 37v1M32 47h.01" />
    </g>
    <g v-else-if="condition === 'sunny'" class="sun">
      <path d="M32 4v8M32 52v8M4 32h8M52 32h8M12.2 12.2l5.7 5.7M46.1 46.1l5.7 5.7M51.8 12.2l-5.7 5.7M17.9 46.1l-5.7 5.7" />
      <circle cx="32" cy="32" r="13" />
    </g>

    <g v-else>
      <g v-if="condition === 'cloudy'" class="sun sun-behind">
        <path d="M20 5v6M5 20h6M9.4 9.4l4.3 4.3M30.6 9.4l-4.3 4.3" />
        <circle cx="20" cy="20" r="9" />
      </g>
      <path
        class="cloud"
        d="M18 45h29a10 10 0 0 0 1.2-19.9A16.5 16.5 0 0 0 17 22.6 11.5 11.5 0 0 0 18 45Z"
      />
      <path
        v-if="condition === 'overcast'"
        class="cloud cloud-back"
        d="M9 35h27a9 9 0 0 0 .8-18A14.5 14.5 0 0 0 9.6 15 10 10 0 0 0 9 35Z"
      />
      <g v-if="condition === 'rain' || condition === 'sleet'" class="rain">
        <path d="M21 49l-3 8M34 49l-3 8M47 49l-3 8" />
      </g>
      <g v-if="condition === 'snow' || condition === 'sleet'" class="snow">
        <path d="M21 49v10M16.7 51.5l8.6 5M25.3 51.5l-8.6 5M43 49v10M38.7 51.5l8.6 5M47.3 51.5l-8.6 5" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.weather-icon {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.sun {
  fill: #ffc83d;
  stroke: #f59f00;
  stroke-linecap: round;
  stroke-width: 3.5;
}

.sun-behind {
  opacity: 0.95;
}

.cloud {
  fill: #f8fbff;
  stroke: #7d93aa;
  stroke-linejoin: round;
  stroke-width: 3;
}

.cloud-back {
  fill: #b8c5d1;
  stroke: #66788a;
  transform: translate(-2px, -4px);
}

.rain {
  fill: none;
  stroke: #368ad8;
  stroke-linecap: round;
  stroke-width: 4;
}

.snow {
  fill: none;
  stroke: #62aee9;
  stroke-linecap: round;
  stroke-width: 2.4;
}

.unknown {
  fill: #eef2f5;
  stroke: #7d8b99;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.unknown path {
  fill: none;
}
</style>
