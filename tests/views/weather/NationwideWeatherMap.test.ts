import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KakaoMapLoadError } from '@/integrations/kakao-maps'
import NationwideWeatherMap from '@/views/weather/NationwideWeatherMap.vue'

const mocks = vi.hoisted(() => ({
  loadKakaoMapsSdk: vi.fn(),
}))

vi.mock('@/integrations/kakao-maps', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/integrations/kakao-maps')>()
  return { ...original, loadKakaoMapsSdk: mocks.loadKakaoMapsSdk }
})

const item = {
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
  grid: { nx: 60, ny: 127, latitude: 37.57, longitude: 126.98 },
  issuedAt: '2026-07-16T14:00:00+09:00',
} as const

class FakeLatLng {
  constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {}
}

class FakeBounds {
  readonly extend = vi.fn()
}

class FakeMap {
  readonly setBounds = vi.fn()
}

const overlayContents: Node[] = []
class FakeOverlay {
  readonly setMap = vi.fn()

  constructor(options: { content: Node | string }) {
    if (options.content instanceof Node) overlayContents.push(options.content)
  }
}

let tilesLoadedHandler: (() => void) | null = null

function createMapsApi() {
  return {
    CustomOverlay: FakeOverlay,
    LatLng: FakeLatLng,
    LatLngBounds: FakeBounds,
    Map: FakeMap,
    event: {
      addListener: vi.fn((_target: unknown, _type: string, handler: () => void) => {
        tilesLoadedHandler = handler
      }),
      removeListener: vi.fn(),
    },
    load: vi.fn(),
  }
}

function finishTileLoading(): void {
  if (tilesLoadedHandler === null) throw new Error('tilesloaded listener was not registered')
  tilesLoadedHandler()
}

describe('NationwideWeatherMap', () => {
  beforeEach(() => {
    mocks.loadKakaoMapsSdk.mockReset()
    overlayContents.length = 0
    tilesLoadedHandler = null
  })

  afterEach(() => vi.unstubAllGlobals())

  it('카카오맵에 대표 지역 날씨 오버레이를 표시하고 길찾기 링크를 만들지 않는다', async () => {
    const mapsApi = createMapsApi()
    mocks.loadKakaoMapsSdk.mockResolvedValue(mapsApi)
    render(NationwideWeatherMap, { props: { items: [item] } })

    await waitFor(() => expect(mapsApi.event.addListener).toHaveBeenCalled())
    finishTileLoading()

    const map = screen.getByRole('img', { name: '카카오맵으로 표시한 대한민국 주요 지역 현재 날씨' })
    await waitFor(() => expect(map).toHaveAttribute('aria-busy', 'false'))
    expect(overlayContents.length).toBeGreaterThan(0)
    expect(overlayContents[0]).toHaveTextContent('27°')
    expect(document.querySelector('a[href*="map.kakao.com/link/to"]')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: '주요 지역 날씨' })).toHaveTextContent('서울')
  })

  it('카카오맵이 429를 반환하면 기존 간단 지도와 제한 안내를 표시한다', async () => {
    mocks.loadKakaoMapsSdk.mockRejectedValue(new KakaoMapLoadError('quota', 429))
    render(NationwideWeatherMap, { props: { items: [item] } })

    expect(
      await screen.findByRole('img', { name: /대한민국 주요 지역 현재 날씨 간단 지도/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '카카오맵 사용량 제한에 도달해 간단 지도를 표시합니다.',
    )
  })

  it('지도를 표시한 뒤 타일 요청이 429로 실패해도 간단 지도로 전환한다', async () => {
    const mapsApi = createMapsApi()
    mocks.loadKakaoMapsSdk.mockResolvedValue(mapsApi)
    vi.stubGlobal('performance', {
      getEntriesByName: vi.fn(() => [{ responseStatus: 429 }]),
    })
    render(NationwideWeatherMap, { props: { items: [item] } })
    await waitFor(() => expect(mapsApi.event.addListener).toHaveBeenCalled())
    finishTileLoading()

    const failedTile = document.createElement('img')
    failedTile.src = 'https://map0.daumcdn.net/map_2d/failed-tile.png'
    document.body.append(failedTile)
    failedTile.dispatchEvent(new Event('error'))

    expect(
      await screen.findByRole('img', { name: /대한민국 주요 지역 현재 날씨 간단 지도/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('카카오맵 사용량 제한에 도달')
  })
})
