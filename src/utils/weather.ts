import type { WeatherLocation, WeatherValues } from '@/api/weather'

export type WeatherCondition =
  | 'cloudy'
  | 'overcast'
  | 'rain'
  | 'sleet'
  | 'snow'
  | 'sunny'
  | 'unknown'

type WeatherConditionValues = Pick<
  WeatherValues,
  'precipitationTypeLabel' | 'skyStatusLabel'
>

export function getWeatherCondition(weather: WeatherConditionValues): WeatherCondition {
  switch (weather.precipitationTypeLabel) {
    case '비':
    case '소나기':
      return 'rain'
    case '비/눈':
      return 'sleet'
    case '눈':
      return 'snow'
    default:
      break
  }

  switch (weather.skyStatusLabel) {
    case '맑음':
      return 'sunny'
    case '구름많음':
      return 'cloudy'
    case '흐림':
      return 'overcast'
    default:
      return 'unknown'
  }
}

export function getWeatherLabel(weather: WeatherConditionValues): string {
  if (
    weather.precipitationTypeLabel !== null &&
    weather.precipitationTypeLabel !== '없음'
  ) {
    return weather.precipitationTypeLabel
  }
  return weather.skyStatusLabel ?? '날씨 정보 없음'
}

export function formatTemperature(value: string | null): string {
  return value === null ? '기온 정보 없음' : `${value}℃`
}

export function formatWeatherLocation(location: WeatherLocation): string {
  return [location.regionLevel1, location.regionLevel2, location.regionLevel3]
    .filter((region): region is string => region !== null)
    .join(' ')
}
