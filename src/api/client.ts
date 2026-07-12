export type ApiDecoder<T> = (value: unknown, response: Response) => T

export type ApiQuery = Record<string, boolean | number | string | null | undefined>

interface SharedRequestOptions {
  body?: unknown
  headers?: HeadersInit
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
  query?: ApiQuery
  signal?: AbortSignal
  timeoutMs?: number
}

interface DataRequestOptions<T> extends SharedRequestOptions {
  decoder: ApiDecoder<T>
}

interface EmptyRequestOptions extends SharedRequestOptions {
  decoder?: never
}

interface ApiClientOptions {
  baseUrl?: string
  defaultTimeoutMs?: number
  fetchImplementation?: typeof fetch
}

export class ApiHttpError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(status: number, payload: unknown) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiHttpError'
    this.status = status
    this.payload = payload
  }
}

export class ApiResponseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiResponseError'
  }
}

export class ApiNetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiNetworkError'
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function createUrl(baseUrl: string, path: string, query?: ApiQuery): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${baseUrl}${normalizedPath}`

  if (query === undefined) {
    return url
  }

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) {
      searchParams.set(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  return queryString.length > 0 ? `${url}?${queryString}` : url
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text.length === 0) {
    return undefined
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return text
  }

  try {
    const payload: unknown = JSON.parse(text)
    return payload
  } catch (error: unknown) {
    throw new ApiResponseError('API response is not valid JSON', { cause: error })
  }
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly defaultTimeoutMs: number
  private readonly fetchImplementation: typeof fetch

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? '')
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000
    this.fetchImplementation = options.fetchImplementation ?? window.fetch.bind(window)
  }

  getUrl(path: string, query?: ApiQuery): string {
    return createUrl(this.baseUrl, path, query)
  }

  request<T>(path: string, options: DataRequestOptions<T>): Promise<T>
  request(path: string, options?: EmptyRequestOptions): Promise<void>
  async request<T>(
    path: string,
    options: DataRequestOptions<T> | EmptyRequestOptions = {},
  ): Promise<T | void> {
    const controller = new AbortController()
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
    const abortFromCaller = (): void => controller.abort(options.signal?.reason)

    if (options.signal?.aborted === true) {
      abortFromCaller()
    } else {
      options.signal?.addEventListener('abort', abortFromCaller, { once: true })
    }

    const headers = new Headers(options.headers)
    let body: BodyInit | undefined
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }

    try {
      const response = await this.fetchImplementation(this.getUrl(path, options.query), {
        body,
        credentials: 'include',
        headers,
        method: options.method ?? 'GET',
        signal: controller.signal,
      })
      const payload = await readResponsePayload(response)

      if (!response.ok) {
        throw new ApiHttpError(response.status, payload)
      }

      if ('decoder' in options && options.decoder !== undefined) {
        try {
          return options.decoder(payload, response)
        } catch (error: unknown) {
          throw new ApiResponseError('API response does not match the expected schema', {
            cause: error,
          })
        }
      }

      return undefined
    } catch (error: unknown) {
      if (
        error instanceof ApiHttpError ||
        error instanceof ApiResponseError ||
        options.signal?.aborted === true
      ) {
        throw error
      }

      const message = controller.signal.aborted
        ? `API request timed out after ${timeoutMs}ms`
        : 'API request failed before receiving a response'
      throw new ApiNetworkError(message, { cause: error })
    } finally {
      window.clearTimeout(timeoutId)
      options.signal?.removeEventListener('abort', abortFromCaller)
    }
  }
}

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
})
