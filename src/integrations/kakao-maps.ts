const KAKAO_MAP_SDK_ID = 'kakao-map-sdk'
const KAKAO_MAP_SDK_TIMEOUT_MS = 12_000

export type KakaoMapFailureKind = 'configuration' | 'initialization' | 'load' | 'quota'

export class KakaoMapLoadError extends Error {
  readonly kind: KakaoMapFailureKind
  readonly status: number | null

  constructor(kind: KakaoMapFailureKind, status: number | null = null) {
    super(
      kind === 'quota'
        ? 'Kakao Maps quota has been exceeded'
        : `Kakao Maps failed during ${kind}`,
    )
    this.name = 'KakaoMapLoadError'
    this.kind = kind
    this.status = status
  }
}

let sdkPromise: Promise<KakaoMapsNamespace> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isKakaoMapsNamespace(value: unknown): value is KakaoMapsNamespace {
  return (
    isRecord(value) &&
    typeof value.CustomOverlay === 'function' &&
    typeof value.LatLng === 'function' &&
    typeof value.LatLngBounds === 'function' &&
    typeof value.Map === 'function' &&
    typeof value.load === 'function' &&
    isRecord(value.event) &&
    typeof value.event.addListener === 'function' &&
    typeof value.event.removeListener === 'function'
  )
}

function getLoadedMaps(windowObject: Window): KakaoMapsNamespace | null {
  const maps: unknown = windowObject.kakao?.maps
  return isKakaoMapsNamespace(maps) ? maps : null
}

function readResourceResponseStatus(
  resourceUrl: string,
  performanceObject: Performance,
): number | null {
  const entries = performanceObject.getEntriesByName(resourceUrl)
  const entry: unknown = entries[entries.length - 1]
  if (isRecord(entry) && typeof entry.responseStatus === 'number') {
    return entry.responseStatus
  }
  return null
}

function waitForKakaoInitialization(
  maps: KakaoMapsNamespace,
  windowObject: Window,
): Promise<KakaoMapsNamespace> {
  return new Promise((resolve, reject) => {
    const timeoutId = windowObject.setTimeout(
      () => reject(new KakaoMapLoadError('initialization')),
      KAKAO_MAP_SDK_TIMEOUT_MS,
    )
    try {
      maps.load(() => {
        windowObject.clearTimeout(timeoutId)
        resolve(maps)
      })
    } catch {
      windowObject.clearTimeout(timeoutId)
      reject(new KakaoMapLoadError('initialization'))
    }
  })
}

function createSdkPromise(
  apiKey: string,
  documentObject: Document,
  windowObject: Window,
): Promise<KakaoMapsNamespace> {
  const loadedMaps = getLoadedMaps(windowObject)
  if (loadedMaps !== null) {
    return waitForKakaoInitialization(loadedMaps, windowObject)
  }

  return new Promise((resolve, reject) => {
    const existingScript = documentObject.getElementById(KAKAO_MAP_SDK_ID)
    const script =
      existingScript instanceof HTMLScriptElement
        ? existingScript
        : documentObject.createElement('script')
    const source = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(apiKey)}`
    const timeoutId = windowObject.setTimeout(() => {
      script.remove()
      reject(new KakaoMapLoadError('load'))
    }, KAKAO_MAP_SDK_TIMEOUT_MS)

    script.id = KAKAO_MAP_SDK_ID
    script.async = true
    script.src = source
    script.onload = () => {
      const maps = getLoadedMaps(windowObject)
      if (maps === null) {
        windowObject.clearTimeout(timeoutId)
        reject(new KakaoMapLoadError('initialization'))
        return
      }
      void waitForKakaoInitialization(maps, windowObject).then(resolve, reject).finally(() => {
        windowObject.clearTimeout(timeoutId)
      })
    }
    script.onerror = () => {
      windowObject.clearTimeout(timeoutId)
      const status = readResourceResponseStatus(source, windowObject.performance)
      script.remove()
      reject(new KakaoMapLoadError(status === 429 ? 'quota' : 'load', status))
    }

    if (existingScript === null) {
      documentObject.head.append(script)
    }
  })
}

export function isKakaoMapResourceUrl(value: string): boolean {
  try {
    const url = new URL(value, window.location.href)
    const { hostname, pathname } = url
    return (
      hostname === 'dapi.kakao.com' ||
      /^map[0-9]+\.daumcdn\.net$/.test(hostname) ||
      (/^t[0-9]+\.daumcdn\.net$/.test(hostname) && pathname.includes('/map'))
    )
  } catch {
    return false
  }
}

export function getKakaoMapResourceStatus(resourceUrl: string): number | null {
  return readResourceResponseStatus(resourceUrl, window.performance)
}

export function loadKakaoMapsSdk(
  apiKey: string | undefined = import.meta.env.VITE_KAKAO_MAP_API_KEY,
): Promise<KakaoMapsNamespace> {
  const normalizedApiKey = apiKey?.trim() ?? ''
  if (normalizedApiKey.length === 0) {
    return Promise.reject(new KakaoMapLoadError('configuration'))
  }
  sdkPromise ??= createSdkPromise(normalizedApiKey, document, window).catch((error: unknown) => {
    sdkPromise = null
    throw error
  })
  return sdkPromise
}
