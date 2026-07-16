import { apiClient } from '@/api/client'

export const WEATHER_DEFAULT_FORECAST_HOURS = 24
export const WEATHER_HOME_FORECAST_HOURS = 6
export const WEATHER_MAX_FORECAST_HOURS = 72

export interface WeatherGrid {
  latitude: number
  longitude: number
  nx: number
  ny: number
}

export interface WeatherValues {
  humidity: string | null
  maximumTemperature: string | null
  minimumTemperature: string | null
  precipitationAmount: string | null
  precipitationProbability: string | null
  precipitationType: string | null
  precipitationTypeLabel: string | null
  skyStatus: string | null
  skyStatusLabel: string | null
  snowfallAmount: string | null
  temperature: string | null
  waveHeight: string | null
  windDirection: string | null
  windSpeed: string | null
  windUComponent: string | null
  windVComponent: string | null
}

export interface NationwideCurrentWeatherItem extends WeatherValues {
  forecastAt: string
  grid: WeatherGrid
  issuedAt: string
}

export interface NationwideCurrentWeather {
  generatedAt: string
  items: readonly NationwideCurrentWeatherItem[]
}

export interface WeatherForecastItem extends WeatherValues {
  forecastAt: string
}

export interface WeatherLocation {
  administrativeCode: string
  regionLevel1: string
  regionLevel2: string | null
  regionLevel3: string | null
}

export interface WeatherGridForecast {
  forecasts: readonly WeatherForecastItem[]
  grid: WeatherGrid
  issuedAt: string
  locations: readonly WeatherLocation[]
}

interface WeatherForecastResponseBase {
  hours: number
  items: readonly WeatherGridForecast[]
}

export interface RegionWeatherForecastResponse extends WeatherForecastResponseBase {
  latitude: null
  longitude: null
  region: string
  selector: 'region'
}

export interface CoordinateWeatherForecastResponse extends WeatherForecastResponseBase {
  latitude: number
  longitude: number
  region: null
  selector: 'coordinates'
}

export type WeatherForecastResponse =
  | CoordinateWeatherForecastResponse
  | RegionWeatherForecastResponse

export interface WeatherRegionOption {
  fullName: string
  hasChildren: boolean
  name: string
}

export interface WeatherLocationCatalog {
  items: readonly WeatherRegionOption[]
  parents: readonly string[]
  regionLevel: 1 | 2 | 3
}

export interface WeatherLocationsQuery {
  regionLevel1?: string
  regionLevel2?: string
  signal?: AbortSignal
}

export interface WeatherForecastByRegionQuery {
  hours?: number
  region: string
  signal?: AbortSignal
}

export interface WeatherForecastByCoordinatesQuery {
  hours?: number
  latitude: number
  longitude: number
  signal?: AbortSignal
}

export type WeatherForecastQuery =
  | WeatherForecastByCoordinatesQuery
  | WeatherForecastByRegionQuery

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function decodeString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`)
  }
  return value
}

function decodeNonEmptyString(value: unknown, field: string): string {
  const text = decodeString(value, field)
  if (text.length === 0) {
    throw new Error(`${field} must not be empty`)
  }
  return text
}

function decodeNullableString(value: unknown, field: string): string | null {
  return value === null ? null : decodeString(value, field)
}

function decodeDateTime(value: unknown, field: string): string {
  const dateTime = decodeString(value, field)
  if (Number.isNaN(Date.parse(dateTime))) {
    throw new Error(`${field} must be an ISO 8601 date-time`)
  }
  return dateTime
}

function decodeNumber(value: unknown, field: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be a number between ${minimum} and ${maximum}`)
  }
  return value
}

function decodeNullableNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number | null {
  return value === null ? null : decodeNumber(value, field, minimum, maximum)
}

function decodeInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  const number = decodeNumber(value, field, minimum, maximum)
  if (!Number.isSafeInteger(number)) {
    throw new Error(`${field} must be an integer`)
  }
  return number
}

function decodeGrid(value: unknown): WeatherGrid {
  if (!isRecord(value)) {
    throw new Error('grid must be an object')
  }
  return {
    latitude: decodeNumber(value.latitude, 'grid.latitude', 30, 45),
    longitude: decodeNumber(value.longitude, 'grid.longitude', 120, 140),
    nx: decodeInteger(value.nx, 'grid.nx', 1, 149),
    ny: decodeInteger(value.ny, 'grid.ny', 1, 253),
  }
}

