const KAKAO_MAP_SDK_ID = 'kakao-map-sdk'
const KAKAO_MAP_SDK_TIMEOUT_MS = 12_000
const KAKAO_MAP_SDK_SAFE_URL = 'https://dapi.kakao.com/v2/maps/sdk.js'
const KAKAO_MAP_LOG_PREFIX = '[weather:kakao-map]'

export type KakaoMapFailureKind = 'configuration' | 'initialization' | 'load' | 'quota'
export type KakaoMapLogLevel = 'error' | 'info' | 'warn'
export type KakaoMapLogDetails = Readonly<
  Record<string, boolean | number | readonly string[] | string | null>
>

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
let nextDiagnosticId = 0

export function createKakaoMapDiagnosticId(scope: string): string {
  nextDiagnosticId += 1
  return `${scope}-${nextDiagnosticId}`
}

export function logKakaoMapEvent(
  level: KakaoMapLogLevel,
  event: string,
  details: KakaoMapLogDetails,
): void {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  }
  const message = `${KAKAO_MAP_LOG_PREFIX} ${event}`
  switch (level) {
    case 'error':
      console.error(message, payload)
      break
    case 'warn':
      console.warn(message, payload)
      break
    case 'info':
      console.info(message, payload)
      break
  }
}

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

function isKakaoMapsLoaderNamespace(value: unknown): value is KakaoMapsLoaderNamespace {
  return isRecord(value) && typeof value.load === 'function'
}

function missingKakaoMapsMembers(value: unknown): readonly string[] {
  if (!isRecord(value)) return ['maps']
  const missing: string[] = []
  if (typeof value.CustomOverlay !== 'function') missing.push('CustomOverlay')
  if (typeof value.LatLng !== 'function') missing.push('LatLng')
  if (typeof value.LatLngBounds !== 'function') missing.push('LatLngBounds')
  if (typeof value.Map !== 'function') missing.push('Map')
  if (typeof value.load !== 'function') missing.push('load')
  if (!isRecord(value.event)) {
    missing.push('event')
  } else {
    if (typeof value.event.addListener !== 'function') missing.push('event.addListener')
    if (typeof value.event.removeListener !== 'function') missing.push('event.removeListener')
  }
  return missing
}

function getLoadedMaps(windowObject: Window): KakaoMapsNamespace | null {
  const maps: unknown = windowObject.kakao?.maps
  return isKakaoMapsNamespace(maps) ? maps : null
}

function getMapsLoader(windowObject: Window): KakaoMapsLoaderNamespace | null {
  const maps: unknown = windowObject.kakao?.maps
  return isKakaoMapsLoaderNamespace(maps) ? maps : null
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
  mapsLoader: KakaoMapsLoaderNamespace,
  windowObject: Window,
  diagnosticId: string,
): Promise<KakaoMapsNamespace> {
  const startedAt = Date.now()
  logKakaoMapEvent('info', 'sdk.initialization_started', {
    diagnosticId,
    frontendOrigin: windowObject.location.origin,
    timeoutMs: KAKAO_MAP_SDK_TIMEOUT_MS,
  })
  return new Promise((resolve, reject) => {
    let settled = false
    const timeoutId = windowObject.setTimeout(() => {
      settled = true
      logKakaoMapEvent('error', 'sdk.initialization_timeout', {
        diagnosticId,
        elapsedMs: Date.now() - startedAt,
        frontendOrigin: windowObject.location.origin,
        timeoutMs: KAKAO_MAP_SDK_TIMEOUT_MS,
      })
      reject(new KakaoMapLoadError('initialization'))
    }, KAKAO_MAP_SDK_TIMEOUT_MS)
    try {
      mapsLoader.load(() => {
        if (settled) return
        settled = true
        windowObject.clearTimeout(timeoutId)
        const initializedMaps = getLoadedMaps(windowObject)
        if (initializedMaps === null) {
          const rawMaps: unknown = windowObject.kakao?.maps
          logKakaoMapEvent('error', 'sdk.namespace_invalid', {
            diagnosticId,
            frontendOrigin: windowObject.location.origin,
            kakaoGlobalPresent: windowObject.kakao !== undefined,
            missingMembers: missingKakaoMapsMembers(rawMaps),
            validationStage: 'after_load_callback',
          })
          reject(new KakaoMapLoadError('initialization'))
          return
        }
        logKakaoMapEvent('info', 'sdk.initialization_completed', {
          diagnosticId,
          elapsedMs: Date.now() - startedAt,
          frontendOrigin: windowObject.location.origin,
        })
        resolve(initializedMaps)
      })
    } catch {
      if (settled) return
      settled = true
      windowObject.clearTimeout(timeoutId)
      logKakaoMapEvent('error', 'sdk.initialization_exception', {
        diagnosticId,
        elapsedMs: Date.now() - startedAt,
        frontendOrigin: windowObject.location.origin,
      })
      reject(new KakaoMapLoadError('initialization'))
    }
  })
}

