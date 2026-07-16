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
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    window.kakao = undefined
    document.getElementById('kakao-map-sdk')?.remove()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.kakao = undefined
    document.getElementById('kakao-map-sdk')?.remove()
  })

  // autoload=false에서는 스크립트 직후 load만 존재하며, 콜백에서 전체 API가 준비된다.
  it('부트스트랩 SDK의 kakao.maps.load 완료 후 전체 지도 API를 검증한다', async () => {
    const { loadKakaoMapsSdk } = await import('@/integrations/kakao-maps')
    const loading = loadKakaoMapsSdk('javascript-key')
    const script = document.getElementById('kakao-map-sdk')

    expect(script).toBeInstanceOf(HTMLScriptElement)
    expect(script).toHaveAttribute(
      'src',
      'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=javascript-key',
    )
    expect(script).not.toHaveAttribute('src', expect.stringContaining('libraries='))

    const initializedMaps = createMapsApi()
    const load = vi.fn((callback: () => void) => {
      window.kakao = { maps: initializedMaps }
      callback()
    })
    window.kakao = { maps: { load } }
    script?.dispatchEvent(new Event('load'))

    await expect(loading).resolves.toBe(initializedMaps)
    expect(load).toHaveBeenCalledOnce()
    const logs = JSON.stringify(vi.mocked(console.info).mock.calls)
    expect(logs).toContain('loader.requested')
    expect(logs).toContain('sdk.script_preparing')
    expect(logs).toContain('sdk.initialization_completed')
    expect(logs).toContain(window.location.origin)
    expect(logs).not.toContain('javascript-key')
  })

  it('load 콜백 이후에도 전체 API가 없으면 초기화 오류를 반환한다', async () => {
    const { loadKakaoMapsSdk } = await import('@/integrations/kakao-maps')
    const loading = loadKakaoMapsSdk('javascript-key')
    const script = document.getElementById('kakao-map-sdk')
    window.kakao = { maps: { load: (callback) => callback() } }

    script?.dispatchEvent(new Event('load'))

    await expect(loading).rejects.toMatchObject({ kind: 'initialization' })
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logs).toContain('sdk.namespace_invalid')
    expect(logs).toContain('after_load_callback')
    expect(logs).toContain('CustomOverlay')
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
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logs).toContain('sdk.script_failed')
    expect(logs).toContain('loader.failed')
    expect(logs).toContain('429')
    expect(logs).not.toContain('javascript-key')
  })

  it('키가 없으면 외부 요청을 만들지 않고 설정 오류를 반환한다', async () => {
    const { loadKakaoMapsSdk } = await import('@/integrations/kakao-maps')

    await expect(loadKakaoMapsSdk(' ')).rejects.toMatchObject({ kind: 'configuration' })
    expect(document.getElementById('kakao-map-sdk')).not.toBeInTheDocument()
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain(
      'loader.configuration_missing',
    )
  })

  it('지도 타일과 무관한 카카오 이미지 URL을 지도 오류로 취급하지 않는다', async () => {
    const { isKakaoMapResourceUrl } = await import('@/integrations/kakao-maps')

    expect(isKakaoMapResourceUrl('https://map0.daumcdn.net/map_2d/1.png')).toBe(true)
    expect(isKakaoMapResourceUrl('https://t1.daumcdn.net/mapjsapi/images/map.png')).toBe(true)
    expect(isKakaoMapResourceUrl('https://k.kakaocdn.net/profile/image.png')).toBe(false)
    expect(isKakaoMapResourceUrl('https://accounts.kakao.com/logo.png')).toBe(false)
  })
})
