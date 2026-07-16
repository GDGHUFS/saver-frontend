import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiHttpError } from '@/api/client'
import { KakaoMapLoadError } from '@/integrations/kakao-maps'
import WeatherView from '@/views/WeatherView.vue'

const mocks = vi.hoisted(() => ({
  getCurrent: vi.fn(),
  getForecast: vi.fn(),
  getLocations: vi.fn(),
  loadKakaoMapsSdk: vi.fn(),
}))

vi.mock('@/api/weather', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/weather')>()
  return { ...original, weatherApi: mocks }
})

vi.mock('@/integrations/kakao-maps', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/integrations/kakao-maps')>()
  return { ...original, loadKakaoMapsSdk: mocks.loadKakaoMapsSdk }
})

const weatherValues = {
  humidity: '65',
  maximumTemperature: null,
  minimumTemperature: null,
  precipitationAmount: '강수없음',
  precipitationProbability: '30',
  precipitationType: '0',
  precipitationTypeLabel: '없음',
  skyStatus: '3',
  skyStatusLabel: '구름많음',
  snowfallAmount: '적설없음',
  temperature: '27',
  waveHeight: null,
  windDirection: '110',
  windSpeed: '2.1',
  windUComponent: '1.2',
  windVComponent: '-0.5',
} as const

const location = {
  administrativeCode: '1111010100',
  regionLevel1: '서울특별시',
  regionLevel2: '종로구',
  regionLevel3: '청운효자동',
} as const

const forecastResponse = {
  selector: 'region',
  region: '서울특별시 종로구',
  latitude: null,
  longitude: null,
  hours: 24,
  items: [
    {
      grid: { nx: 60, ny: 127, latitude: 37.57, longitude: 126.98 },
      locations: [location],
      issuedAt: '2026-07-16T14:00:00+09:00',
      forecasts: [
        { ...weatherValues, forecastAt: '2026-07-16T15:00:00+09:00' },
        { ...weatherValues, temperature: '26', forecastAt: '2026-07-16T16:00:00+09:00' },
      ],
    },
  ],
} as const

const nationwideResponse = {
  generatedAt: '2026-07-16T14:10:00+09:00',
  items: [
    {
      ...weatherValues,
      forecastAt: '2026-07-16T15:00:00+09:00',
      grid: { nx: 60, ny: 127, latitude: 37.57, longitude: 126.98 },
      issuedAt: '2026-07-16T14:00:00+09:00',
    },
  ],
} as const

const level1Catalog = {
  regionLevel: 1,
  parents: [],
  items: [{ name: '서울특별시', fullName: '서울특별시', hasChildren: true }],
} as const

const level2Catalog = {
  regionLevel: 2,
  parents: ['서울특별시'],
  items: [{ name: '종로구', fullName: '서울특별시 종로구', hasChildren: false }],
} as const

function setGeolocation(getCurrentPosition: Geolocation['getCurrentPosition'] | undefined): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: getCurrentPosition === undefined ? undefined : { getCurrentPosition },
  })
}

describe('WeatherView', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.getCurrent.mockReset().mockResolvedValue(nationwideResponse)
    mocks.getForecast.mockReset().mockResolvedValue(forecastResponse)
    mocks.loadKakaoMapsSdk.mockReset().mockRejectedValue(new KakaoMapLoadError('load'))
    mocks.getLocations.mockReset().mockImplementation(
      (query: { regionLevel1?: string } = {}) =>
        Promise.resolve(query.regionLevel1 === undefined ? level1Catalog : level2Catalog),
    )
    setGeolocation(undefined)
  })

  it('전국 날씨를 기다리는 동안 검색 도구와 진행 상태를 함께 보여준다', async () => {
    mocks.getCurrent.mockReturnValue(new Promise<never>(() => undefined))
    render(WeatherView)

    expect(await screen.findByLabelText('시·도')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '현재 위치 날씨 보기' })).toBeInTheDocument()
    expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('불러오는 중'))).toBe(true)
  })

  it('전국 격자에서 주요 지역을 골라 지도와 목록으로 표시한다', async () => {
    render(WeatherView)

    expect(
      await screen.findByRole('img', { name: /대한민국 주요 지역 현재 날씨/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '주요 지역 날씨' })).toHaveTextContent('서울')
    expect(screen.getByRole('list', { name: '주요 지역 날씨' })).toHaveTextContent('27℃')
  })

  it('전국 날씨의 빈 상태와 오류 재시도를 구분한다', async () => {
    mocks.getCurrent
      .mockRejectedValueOnce(new ApiHttpError(503, undefined))
      .mockResolvedValueOnce({ generatedAt: '2026-07-16T14:10:00+09:00', items: [] })
    render(WeatherView)

    expect(await screen.findByRole('alert')).toHaveTextContent('전국 날씨를 불러오지 못했습니다.')
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('현재 제공되는 전국 날씨가 없습니다.')).toBeInTheDocument()
    expect(mocks.getCurrent).toHaveBeenCalledTimes(2)
  })

  // locations가 발급한 full_name만 forecast의 region으로 전달하는지 보호한다.
  it('계층형 지역 선택으로 정확한 지역명을 조회하고 단기예보를 표시한다', async () => {
    render(WeatherView)

    await fireEvent.update(await screen.findByLabelText('시·도'), '서울특별시')
    await fireEvent.update(await screen.findByLabelText('시·군·구'), '종로구')
    await fireEvent.click(screen.getByRole('button', { name: '선택한 지역 날씨 보기' }))

    await waitFor(() => {
      expect(mocks.getForecast).toHaveBeenCalledWith({
        hours: 24,
        region: '서울특별시 종로구',
        signal: expect.any(AbortSignal),
      })
    })
    expect(await screen.findByRole('heading', { name: '서울특별시 종로구 청운효자동' })).toBeInTheDocument()
    expect(screen.getAllByText('27℃').length).toBeGreaterThan(0)
  })

  it('버튼을 누른 뒤에만 브라우저 위치를 요청하고 좌표 예보를 조회한다', async () => {
    const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success) => {
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
    setGeolocation(getCurrentPosition)
    mocks.getForecast.mockResolvedValue({
      ...forecastResponse,
      selector: 'coordinates',
      region: null,
      latitude: 37.57,
      longitude: 126.98,
    })
    render(WeatherView)

    expect(getCurrentPosition).not.toHaveBeenCalled()
    await fireEvent.click(screen.getByRole('button', { name: '현재 위치 날씨 보기' }))

    await waitFor(() => {
      expect(mocks.getForecast).toHaveBeenCalledWith({
        hours: 24,
        latitude: 37.57,
        longitude: 126.98,
        signal: expect.any(AbortSignal),
      })
    })
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('예보가 없는 위치를 오류와 구분되는 빈 상태로 안내한다', async () => {
    mocks.getForecast.mockRejectedValue(new ApiHttpError(404, undefined))
    render(WeatherView)

    await fireEvent.update(await screen.findByLabelText('시·도'), '서울특별시')
    await fireEvent.click(screen.getByRole('button', { name: '선택한 지역 날씨 보기' }))

    expect(
      await screen.findByText('선택한 위치에서 제공 가능한 예보를 찾지 못했습니다.'),
    ).toBeInTheDocument()
  })
})
