import { ApiClient } from '@/api/client'
import { normalizeSearchQuery } from '@/api/search'

export type ResearchSearchSource = 'blog' | 'hufspress'
export type ResearchMatchMethod = 'dense' | 'keyword'

export interface ResearchSearchChunk {
  chunkId: number
  chunkIndex: number
  excerpt: string
  heading: string | null
  sectionPath: string | null
}

export interface ResearchSearchItem {
  author: string | null
  category: string | null
  chunk: ResearchSearchChunk
  documentId: number
  matchedBy: readonly ResearchMatchMethod[]
  publishedAt: string | null
  rank: number
  score: number
  sourceId: number
  sourceType: ResearchSearchSource
  title: string
  topics: readonly string[]
}

export interface ResearchSearchResult {
  items: readonly ResearchSearchItem[]
  noResult: boolean
  normalizedQuery: string
  query: string
  resultCount: number
  similarityThreshold: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function decodeString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`)
  }
  return value
}

function decodeNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null
  }
  return decodeString(value, field)
}

function decodeInteger(value: unknown, field: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be an integer greater than or equal to ${minimum}`)
  }
  return value
}

function decodeFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`)
  }
  return value
}

function decodeSource(value: unknown): ResearchSearchSource {
  if (value !== 'blog' && value !== 'hufspress') {
    throw new Error('source_type is invalid')
  }
  return value
}

function decodeMatchMethods(value: unknown): readonly ResearchMatchMethod[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('matched_by must be a non-empty array')
  }

  return value.map((method) => {
    if (method !== 'dense' && method !== 'keyword') {
      throw new Error('matched_by contains an invalid search method')
    }
    return method
  })
}

function decodeStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`)
  }
  return value.map((item) => decodeString(item, `${field} item`))
}

function decodeDate(value: unknown): string | null {
  if (value === null) {
    return null
  }

  const date = decodeString(value, 'published_at')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error('published_at must be an ISO 8601 date')
  }
  return date
}

function decodeChunk(value: unknown): ResearchSearchChunk {
  if (!isRecord(value)) {
    throw new Error('chunk must be an object')
  }

  return {
    chunkId: decodeInteger(value.chunk_id, 'chunk.chunk_id', 1),
    chunkIndex: decodeInteger(value.chunk_index, 'chunk.chunk_index', 0),
    excerpt: decodeString(value.excerpt, 'chunk.excerpt'),
    heading: decodeNullableString(value.heading, 'chunk.heading'),
    sectionPath: decodeNullableString(value.section_path, 'chunk.section_path'),
  }
}

function decodeSearchItem(value: unknown): ResearchSearchItem {
  if (!isRecord(value)) {
    throw new Error('search result item must be an object')
  }

  const score = decodeFiniteNumber(value.score, 'score')
  if (score <= 0) {
    throw new Error('score must be greater than zero')
  }

  return {
    author: decodeNullableString(value.author, 'author'),
    category: decodeNullableString(value.category, 'category'),
    chunk: decodeChunk(value.chunk),
    documentId: decodeInteger(value.document_id, 'document_id', 1),
    matchedBy: decodeMatchMethods(value.matched_by),
    publishedAt: decodeDate(value.published_at),
    rank: decodeInteger(value.rank, 'rank', 1),
    score,
    sourceId: decodeInteger(value.source_id, 'source_id', 1),
    sourceType: decodeSource(value.source_type),
    title: decodeString(value.title, 'title'),
    topics: decodeStringArray(value.topics, 'topics'),
  }
}

function decodeSearchResponse(value: unknown, response: Response): ResearchSearchResult {
  if (response.status !== 200 || !isRecord(value)) {
    throw new Error('research search response is invalid')
  }
  if (value.search_mode !== undefined && value.search_mode !== 'hybrid') {
    throw new Error('search_mode must be hybrid')
  }

  const similarityThreshold = decodeFiniteNumber(
    value.similarity_threshold,
    'similarity_threshold',
  )
  if (similarityThreshold < -1 || similarityThreshold > 1) {
    throw new Error('similarity_threshold must be between -1 and 1')
  }
  if (typeof value.no_result !== 'boolean' || !Array.isArray(value.results)) {
    throw new Error('no_result and results are invalid')
  }

  const items = value.results.map(decodeSearchItem)
  const resultCount = decodeInteger(value.result_count, 'result_count', 0)
  if (resultCount !== items.length || value.no_result !== (items.length === 0)) {
    throw new Error('result_count or no_result does not match results')
  }

  return {
    items,
    noResult: value.no_result,
    normalizedQuery: decodeString(value.normalized_query, 'normalized_query'),
    query: decodeString(value.query, 'query'),
    resultCount,
    similarityThreshold,
  }
}

const researchSearchClient = new ApiClient({
  baseUrl: import.meta.env.VITE_SEARCH_API_BASE_URL,
})

export const researchSearchApi = {
  search(query: string, signal?: AbortSignal): Promise<ResearchSearchResult> {
    return researchSearchClient.request('/search/work', {
      body: { query: normalizeSearchQuery(query) },
      credentials: 'omit',
      decoder: decodeSearchResponse,
      method: 'POST',
      signal,
    })
  },
}
