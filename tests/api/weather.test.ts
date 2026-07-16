import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

const weatherValuesDto = {
  precipitation_probability: '30',
  precipitation_type: '0',
  precipitation_type_label: '없음',
  precipitation_amount: '강수없음',
  humidity: '65',
  snowfall_amount: '적설없음',
  sky_status: '3',
  sky_status_label: '구름많음',
  temperature: '27',
  minimum_temperature: null,
  maximum_temperature: null,
  wind_u_component: '1.2',
  wind_v_component: '-0.5',
  wave_height: null,
  wind_direction: '110',
  wind_speed: '2.1',
}

const gridDto = {
  nx: 60,
  ny: 127,
  longitude: 126.98,
  latitude: 37.57,
}

const forecastItemDto = {
  ...weatherValuesDto,
  forecast_at: '2026-07-16T15:00:00+09:00',
}

const gridForecastDto = {
  grid: gridDto,
  locations: [
    {
      administrative_code: '1111010100',
      region_level_1: '서울특별시',
      region_level_2: '종로구',
      region_level_3: '청운효자동',
    },
  ],
  issued_at: '2026-07-16T14:00:00+09:00',
  forecasts: [forecastItemDto],
}

describe('weatherApi', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  // 공개 날씨 endpoint의 경로와 snake_case 응답 변환 계약을 함께 보호한다.
  it('전국 현재 날씨와 지역 목록을 검증해 변환한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          generated_at: '2026-07-16T14:10:00+09:00',
          items: [
            {
              ...weatherValuesDto,
              forecast_at: '2026-07-16T15:00:00+09:00',
              grid: gridDto,
              issued_at: '2026-07-16T14:00:00+09:00',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          region_level: 1,
          parents: [],
          items: [
            { name: '서울특별시', full_name: '서울특별시', has_children: true },
          ],
        }),
      )
    vi.stubGlobal('fetch', fetchImplementation)
    const { weatherApi } = await import('@/api/weather')

    await expect(weatherApi.getCurrent()).resolves.toMatchObject({
      generatedAt: '2026-07-16T14:10:00+09:00',
      items: [{ temperature: '27', grid: { nx: 60, ny: 127 } }],
    })
    await expect(weatherApi.getLocations()).resolves.toEqual({
      regionLevel: 1,
      parents: [],
      items: [{ name: '서울특별시', fullName: '서울특별시', hasChildren: true }],
    })
    expect(fetchImplementation.mock.calls[0]?.[0]).toMatch(/\/weather\/current$/)
    expect(fetchImplementation.mock.calls[1]?.[0]).toMatch(/\/weather\/locations$/)
  })

  it('상위 지역명을 query에 전달하고 응답 단계와 부모를 확인한다', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        region_level: 3,
        parents: ['서울특별시', '종로구'],
        items: [
          {
            name: '청운효자동',
            full_name: '서울특별시 종로구 청운효자동',
            has_children: false,
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchImplementation)
    const { weatherApi } = await import('@/api/weather')

    await expect(
      weatherApi.getLocations({ regionLevel1: '서울특별시', regionLevel2: '종로구' }),
    ).resolves.toMatchObject({ regionLevel: 3, parents: ['서울특별시', '종로구'] })
    const requestUrl = String(fetchImplementation.mock.calls[0]?.[0])
    expect(requestUrl).toContain('region_level_1=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C')
    expect(requestUrl).toContain('region_level_2=%EC%A2%85%EB%A1%9C%EA%B5%AC')
  })

  it('지역과 좌표 예보 조회 방식을 정확히 구분해 요청한다', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          selector: 'region',
          region: '서울특별시 종로구',
          latitude: null,
          longitude: null,
          hours: 24,
          items: [gridForecastDto],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          selector: 'coordinates',
          region: null,
          latitude: 37.57,
          longitude: 126.98,
          hours: 6,
          items: [gridForecastDto],
        }),
      )
    vi.stubGlobal('fetch', fetchImplementation)
    const { weatherApi } = await import('@/api/weather')

    await expect(weatherApi.getForecast({ region: ' 서울특별시  종로구 ' })).resolves.toMatchObject({
      selector: 'region',
      region: '서울특별시 종로구',
      items: [{ forecasts: [{ skyStatusLabel: '구름많음' }] }],
    })
    await expect(
      weatherApi.getForecast({ latitude: 37.57, longitude: 126.98, hours: 6 }),
    ).resolves.toMatchObject({ selector: 'coordinates', latitude: 37.57, longitude: 126.98 })

    const regionUrl = String(fetchImplementation.mock.calls[0]?.[0])
    expect(regionUrl).toContain('hours=24')
    expect(regionUrl).toContain('region=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C+%EC%A2%85%EB%A1%9C%EA%B5%AC')
    expect(regionUrl).not.toContain('latitude=')
    const coordinateUrl = String(fetchImplementation.mock.calls[1]?.[0])
    expect(coordinateUrl).toContain('latitude=37.57')
    expect(coordinateUrl).toContain('longitude=126.98')
    expect(coordinateUrl).not.toContain('region=')
  })

  it('계약과 다른 응답 및 잘못된 요청 범위를 거부한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          selector: 'coordinates',
          region: '서울특별시',
          latitude: 37.57,
          longitude: 126.98,
          hours: 24,
          items: [gridForecastDto],
        }),
      ),
    )
    const { weatherApi } = await import('@/api/weather')

    await expect(
      weatherApi.getForecast({ latitude: 37.57, longitude: 126.98 }),
    ).rejects.toMatchObject({ name: 'ApiResponseError' })
    expect(() => weatherApi.getLocations({ regionLevel2: '종로구' })).toThrow(RangeError)
    expect(() => weatherApi.getForecast({ latitude: 10, longitude: 126.98 })).toThrow(RangeError)
    expect(() => weatherApi.getForecast({ region: ' ' })).toThrow(RangeError)
    expect(() => weatherApi.getForecast({ region: '서울', hours: 73 })).toThrow(RangeError)
  })
})
