import { apiClient } from '@/api/client'

export const NEWS_MAX_PAGE_SIZE = 100
export const NEWS_DEFAULT_PAGE_SIZE = 20

export interface NewsItem {
  author: string | null
  categories: readonly string[]
  comments: string | null
  description: string | null
  enclosureLength: number | null
  enclosureType: string | null
  enclosureUrl: string | null
  feedTitle: string
  guid: string | null
  guidIsPermalink: boolean | null
  id: number
  link: string
  pubDate: string | null
  publisher: string
  sourceName: string | null
  sourceUrl: string | null
  title: string
}

export interface NewsPublisher {
  categories: readonly string[]
  copyright: string | null
  description: string
  docs: string | null
  feedUrl: string
  generator: string | null
  id: number
  image: Readonly<Record<string, unknown>> | null
  language: string | null
  lastBuildDate: string | null
  link: string
  managingEditor: string | null
  pubDate: string | null
  publisher: string
  rating: string | null
  title: string
  ttl: number | null
  webMaster: string | null
}

export interface NewsPage {
  hasMore: boolean
  items: readonly NewsItem[]
  nextCursor: string | null
  order: string | null
  pageSize: number
}

export interface NewsPageQuery {
  cursor?: string | null
  pageSize?: number
  publisher?: string | null
  signal?: AbortSignal
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
  return value === null ? null : decodeString(value, field)
}

function decodeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${field} must be an integer`)
  }
  return value
}

function decodePositiveInteger(value: unknown, field: string): number {
  const integer = decodeInteger(value, field)
  if (integer < 1) {
    throw new Error(`${field} must be positive`)
  }
  return integer
}

function decodeNullableInteger(value: unknown, field: string): number | null {
  return value === null ? null : decodeInteger(value, field)
}

function decodeNullableBoolean(value: unknown, field: string): boolean | null {
  if (value === null) {
    return null
  }
  if (typeof value !== 'boolean') {
    throw new Error(`${field} must be a boolean or null`)
  }
  return value
}

function decodeNullableDateTime(value: unknown, field: string): string | null {
  const dateTime = decodeNullableString(value, field)
  if (dateTime !== null && Number.isNaN(Date.parse(dateTime))) {
    throw new Error(`${field} must be an ISO 8601 date-time or null`)
  }
  return dateTime
}

function decodeStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`)
  }
  return value.map((item) => decodeString(item, `${field} item`))
}

function decodeNewsItem(value: unknown): NewsItem {
  if (!isRecord(value)) {
    throw new Error('news item must be an object')
  }

  return {
    author: decodeNullableString(value.author, 'author'),
    categories: decodeStringArray(value.categories, 'categories'),
    comments: decodeNullableString(value.comments, 'comments'),
    description: decodeNullableString(value.description, 'description'),
    enclosureLength: decodeNullableInteger(value.enclosure_length, 'enclosure_length'),
    enclosureType: decodeNullableString(value.enclosure_type, 'enclosure_type'),
    enclosureUrl: decodeNullableString(value.enclosure_url, 'enclosure_url'),
    feedTitle: decodeString(value.feed_title, 'feed_title'),
    guid: decodeNullableString(value.guid, 'guid'),
    guidIsPermalink: decodeNullableBoolean(value.guid_is_permalink, 'guid_is_permalink'),
    id: decodePositiveInteger(value.id, 'id'),
    link: decodeString(value.link, 'link'),
    pubDate: decodeNullableDateTime(value.pub_date, 'pub_date'),
    publisher: decodeString(value.publisher, 'publisher'),
    sourceName: decodeNullableString(value.source_name, 'source_name'),
    sourceUrl: decodeNullableString(value.source_url, 'source_url'),
    title: decodeString(value.title, 'title'),
  }
}

function decodeNewsItems(value: unknown): readonly NewsItem[] {
  if (!Array.isArray(value)) {
    throw new Error('news items must be an array')
  }
  return value.map(decodeNewsItem)
}

function decodeImage(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null) {
    return null
  }
  if (!isRecord(value)) {
    throw new Error('image must be an object or null')
  }
  return value
}

