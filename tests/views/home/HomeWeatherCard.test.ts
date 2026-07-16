import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HomeWeatherCard from '@/views/home/HomeWeatherCard.vue'

const mocks = vi.hoisted(() => ({
  getForecast: vi.fn(),
}))

vi.mock('@/api/weather', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/weather')>()
  return { ...original, weatherApi: { getForecast: mocks.getForecast } }
})

const forecastResponse = {
  selector: 'coordinates',
  region: null,
  latitude: 37.57,
  longitude: 126.98,
  hours: 6,
  items: [
    {
      grid: { nx: 60, ny: 127, latitude: 37.57, longitude: 126.98 },
      locations: [],
      issuedAt: '2026-07-16T14:00:00+09:00',
      forecasts: [
        {
          humidity: '65',
          maximumTemperature: null,
          minimumTemperature: null,
          precipitationAmount: '강수없음',
          precipitationProbability: '30',
          precipitationType: '0',
          precipitationTypeLabel: '없음',
          skyStatus: '1',
          skyStatusLabel: '맑음',
          snowfallAmount: '적설없음',
          temperature: '27',
          waveHeight: null,
          windDirection: '110',
          windSpeed: '2.1',
          windUComponent: '1.2',
          windVComponent: '-0.5',
          forecastAt: '2026-07-16T15:00:00+09:00',
        },
      ],
    },
  ],
} as const

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/weather', component: { template: '<div>날씨</div>' } },
    ],
  })
}

function setBrowserLocation(
  permissionState: PermissionState,
  getCurrentPosition: Geolocation['getCurrentPosition'],
): void {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state: permissionState }) },
  })
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  })
}

function successfulGeolocation(): Geolocation['getCurrentPosition'] {
  return vi.fn<Geolocation['getCurrentPosition']>((success) => {
    success({
      coords: {
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: 37.57,
        longitude: 126.98,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 1,
      toJSON: () => ({}),
    })
  })
}

async function renderCard() {
  const router = createTestRouter()
  await router.push('/')
  await router.isReady()
  return render(HomeWeatherCard, { global: { plugins: [router] } })
}

describe('HomeWeatherCard', () => {
  beforeEach(() => {
    mocks.getForecast.mockReset().mockResolvedValue(forecastResponse)
  })

  it('아직 위치 권한을 묻지 않은 경우 지역 검색과 위치 요청 버튼을 제공한다', async () => {
    const getCurrentPosition = successfulGeolocation()
    setBrowserLocation('prompt', getCurrentPosition)
    await renderCard()

    expect(await screen.findByRole('link', { name: /지역명으로 날씨 검색/ })).toHaveAttribute(
      'href',
      '/weather#weather-region-search',
    )
    expect(screen.getByRole('button', { name: '현재 위치로 검색' })).toBeInTheDocument()
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(mocks.getForecast).not.toHaveBeenCalled()
  })

  it('이미 허용된 위치는 별도 권한 요청 화면 없이 단기 날씨를 표시한다', async () => {
    const getCurrentPosition = successfulGeolocation()
    setBrowserLocation('granted', getCurrentPosition)
    await renderCard()

    expect(await screen.findByText('27℃')).toBeInTheDocument()
    expect(screen.getByText('맑음')).toBeInTheDocument()
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(mocks.getForecast).toHaveBeenCalledWith({
      hours: 6,
      latitude: 37.57,
      longitude: 126.98,
      signal: expect.any(AbortSignal),
    })
  })

  it('버튼 동작을 위치 권한 요청과 좌표 예보 조회의 트리거로 사용한다', async () => {
    const getCurrentPosition = successfulGeolocation()
    setBrowserLocation('prompt', getCurrentPosition)
    await renderCard()
    await screen.findByRole('button', { name: '현재 위치로 검색' })

    await fireEvent.click(screen.getByRole('button', { name: '현재 위치로 검색' }))

    await waitFor(() => expect(mocks.getForecast).toHaveBeenCalledTimes(1))
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('27℃')).toBeInTheDocument()
  })
})
