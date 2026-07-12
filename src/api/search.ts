import { apiClient } from '@/api/client'

export const SEARCH_QUERY_MAX_LENGTH = 200
export const SEARCH_MAGIC_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/

export interface SearchResultItem {
  imageUrl: string | null
  snippet: string | null
  title: string
  url: string
}

export interface SearchResult {
  elapsedMilliseconds: number
  items: readonly SearchResultItem[]
  relatedSearches: readonly string[]
}

export interface SearchAccepted {
  magicCode: string
  status: 'PENDING'
}

export type SearchPollResponse =
  | { magicCode: string; status: 'PENDING' }
  | { magicCode: string; result: SearchResult; status: 'COMPLETED' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function decodeNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  return value
}

function decodeOptionalNullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string or null`)
  }
  return value
}

function decodeMagicCode(value: unknown): string {
  if (typeof value !== 'string' || !SEARCH_MAGIC_CODE_PATTERN.test(value)) {
    throw new Error('magicCode is invalid')
  }
  return value
}

function decodeStatus<T extends 'COMPLETED' | 'PENDING'>(
  value: unknown,
  expected: T,
): T {
  if (value !== undefined && value !== expected) {
    throw new Error(`status must be ${expected}`)
  }
  return expected
}

function decodeSearchItem(value: unknown): SearchResultItem {
  if (!isRecord(value)) {
    throw new Error('search item must be an object')
  }

  let imageUrl: string | null = null
  if (value.image !== undefined && value.image !== null) {
    if (!isRecord(value.image)) {
      throw new Error('search item image must be an object or null')
    }
    imageUrl = decodeNonEmptyString(value.image.url, 'search item image url')
  }

  return {
    imageUrl,
    snippet: decodeOptionalNullableString(value.snippet, 'search item snippet'),
    title: decodeNonEmptyString(value.title, 'search item title'),
    url: decodeNonEmptyString(value.url, 'search item url'),
  }
}

function decodeSearchItems(value: unknown): readonly SearchResultItem[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error('search data search must be an array')
  }
  return value.map(decodeSearchItem)
}

function decodeRelatedSearches(value: unknown): readonly string[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error('related_search must be an array')
  }
  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error('related search must be an object')
    }
    return decodeNonEmptyString(item.title, 'related search title')
  })
}

function decodeSearchResult(value: unknown): SearchResult {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.meta)) {
    throw new Error('search result must contain data and meta objects')
  }
  if (
    typeof value.meta.ms !== 'number' ||
    !Number.isSafeInteger(value.meta.ms) ||
    value.meta.ms < 0
  ) {
    throw new Error('search result meta ms must be a non-negative integer')
  }

  return {
    elapsedMilliseconds: value.meta.ms,
    items: decodeSearchItems(value.data.search),
    relatedSearches: decodeRelatedSearches(value.data.related_search),
  }
}

function decodeAccepted(value: unknown, response: Response): SearchAccepted {
  if (response.status !== 202 || !isRecord(value)) {
    throw new Error('search acceptance response is invalid')
  }
  return {
    magicCode: decodeMagicCode(value.magicCode),
    status: decodeStatus(value.status, 'PENDING'),
  }
}

function decodePollResponse(value: unknown, response: Response): SearchPollResponse {
  if (!isRecord(value)) {
    throw new Error('search poll response must be an object')
  }

  const magicCode = decodeMagicCode(value.magicCode)
  if (response.status === 202) {
    return { magicCode, status: decodeStatus(value.status, 'PENDING') }
  }
  if (response.status === 200) {
    return {
      magicCode,
      result: decodeSearchResult(value.result),
      status: decodeStatus(value.status, 'COMPLETED'),
    }
  }
  throw new Error('search poll response has an unexpected status')
}

export function normalizeSearchQuery(query: string): string {
  const normalized = query.trim().replace(/\s+/g, ' ')
  if (normalized.length < 1 || normalized.length > SEARCH_QUERY_MAX_LENGTH) {
    throw new RangeError(`query must be between 1 and ${SEARCH_QUERY_MAX_LENGTH} characters`)
  }
  return normalized
}

function assertMagicCode(magicCode: string): void {
  if (!SEARCH_MAGIC_CODE_PATTERN.test(magicCode)) {
    throw new RangeError('magicCode must be a 43-character URL-safe value')
  }
}

export const searchApi = {
  submit(query: string, signal?: AbortSignal): Promise<SearchAccepted> {
    return apiClient.request('/search', {
      body: { query: normalizeSearchQuery(query) },
      decoder: decodeAccepted,
      method: 'POST',
      signal,
    })
  },

  getResult(magicCode: string, signal?: AbortSignal): Promise<SearchPollResponse> {
    assertMagicCode(magicCode)
    return apiClient.request(`/search/${magicCode}`, {
      decoder: decodePollResponse,
      signal,
    })
  },
}
