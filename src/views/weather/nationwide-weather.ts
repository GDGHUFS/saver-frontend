import type { NationwideCurrentWeatherItem } from '@/api/weather'

interface RepresentativeLocation {
  latitude: number
  longitude: number
  name: string
}

export interface RepresentativeWeatherMarker extends RepresentativeLocation {
  item: NationwideCurrentWeatherItem
}

const representativeLocations: readonly RepresentativeLocation[] = [
  { latitude: 37.57, longitude: 126.98, name: '서울' },
  { latitude: 37.46, longitude: 126.71, name: '인천' },
  { latitude: 37.88, longitude: 127.73, name: '춘천' },
  { latitude: 37.75, longitude: 128.9, name: '강릉' },
  { latitude: 36.64, longitude: 127.49, name: '청주' },
  { latitude: 36.35, longitude: 127.38, name: '대전' },
  { latitude: 35.82, longitude: 127.15, name: '전주' },
  { latitude: 35.87, longitude: 128.6, name: '대구' },
  { latitude: 35.54, longitude: 129.31, name: '울산' },
  { latitude: 35.16, longitude: 126.85, name: '광주' },
  { latitude: 35.18, longitude: 129.08, name: '부산' },
  { latitude: 34.81, longitude: 126.39, name: '목포' },
  { latitude: 33.5, longitude: 126.53, name: '제주' },
] as const

function findNearestItem(
  location: RepresentativeLocation,
  items: readonly NationwideCurrentWeatherItem[],
): NationwideCurrentWeatherItem | null {
  let nearest: NationwideCurrentWeatherItem | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const item of items) {
    const latitudeDistance = item.grid.latitude - location.latitude
    const longitudeDistance = (item.grid.longitude - location.longitude) * 0.8
    const distance = latitudeDistance ** 2 + longitudeDistance ** 2
    if (distance < nearestDistance) {
      nearest = item
      nearestDistance = distance
    }
  }
  return nearestDistance <= 0.8 ** 2 ? nearest : null
}

export function selectRepresentativeWeather(
  items: readonly NationwideCurrentWeatherItem[],
): readonly RepresentativeWeatherMarker[] {
  return representativeLocations.flatMap((location) => {
    const item = findNearestItem(location, items)
    return item === null ? [] : [{ ...location, item }]
  })
}
