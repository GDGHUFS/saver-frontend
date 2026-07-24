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
  aiSummary: string | null
  elapsedMilliseconds: number
  items: readonly SearchResultItem[]
  relatedSearches: readonly string[]
}

export interface SearchAccepted {
  magicCode: string
  status: 'PENDING'
}

export type SearchPollResponse =
  | { magicCode: string; result?: SearchResult; status: 'PENDING' }
  | { magicCode: string; result: SearchResult; status: 'COMPLETED' | 'PARTIAL' }

type SearchBranchStatus = 'COMPLETED' | 'FAILED' | 'PENDING'

interface DecodedSearchBranch<T> {
  result: T | null
  status: SearchBranchStatus
}

interface DecodedSearchResults {
  intelligentResultReady: boolean
  result: SearchResult
}

type DecodedSearchResult = Omit<SearchResult, 'aiSummary'>
type DecodedIntelligentSearchResult = DecodedSearchResult & { answer: string }

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

function decodeBranchStatus(value: unknown, field: string): SearchBranchStatus {
  if (value !== 'COMPLETED' && value !== 'FAILED' && value !== 'PENDING') {
    throw new Error(`${field} status is invalid`)
  }
  return value
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

function decodeSearchResult(value: unknown): DecodedSearchResult {
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

function decodeIntelligentSearchResult(value: unknown): DecodedIntelligentSearchResult {
  const result = decodeSearchResult(value)
  if (!isRecord(value)) {
    throw new Error('intelligent search result must be an object')
  }

  const answer = decodeNonEmptyString(value.answer, 'intelligent search answer')
  if (answer.length > 20_000) {
    throw new Error('intelligent search answer must not exceed 20000 characters')
  }

  return { ...result, answer }
}

function decodeSearchBranch<T>(
  value: unknown,
  field: string,
  decodeResult: (result: unknown) => T,
): DecodedSearchBranch<T> {
  if (!isRecord(value)) {
    throw new Error(`${field} search branch must be an object`)
  }

  return {
    result: value.result === undefined || value.result === null ? null : decodeResult(value.result),
    status: decodeBranchStatus(value.status, field),
  }
}

function decodeSearchResults(value: unknown): DecodedSearchResults {
  if (!isRecord(value)) {
    throw new Error('search results must be an object')
  }

  const legacy = decodeSearchBranch(value.legacy, 'legacy', decodeSearchResult)
  const intelligent = decodeSearchBranch(
    value.intelligent,
    'intelligent',
    decodeIntelligentSearchResult,
  )
  const legacyResult = legacy.status === 'COMPLETED' ? legacy.result : null
  const intelligentResult = intelligent.status === 'COMPLETED' ? intelligent.result : null
  const displayedResult = legacyResult ?? intelligentResult

  return {
    intelligentResultReady: intelligentResult !== null,
    result: {
      aiSummary: intelligentResult?.answer ?? null,
      elapsedMilliseconds: displayedResult?.elapsedMilliseconds ?? 0,
      items: displayedResult?.items ?? [],
      relatedSearches: displayedResult?.relatedSearches ?? [],
    },
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
    if (value.status !== 'PENDING') {
      throw new Error('search poll status must be PENDING')
    }
    const results = decodeSearchResults(value.results)
    if (results.intelligentResultReady) {
      return {
        magicCode,
        result: results.result,
        status: decodeStatus(value.status, 'PENDING'),
      }
    }
    return { magicCode, status: decodeStatus(value.status, 'PENDING') }
  }
  if (response.status === 200) {
    if (value.status !== 'COMPLETED' && value.status !== 'PARTIAL') {
      throw new Error('completed search poll status is invalid')
    }
    const results = decodeSearchResults(value.results)
    return {
      magicCode,
      result: results.result,
      status: value.status,
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