function decodeWeatherValues(value: Record<string, unknown>): WeatherValues {
  return {
    humidity: decodeNullableString(value.humidity, 'humidity'),
    maximumTemperature: decodeNullableString(value.maximum_temperature, 'maximum_temperature'),
    minimumTemperature: decodeNullableString(value.minimum_temperature, 'minimum_temperature'),
    precipitationAmount: decodeNullableString(value.precipitation_amount, 'precipitation_amount'),
    precipitationProbability: decodeNullableString(
      value.precipitation_probability,
      'precipitation_probability',
    ),
    precipitationType: decodeNullableString(value.precipitation_type, 'precipitation_type'),
    precipitationTypeLabel: decodeNullableString(
      value.precipitation_type_label,
      'precipitation_type_label',
    ),
    skyStatus: decodeNullableString(value.sky_status, 'sky_status'),
    skyStatusLabel: decodeNullableString(value.sky_status_label, 'sky_status_label'),
    snowfallAmount: decodeNullableString(value.snowfall_amount, 'snowfall_amount'),
    temperature: decodeNullableString(value.temperature, 'temperature'),
    waveHeight: decodeNullableString(value.wave_height, 'wave_height'),
    windDirection: decodeNullableString(value.wind_direction, 'wind_direction'),
    windSpeed: decodeNullableString(value.wind_speed, 'wind_speed'),
    windUComponent: decodeNullableString(value.wind_u_component, 'wind_u_component'),
    windVComponent: decodeNullableString(value.wind_v_component, 'wind_v_component'),
  }
}

function decodeNationwideItem(value: unknown): NationwideCurrentWeatherItem {
  if (!isRecord(value)) {
    throw new Error('current weather item must be an object')
  }
  return {
    ...decodeWeatherValues(value),
    forecastAt: decodeDateTime(value.forecast_at, 'forecast_at'),
    grid: decodeGrid(value.grid),
    issuedAt: decodeDateTime(value.issued_at, 'issued_at'),
  }
}

function decodeNationwideCurrent(value: unknown): NationwideCurrentWeather {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('nationwide current weather must be an object with items')
  }
  return {
    generatedAt: decodeDateTime(value.generated_at, 'generated_at'),
    items: value.items.map(decodeNationwideItem),
  }
}

function decodeForecastItem(value: unknown): WeatherForecastItem {
  if (!isRecord(value)) {
    throw new Error('forecast item must be an object')
  }
  return {
    ...decodeWeatherValues(value),
    forecastAt: decodeDateTime(value.forecast_at, 'forecast_at'),
  }
}

function decodeLocation(value: unknown): WeatherLocation {
  if (!isRecord(value)) {
    throw new Error('weather location must be an object')
  }
  const administrativeCode = decodeString(value.administrative_code, 'administrative_code')
  if (!/^[0-9]{10}$/.test(administrativeCode)) {
    throw new Error('administrative_code must contain 10 digits')
  }
  return {
    administrativeCode,
    regionLevel1: decodeNonEmptyString(value.region_level_1, 'region_level_1'),
    regionLevel2: decodeNullableString(value.region_level_2, 'region_level_2'),
    regionLevel3: decodeNullableString(value.region_level_3, 'region_level_3'),
  }
}

function decodeGridForecast(value: unknown): WeatherGridForecast {
  if (!isRecord(value) || !Array.isArray(value.locations) || !Array.isArray(value.forecasts)) {
    throw new Error('grid forecast must include location and forecast arrays')
  }
  if (value.forecasts.length === 0) {
    throw new Error('grid forecast must include at least one forecast')
  }
  const forecasts = value.forecasts.map(decodeForecastItem)
  for (let index = 1; index < forecasts.length; index += 1) {
    const previous = forecasts[index - 1]
    const current = forecasts[index]
    if (
      previous !== undefined &&
      current !== undefined &&
      Date.parse(previous.forecastAt) > Date.parse(current.forecastAt)
    ) {
      throw new Error('forecasts must be ordered by forecast_at')
    }
  }
  return {
    forecasts,
    grid: decodeGrid(value.grid),
    issuedAt: decodeDateTime(value.issued_at, 'issued_at'),
    locations: value.locations.map(decodeLocation),
  }
}