function createSdkPromise(
  apiKey: string,
  documentObject: Document,
  windowObject: Window,
  diagnosticId: string,
): Promise<KakaoMapsNamespace> {
  const mapsLoader = getMapsLoader(windowObject)
  if (mapsLoader !== null) {
    logKakaoMapEvent('info', 'sdk.namespace_detected', {
      diagnosticId,
      frontendOrigin: windowObject.location.origin,
      namespaceState: getLoadedMaps(windowObject) === null ? 'bootstrap' : 'initialized',
      source: 'window.kakao.maps',
    })
    return waitForKakaoInitialization(mapsLoader, windowObject, diagnosticId)
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const existingScript = documentObject.getElementById(KAKAO_MAP_SDK_ID)
    const script =
      existingScript instanceof HTMLScriptElement
        ? existingScript
        : documentObject.createElement('script')
    const source = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(apiKey)}`
    logKakaoMapEvent('info', 'sdk.script_preparing', {
      autoload: false,
      diagnosticId,
      documentReadyState: documentObject.readyState,
      existingScript: existingScript !== null,
      frontendOrigin: windowObject.location.origin,
      libraries: [],
      sdkUrl: KAKAO_MAP_SDK_SAFE_URL,
      timeoutMs: KAKAO_MAP_SDK_TIMEOUT_MS,
    })
    const loadTimeoutId = windowObject.setTimeout(() => {
      script.remove()
      logKakaoMapEvent('error', 'sdk.script_load_timeout', {
        diagnosticId,
        elapsedMs: Date.now() - startedAt,
        frontendOrigin: windowObject.location.origin,
        sdkUrl: KAKAO_MAP_SDK_SAFE_URL,
        timeoutMs: KAKAO_MAP_SDK_TIMEOUT_MS,
      })
      reject(new KakaoMapLoadError('load'))
    }, KAKAO_MAP_SDK_TIMEOUT_MS)

    script.id = KAKAO_MAP_SDK_ID
    script.async = true
    script.src = source
    script.onload = () => {
      windowObject.clearTimeout(loadTimeoutId)
      logKakaoMapEvent('info', 'sdk.script_loaded', {
        diagnosticId,
        elapsedMs: Date.now() - startedAt,
        frontendOrigin: windowObject.location.origin,
        sdkUrl: KAKAO_MAP_SDK_SAFE_URL,
      })
      const loadedMapsLoader = getMapsLoader(windowObject)
      if (loadedMapsLoader === null) {
        const rawMaps: unknown = windowObject.kakao?.maps
        logKakaoMapEvent('error', 'sdk.namespace_invalid', {
          diagnosticId,
          frontendOrigin: windowObject.location.origin,
          kakaoGlobalPresent: windowObject.kakao !== undefined,
          missingMembers: missingKakaoMapsMembers(rawMaps),
          validationStage: 'after_script_load',
        })
        reject(new KakaoMapLoadError('initialization'))
        return
      }
      void waitForKakaoInitialization(loadedMapsLoader, windowObject, diagnosticId).then(
        resolve,
        reject,
      )
    }
    script.onerror = () => {
      windowObject.clearTimeout(loadTimeoutId)
      const status = readResourceResponseStatus(source, windowObject.performance)
      script.remove()
      logKakaoMapEvent('error', 'sdk.script_failed', {
        diagnosticId,
        elapsedMs: Date.now() - startedAt,
        frontendOrigin: windowObject.location.origin,
        responseStatus: status,
        sdkUrl: KAKAO_MAP_SDK_SAFE_URL,
      })
      reject(new KakaoMapLoadError(status === 429 ? 'quota' : 'load', status))
    }

    if (existingScript === null) {
      documentObject.head.append(script)
      logKakaoMapEvent('info', 'sdk.script_appended', {
        diagnosticId,
        frontendOrigin: windowObject.location.origin,
        scriptId: KAKAO_MAP_SDK_ID,
      })
    } else {
      logKakaoMapEvent('warn', 'sdk.script_reused', {
        diagnosticId,
        frontendOrigin: windowObject.location.origin,
        scriptId: KAKAO_MAP_SDK_ID,
      })
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
  diagnosticId: string = createKakaoMapDiagnosticId('sdk'),
): Promise<KakaoMapsNamespace> {
  const normalizedApiKey = apiKey?.trim() ?? ''
  logKakaoMapEvent('info', 'loader.requested', {
    diagnosticId,
    frontendOrigin: window.location.origin,
    keyConfigured: normalizedApiKey.length > 0,
    sdkPromiseCached: sdkPromise !== null,
  })
  if (normalizedApiKey.length === 0) {
    logKakaoMapEvent('error', 'loader.configuration_missing', {
      diagnosticId,
      envName: 'KAKAO_KEY',
      frontendOrigin: window.location.origin,
    })
    return Promise.reject(new KakaoMapLoadError('configuration'))
  }
  if (sdkPromise !== null) {
    logKakaoMapEvent('info', 'loader.cache_reused', {
      diagnosticId,
      frontendOrigin: window.location.origin,
    })
  }
  sdkPromise ??= createSdkPromise(
    normalizedApiKey,
    document,
    window,
    diagnosticId,
  ).catch((error: unknown) => {
    const kind = error instanceof KakaoMapLoadError ? error.kind : 'unknown'
    const status = error instanceof KakaoMapLoadError ? error.status : null
    logKakaoMapEvent('error', 'loader.failed', {
      diagnosticId,
      errorKind: kind,
      errorName: error instanceof Error ? error.name : 'unknown',
      frontendOrigin: window.location.origin,
      responseStatus: status,
    })
    sdkPromise = null
    throw error
  })
  return sdkPromise
}
