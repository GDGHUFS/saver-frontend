import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeLatLng implements KakaoLatLng {
  constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {}
}

class FakeLatLngBounds implements KakaoLatLngBounds {
  extend(): void {}
}

class FakeMap implements KakaoMap {
  constructor(
    _container: HTMLElement,
    _options: {
      center: KakaoLatLng
    },
  ) {}

  setBounds(): void {}
}

class FakeCustomOverlay implements KakaoCustomOverlay {
  constructor(_options: { content: Node | string; position: KakaoLatLng }) {}

  setMap(): void {}
}

function createMapsApi(): KakaoMapsNamespace {
  return {
    CustomOverlay: FakeCustomOverlay,
    LatLng: FakeLatLng,
    LatLngBounds: FakeLatLngBounds,
    Map: FakeMap,
    event: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
    load: (callback) => callback(),
  }
}

describe('Kakao Maps SDK loader', () => {
  beforeEach(() => {
    vi.resetModules()
    window.kakao = undefined
    document.getElementById('kakao-map-sdk')?.remove()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.kakao = undefined
    document.getElementById('kakao-map-sdk')?.remove()
  })

  // 공식 동적 로딩 계약인 autoload=false와 JavaScript appkey만 사용하는지 보호한다.
  it('추가 라이브러리 없이 SDK를 로드한 뒤 kakao.maps.load 완료를 기다린다', async () => {
    const { loadKakaoMapsSdk } = await import('@/integrations/kakao-maps')
    const loading = loadKakaoMapsSdk('javascript-key')
    const script = document.getElementById('kakao-map-sdk')

    expect(script).toBeInstanceOf(HTMLScriptElement)
    expect(script).toHaveAttribute(
      'src',
      'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=javascript-key',
    )
    expect(script).not.toHaveAttribute('src', expect.stringContaining('libraries='))

    window.kakao = { maps: createMapsApi() }
    script?.dispatchEvent(new Event('load'))

    await expect(loading).resolves.toBe(window.kakao.maps)
  })

  it('SDK의 429 응답을 사용량 제한 오류로 변환한다', async () => {
    vi.stubGlobal('performance', {
      getEntriesByName: vi.fn(() => [{ responseStatus: 429 }]),
    })
    const { loadKakaoMapsSdk } = await import('@/integrations/kakao-maps')
    const loading = loadKakaoMapsSdk('javascript-key')
    const script = document.getElementById('kakao-map-sdk')

    script?.dispatchEvent(new Event('error'))

    await expect(loading).rejects.toMatchObject({ kind: 'quota', status: 429 })
    expect(document.getElementById('kakao-map-sdk')).not.toBeInTheDocument()
  })

  it('키가 없으면 외부 요청을 만들지 않고 설정 오류를 반환한다', async () => {
    const { loadKakaoMapsSdk } = await import('@/integrations/kakao-maps')

    await expect(loadKakaoMapsSdk(' ')).rejects.toMatchObject({ kind: 'configuration' })
    expect(document.getElementById('kakao-map-sdk')).not.toBeInTheDocument()
  })

  it('지도 타일과 무관한 카카오 이미지 URL을 지도 오류로 취급하지 않는다', async () => {
    const { isKakaoMapResourceUrl } = await import('@/integrations/kakao-maps')

    expect(isKakaoMapResourceUrl('https://map0.daumcdn.net/map_2d/1.png')).toBe(true)
    expect(isKakaoMapResourceUrl('https://t1.daumcdn.net/mapjsapi/images/map.png')).toBe(true)
    expect(isKakaoMapResourceUrl('https://k.kakaocdn.net/profile/image.png')).toBe(false)
    expect(isKakaoMapResourceUrl('https://accounts.kakao.com/logo.png')).toBe(false)
  })
})