function decodeForecastResponse(value: unknown): WeatherForecastResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length === 0) {
    throw new Error('weather forecast must include at least one grid')
  }
  const hours = decodeInteger(value.hours, 'hours', 1, WEATHER_MAX_FORECAST_HOURS)
  const items = value.items.map(decodeGridForecast)
  const region = decodeNullableString(value.region, 'region')
  const latitude = decodeNullableNumber(value.latitude, 'latitude', 30, 45)
  const longitude = decodeNullableNumber(value.longitude, 'longitude', 120, 140)

  if (value.selector === 'region' && region !== null && region.length > 0) {
    if (latitude !== null || longitude !== null) {
      throw new Error('region response must not include coordinates')
    }
    return { hours, items, latitude: null, longitude: null, region, selector: 'region' }
  }
  if (value.selector === 'coordinates' && latitude !== null && longitude !== null) {
    if (region !== null) {
      throw new Error('coordinate response must not include a region')
    }
    return { hours, items, latitude, longitude, region: null, selector: 'coordinates' }
  }
  throw new Error('weather forecast selector fields are inconsistent')
}

function decodeRegionOption(value: unknown): WeatherRegionOption {
  if (!isRecord(value) || typeof value.has_children !== 'boolean') {
    throw new Error('weather region option is invalid')
  }
  return {
    fullName: decodeNonEmptyString(value.full_name, 'full_name'),
    hasChildren: value.has_children,
    name: decodeNonEmptyString(value.name, 'name'),
  }
}

function decodeLocationCatalog(
  value: unknown,
  expectedLevel: 1 | 2 | 3,
  expectedParents: readonly string[],
): WeatherLocationCatalog {
  if (!isRecord(value) || !Array.isArray(value.parents) || !Array.isArray(value.items)) {
    throw new Error('weather location catalog is invalid')
  }
  const regionLevel = decodeInteger(value.region_level, 'region_level', 1, 3)
  if (regionLevel !== expectedLevel) {
    throw new Error('weather location catalog returned an unexpected level')
  }
  const parents = value.parents.map((parent) => decodeNonEmptyString(parent, 'parent'))
  if (
    parents.length !== expectedParents.length ||
    parents.some((parent, index) => parent !== expectedParents[index])
  ) {
    throw new Error('weather location catalog returned unexpected parents')
  }
  return {
    items: value.items.map(decodeRegionOption),
    parents,
    regionLevel: expectedLevel,
  }
}

function normalizeRegionName(value: string, field: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length < 1 || normalized.length > 100) {
    throw new RangeError(`${field} must be between 1 and 100 characters`)
  }
  return normalized
}

function assertHours(hours: number): void {
  if (!Number.isSafeInteger(hours) || hours < 1 || hours > WEATHER_MAX_FORECAST_HOURS) {
    throw new RangeError(`hours must be between 1 and ${WEATHER_MAX_FORECAST_HOURS}`)
  }
}

function assertCoordinate(value: number, field: string, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${field} must be between ${minimum} and ${maximum}`)
  }
}

export const weatherApi = {
  getCurrent(signal?: AbortSignal): Promise<NationwideCurrentWeather> {
    return apiClient.request('/weather/current', { decoder: decodeNationwideCurrent, signal })
  },

  getLocations(query: WeatherLocationsQuery = {}): Promise<WeatherLocationCatalog> {
    if (query.regionLevel2 !== undefined && query.regionLevel1 === undefined) {
      throw new RangeError('regionLevel2 requires regionLevel1')
    }
    const regionLevel1 =
      query.regionLevel1 === undefined
        ? undefined
        : normalizeRegionName(query.regionLevel1, 'regionLevel1')
    const regionLevel2 =
      query.regionLevel2 === undefined
        ? undefined
        : normalizeRegionName(query.regionLevel2, 'regionLevel2')
    const expectedLevel: 1 | 2 | 3 =
      regionLevel1 === undefined ? 1 : regionLevel2 === undefined ? 2 : 3
    const parents = [regionLevel1, regionLevel2].filter(
      (parent): parent is string => parent !== undefined,
    )

    return apiClient.request('/weather/locations', {
      decoder: (value) => decodeLocationCatalog(value, expectedLevel, parents),
      query: {
        region_level_1: regionLevel1,
        region_level_2: regionLevel2,
      },
      signal: query.signal,
    })
  },

  getForecast(query: WeatherForecastQuery): Promise<WeatherForecastResponse> {
    const hours = query.hours ?? WEATHER_DEFAULT_FORECAST_HOURS
    assertHours(hours)

    if ('region' in query) {
      return apiClient.request('/weather/forecast', {
        decoder: decodeForecastResponse,
        query: { hours, region: normalizeRegionName(query.region, 'region') },
        signal: query.signal,
      })
    }

    assertCoordinate(query.latitude, 'latitude', 30, 45)
    assertCoordinate(query.longitude, 'longitude', 120, 140)
    return apiClient.request('/weather/forecast', {
      decoder: decodeForecastResponse,
      query: { hours, latitude: query.latitude, longitude: query.longitude },
      signal: query.signal,
    })
  },
}