function decodePublisher(value: unknown): NewsPublisher {
  if (!isRecord(value)) {
    throw new Error('publisher must be an object')
  }

  return {
    categories: decodeStringArray(value.categories, 'categories'),
    copyright: decodeNullableString(value.copyright, 'copyright'),
    description: decodeString(value.description, 'description'),
    docs: decodeNullableString(value.docs, 'docs'),
    feedUrl: decodeString(value.feed_url, 'feed_url'),
    generator: decodeNullableString(value.generator, 'generator'),
    id: decodePositiveInteger(value.id, 'id'),
    image: decodeImage(value.image),
    language: decodeNullableString(value.language, 'language'),
    lastBuildDate: decodeNullableDateTime(value.last_build_date, 'last_build_date'),
    link: decodeString(value.link, 'link'),
    managingEditor: decodeNullableString(value.managing_editor, 'managing_editor'),
    pubDate: decodeNullableDateTime(value.pub_date, 'pub_date'),
    publisher: decodeString(value.publisher, 'publisher'),
    rating: decodeNullableString(value.rating, 'rating'),
    title: decodeString(value.title, 'title'),
    ttl: decodeNullableInteger(value.ttl, 'ttl'),
    webMaster: decodeNullableString(value.web_master, 'web_master'),
  }
}

function decodePublishers(value: unknown): readonly NewsPublisher[] {
  if (!Array.isArray(value)) {
    throw new Error('publishers must be an array')
  }
  return value.map(decodePublisher)
}

function decodeNewsPage(value: unknown): NewsPage {
  if (!isRecord(value)) {
    throw new Error('news page must be an object')
  }

  const nextCursor = decodeNullableString(value.next_cursor, 'next_cursor')
  if (nextCursor !== null && (nextCursor.length < 1 || nextCursor.length > 512)) {
    throw new Error('next_cursor length is invalid')
  }
  if (typeof value.has_more !== 'boolean') {
    throw new Error('has_more must be a boolean')
  }

  return {
    hasMore: value.has_more,
    items: decodeNewsItems(value.items),
    nextCursor,
    order: value.order === undefined ? null : decodeString(value.order, 'order'),
    pageSize: decodePositiveInteger(value.page_size, 'page_size'),
  }
}

function normalizePublisher(publisher: string): string {
  const normalized = publisher.trim()
  if (normalized.length < 1 || normalized.length > 200) {
    throw new RangeError('publisher must be between 1 and 200 characters')
  }
  return normalized
}

function assertPageSize(pageSize: number): void {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > NEWS_MAX_PAGE_SIZE) {
    throw new RangeError(`page size must be between 1 and ${NEWS_MAX_PAGE_SIZE}`)
  }
}

export const newsApi = {
  getPublishers(signal?: AbortSignal): Promise<readonly NewsPublisher[]> {
    return apiClient.request('/news/publishers', { decoder: decodePublishers, signal })
  },

  getPublisher(publisher: string, signal?: AbortSignal): Promise<NewsPublisher> {
    const normalized = normalizePublisher(publisher)
    return apiClient.request(`/news/publishers/${encodeURIComponent(normalized)}`, {
      decoder: decodePublisher,
      signal,
    })
  },

  getLatest(
    count = 10,
    publisher?: string | null,
    signal?: AbortSignal,
  ): Promise<readonly NewsItem[]> {
    assertPageSize(count)
    return apiClient.request('/news/latest', {
      decoder: decodeNewsItems,
      query: {
        count,
        publisher: publisher === null || publisher === undefined ? undefined : normalizePublisher(publisher),
      },
      signal,
    })
  },

  getPage(query: NewsPageQuery = {}): Promise<NewsPage> {
    const pageSize = query.pageSize ?? NEWS_DEFAULT_PAGE_SIZE
    assertPageSize(pageSize)
    const cursor = query.cursor ?? undefined
    if (cursor !== undefined && (cursor.length < 1 || cursor.length > 512)) {
      throw new RangeError('cursor must be between 1 and 512 characters')
    }

    return apiClient.request('/news/latest/page', {
      decoder: decodeNewsPage,
      query: {
        cursor,
        page_size: pageSize,
        publisher:
          query.publisher === null || query.publisher === undefined
            ? undefined
            : normalizePublisher(query.publisher),
      },
      signal: query.signal,
    })
  },
}
